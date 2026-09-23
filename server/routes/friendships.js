const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const Friendship = require('../models/Friendship');
const PendingInvite = require('../models/PendingInvite');
const User = require('../models/User');
const Notification = require('../models/Notification');
const VoiceNote = require('../models/VoiceNote');
const ContractReaction = require('../models/ContractReaction');
const { sendFriendRequestEmail } = require('../services/emailService');
const {
  refundOpenBountiesForFriendship,
  settleBountiesForCheckin,
  getBountyDecisionRequirement
} = require('../services/bountyEscrow');
const {
  TEMPLATES,
  getTemplate,
  getWorldEvent,
  initializeContractGame,
  activateSeason,
  refreshGameState,
  prepareCheckinGame,
  completeCheckinGame,
  buildRecap,
  runItBack,
  recordEvent
} = require('../services/contractGame');
const { syncDebtState } = require('../services/debtState');
const { ensureActiveGameState, loadContractsForUser } = require('../services/contractQueries');
const { normalizeUsername } = require('../services/username');
const { recapView } = require('../services/clientViews');
const { sendRouteError } = require('../services/httpError');
const {
  POKE_COOLDOWN_MS,
  REACTIONS,
  REPLY_MAX_LENGTH,
  buildSocialPresence,
  findLatestPartnerCheckin,
  latestOwnPoke,
  findReplyForCheckin
} = require('../services/socialPresence');

const DAY = 24 * 60 * 60 * 1000;

const inviteLimiter = createRateLimiter({
  name: 'contract-invite',
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many contract invites. Try again later.'
});

const normalizeLimit = (value, fallback = 7) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) return null;
  return parsed;
};

const participantKey = (friendship, userId) => {
  if (friendship.user1.toString() === userId) return 'user1Perspective';
  if (friendship.user2.toString() === userId) return 'user2Perspective';
  return null;
};

const ensureParticipant = (friendship, userId) => Boolean(participantKey(friendship, userId));
const frontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const gameTemplate = (value) => {
  const id = String(value || 'DONT_GHOST').toUpperCase();
  return TEMPLATES[id] || null;
};

const hasCheckedInThisSeason = (friendship, perspective) => {
  const seasonStartedAt = new Date(friendship?.season?.startedAt || 0).getTime();
  const lastInteractionAt = new Date(perspective?.lastInteraction || 0).getTime();
  if (!(seasonStartedAt > 0)) return lastInteractionAt > 0;
  return lastInteractionAt > seasonStartedAt;
};

router.get('/social', auth, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      status: 'ACTIVE',
      $or: [{ user1: req.user.id }, { user2: req.user.id }]
    }).select('user1 user2 user1DisplayName user2DisplayName status season');
    return res.json(await buildSocialPresence(req.user.id, friendships, req.query.since));
  } catch (err) {
    console.error('Load social presence failed:', err.message);
    return res.status(500).json({ msg: 'Could not load circle activity' });
  }
});

router.post('/:id/react-checkin', auth, async (req, res) => {
  try {
    const reaction = String(req.body.reaction || '');
    if (!REACTIONS.includes(reaction)) return res.status(400).json({ msg: 'Choose a valid reaction' });

    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (friendship.status !== 'ACTIVE') return res.status(400).json({ msg: 'Contract is not active' });
    if (!ensureParticipant(friendship, req.user.id)) return res.status(403).json({ msg: 'Not authorized' });

    const checkin = await findLatestPartnerCheckin(friendship, req.user.id);
    if (!checkin) return res.status(409).json({ msg: 'There is no recent partner check-in to react to' });

    const partnerId = friendship.user1.toString() === req.user.id ? friendship.user2 : friendship.user1;
    let existing = await ContractReaction.findOne({ checkinEventId: checkin._id, fromUserId: req.user.id });
    const isNew = !existing;

    if (existing) {
      existing.reaction = reaction;
      await existing.save();
    } else {
      existing = await ContractReaction.create({
        friendshipId: friendship._id,
        checkinEventId: checkin._id,
        fromUserId: req.user.id,
        toUserId: partnerId,
        reaction
      });
    }

    if (isNew) {
      const actor = await User.findById(req.user.id).select('displayName');
      await Promise.all([
        recordEvent(friendship._id, 'CHECKIN_REACTION', {
          userId: req.user.id,
          metadata: {
            reaction,
            targetUserId: String(partnerId),
            checkinEventId: String(checkin._id)
          }
        }),
        Notification.create({
          toUserId: partnerId,
          fromUserId: req.user.id,
          type: 'CHECKIN_REACTION',
          title: 'Check-in reaction',
          message: `${actor?.displayName || 'Your contract partner'} reacted ${reaction} to your check-in.`,
          friendshipId: friendship._id
        })
      ]);
    }

    return res.json({ success: true, reaction: existing.reaction, checkinAt: checkin.createdAt });
  } catch (err) {
    console.error('React to check-in failed:', err.message);
    return sendRouteError(res, err, 'Could not react to check-in');
  }
});

router.post('/:id/reply-checkin', auth, async (req, res) => {
  try {
    const rawText = String(req.body.text || '').trim();
    if (!rawText) return res.status(400).json({ msg: 'Write a tiny reply first' });
    if (rawText.length > REPLY_MAX_LENGTH) {
      return res.status(400).json({ msg: `Keep replies under ${REPLY_MAX_LENGTH} characters` });
    }

    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (friendship.status !== 'ACTIVE') return res.status(400).json({ msg: 'Contract is not active' });
    if (!ensureParticipant(friendship, req.user.id)) return res.status(403).json({ msg: 'Not authorized' });

    const checkin = await findLatestPartnerCheckin(friendship, req.user.id);
    if (!checkin) return res.status(409).json({ msg: 'There is no recent partner check-in to reply to' });

    const existing = await findReplyForCheckin(friendship._id, checkin._id, req.user.id);
    if (existing) return res.status(409).json({ msg: 'You already replied to this check-in' });

    const partnerId = friendship.user1.toString() === req.user.id ? friendship.user2 : friendship.user1;
    const actor = await User.findById(req.user.id).select('displayName');

    const replyEvent = await recordEvent(friendship._id, 'CHECKIN_REPLY', {
      userId: req.user.id,
      metadata: {
        text: rawText,
        targetUserId: String(partnerId),
        checkinEventId: String(checkin._id)
      }
    });

    await Notification.create({
      toUserId: partnerId,
      fromUserId: req.user.id,
      type: 'CHECKIN_REPLY',
      title: 'Check-in reply',
      message: `${actor?.displayName || 'Your contract partner'} replied “${rawText}”`,
      friendshipId: friendship._id
    });

    return res.json({
      success: true,
      reply: {
        id: replyEvent._id,
        text: rawText,
        createdAt: replyEvent.createdAt
      }
    });
  } catch (err) {
    console.error('Reply to check-in failed:', err.message);
    return sendRouteError(res, err, 'Could not reply to this check-in');
  }
});

router.post('/:id/poke', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (friendship.status !== 'ACTIVE' || friendship.season?.status !== 'ACTIVE') {
      return res.status(400).json({ msg: 'This contract is not active' });
    }
    if (!ensureParticipant(friendship, req.user.id)) return res.status(403).json({ msg: 'Not authorized' });

    const lastPoke = await latestOwnPoke(friendship._id, req.user.id);
    if (lastPoke) {
      const nextAvailableAt = new Date(new Date(lastPoke.createdAt).getTime() + POKE_COOLDOWN_MS);
      if (nextAvailableAt > new Date()) {
        return res.status(429).json({ msg: 'You already poked them. Give it a little time.', nextAvailableAt });
      }
    }

    const partnerId = friendship.user1.toString() === req.user.id ? friendship.user2 : friendship.user1;
    const actor = await User.findById(req.user.id).select('displayName');
    const now = new Date();

    await Promise.all([
      recordEvent(friendship._id, 'POKE', {
        userId: req.user.id,
        metadata: { targetUserId: String(partnerId) }
      }),
      Notification.create({
        toUserId: partnerId,
        fromUserId: req.user.id,
        type: 'POKE',
        title: 'Poke',
        message: `${actor?.displayName || 'Your contract partner'} poked you. Your move.`,
        friendshipId: friendship._id
      })
    ]);

    return res.json({
      success: true,
      nextAvailableAt: new Date(now.getTime() + POKE_COOLDOWN_MS)
    });
  } catch (err) {
    console.error('Poke contract failed:', err.message);
    return sendRouteError(res, err, 'Could not poke this contract');
  }
});

router.get('/meta', auth, (req, res) => {
  res.json({ templates: Object.values(TEMPLATES), worldEvent: getWorldEvent() });
});

router.post('/', auth, inviteLimiter, async (req, res) => {
  try {
    const identifier = String(req.body.friendIdentifier || req.body.friendEmail || '').trim();
    const email = /^\S+@\S+\.\S+$/.test(identifier) ? identifier.toLowerCase() : null;
    const usernameNormalized = email ? null : normalizeUsername(identifier);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const template = gameTemplate(req.body.templateId);
    if (!template) return res.status(400).json({ msg: 'Choose a valid contract type' });
    const limit = template.id === 'CUSTOM'
      ? normalizeLimit(req.body.limit, user.defaultLimit || 7)
      : template.limit;

    if (!identifier) return res.status(400).json({ msg: 'Enter a username or email' });
    if (!limit) return res.status(400).json({ msg: 'Grace period must be between 1 and 30 days' });
    if (!email && !/^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(usernameNormalized)) {
      return res.status(400).json({ msg: 'Enter a valid username or email' });
    }
    if (email && email === user.email) return res.status(400).json({ msg: 'You cannot create a contract with yourself' });
    if (!email && usernameNormalized === user.usernameNormalized) {
      return res.status(400).json({ msg: 'You cannot create a contract with yourself' });
    }

    const friend = email
      ? await User.findOne({ email })
      : await User.findOne({ usernameNormalized });

    if (!friend && !email) {
      return res.status(404).json({ msg: 'Could not find that Hakoware username' });
    }

    const senderIdentity = user.username ? `@${user.username}` : user.displayName;

    if (!friend) {
      const expiresAt = new Date(Date.now() + 14 * DAY);
      const pendingInvite = await PendingInvite.findOneAndUpdate(
        { inviterId: user._id, recipientEmail: email },
        { $set: { inviterName: user.displayName, templateId: template.id, limit, expiresAt } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      void sendFriendRequestEmail(email, senderIdentity, true);
      return res.status(202).json({
        inviteReady: true,
        requiresSignup: true,
        inviteUrl: `${frontendUrl()}/?join=1`,
        recipientEmail: pendingInvite.recipientEmail,
        recipientLabel: pendingInvite.recipientEmail,
        templateId: pendingInvite.templateId,
        expiresAt: pendingInvite.expiresAt
      });
    }

    if (String(friend._id) === String(user._id)) {
      return res.status(400).json({ msg: 'You cannot create a contract with yourself' });
    }

    const existing = await Friendship.findOne({
      $or: [
        { user1: req.user.id, user2: friend.id },
        { user1: friend.id, user2: req.user.id }
      ]
    });
    if (existing) return res.status(400).json({ msg: 'A contract with this person already exists' });

    const friendship = new Friendship({
      user1: req.user.id,
      user2: friend.id,
      user1DisplayName: user.displayName,
      user2DisplayName: friend.displayName,
      status: 'PENDING'
    });
    initializeContractGame(friendship, template.id, limit);
    await friendship.save();
    await recordEvent(friendship._id, 'CONTRACT_CREATED', {
      userId: user._id,
      metadata: { templateId: template.id, limit }
    });

    await PendingInvite.deleteOne({ inviterId: user._id, recipientEmail: friend.email });
    void sendFriendRequestEmail(friend.email, senderIdentity, false);
    return res.status(202).json({
      inviteReady: true,
      requiresSignup: false,
      inviteUrl: frontendUrl(),
      recipientUsername: friend.username || null,
      recipientLabel: friend.username ? `@${friend.username}` : friend.displayName,
      templateId: friendship.templateId,
      expiresAt: null
    });
  } catch (err) {
    console.error('Create contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not create contract' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    return res.json(await loadContractsForUser(req.user.id));
  } catch (err) {
    console.error('Load contracts failed:', err.message);
    return res.status(500).json({ msg: 'Could not load contracts' });
  }
});

router.get('/:id/recap', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (!ensureParticipant(friendship, req.user.id)) return res.status(403).json({ msg: 'Not authorized' });
    await ensureActiveGameState(friendship);
    await friendship.populate('user1 user2', 'displayName username avatar');

    const recap = await buildRecap(friendship);
    return res.json(recapView({
      ...recap,
      players: [
        { displayName: friendship.user1?.displayName || friendship.user1DisplayName, username: friendship.user1?.username || null },
        { displayName: friendship.user2?.displayName || friendship.user2DisplayName, username: friendship.user2?.username || null }
      ]
    }));
  } catch (err) {
    console.error('Load recap failed:', err.message);
    return sendRouteError(res, err, 'Could not load recap');
  }
});

router.post('/:id/run-it-back', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (!ensureParticipant(friendship, req.user.id)) return res.status(403).json({ msg: 'Not authorized' });
    if (friendship.status !== 'ACTIVE') return res.status(400).json({ msg: 'Contract is not active' });
    await ensureActiveGameState(friendship);
    await runItBack(friendship);
    return res.json({ success: true });
  } catch (err) {
    console.error('Run it back failed:', err.message);
    return sendRouteError(res, err, 'Could not start another season');
  }
});

router.put('/:id/respond', auth, async (req, res) => {
  try {
    const action = String(req.body.action || '').toUpperCase();
    if (!['ACCEPT', 'DECLINE'].includes(action)) return res.status(400).json({ msg: 'Response must be ACCEPT or DECLINE' });

    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (friendship.user2.toString() !== req.user.id) return res.status(403).json({ msg: 'Not authorized' });
    if (friendship.status !== 'PENDING') return res.status(400).json({ msg: 'This request is no longer pending' });

    const responder = await User.findById(req.user.id);
    const inviter = await User.findById(friendship.user1);

    if (action === 'DECLINE') {
      await recordEvent(friendship._id, 'CONTRACT_DECLINED', { userId: req.user.id });
      await friendship.deleteOne();
      if (inviter) {
        await Notification.create({
          toUserId: inviter._id,
          fromUserId: responder?._id,
          type: 'CONTRACT_DECLINED',
          title: 'Contract declined',
          message: `${responder?.displayName || 'Your invitee'} declined your contract request.`
        });
      }
      return res.json({ success: true });
    }

    friendship.status = 'ACTIVE';
    await activateSeason(friendship);

    if (inviter) {
      await Notification.create({
        toUserId: inviter._id,
        fromUserId: responder?._id,
        type: 'CONTRACT_ACCEPTED',
        title: 'Contract accepted',
        message: `${responder?.displayName || 'Your invitee'} accepted your contract request. Season 1 starts now.`,
        friendshipId: friendship._id
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Respond to contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not respond to contract' });
  }
});

router.post('/:id/checkin', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (friendship.status !== 'ACTIVE') return res.status(400).json({ msg: 'Contract is not active' });
    await ensureActiveGameState(friendship);

    const key = participantKey(friendship, req.user.id);
    if (!key) return res.status(403).json({ msg: 'Not authorized' });

    const source = String(req.body.source || 'TEXT').toUpperCase() === 'VOICE' ? 'VOICE' : 'TEXT';
    const voiceNoteId = req.body.voiceNoteId ? String(req.body.voiceNoteId) : null;
    const allowedCheckinStatuses = new Set(['ALIVE', 'LOCKED_IN', 'BARELY', 'CHAOS']);
    const rawCheckinStatus = String(req.body.checkinStatus || '').trim().toUpperCase();
    const checkinStatus = allowedCheckinStatuses.has(rawCheckinStatus) ? rawCheckinStatus : null;
    const note = String(req.body.note || '').trim().slice(0, 40) || null;
    let pendingVoiceNote = null;

    if (source === 'VOICE') {
      const voiceQuery = {
        friendshipId: friendship._id,
        senderId: req.user.id,
        status: 'PENDING',
        expiresAt: { $gt: new Date() }
      };
      if (voiceNoteId) voiceQuery._id = voiceNoteId;
      pendingVoiceNote = await VoiceNote.findOne(voiceQuery).sort({ createdAt: -1 });
      if (!pendingVoiceNote) {
        return res.status(409).json({ msg: 'Upload a fresh voice note before submitting this check-in' });
      }
    }

    const bountyCreditId = req.body.bountyCreditId ? String(req.body.bountyCreditId) : null;
    const bountyDecision = String(req.body.bountyDecision || '').toUpperCase();
    const proofRequirement = await getBountyDecisionRequirement(friendship._id, req.user.id);

    if (proofRequirement) {
      if (!['CREDIT', 'ESCAPE'].includes(bountyDecision)) {
        return res.status(409).json({
          msg: `${proofRequirement.hunterName} has active proof on this bounty. Choose whether to credit them or escape before checking in.`
        });
      }
      if (bountyDecision === 'CREDIT' && bountyCreditId !== proofRequirement.bountyId) {
        return res.status(400).json({ msg: 'The hunter credit no longer matches the active bounty. Refresh and try again.' });
      }
    } else if (bountyDecision === 'CREDIT') {
      return res.status(409).json({ msg: 'That hunter proof is no longer active. Refresh and check in normally.' });
    }

    const prepared = await prepareCheckinGame(friendship, req.user.id, source);
    const now = new Date();
    const lastInteraction = new Date(friendship[key].lastInteraction || 0);
    const hoursSince = (now - lastInteraction) / 3600000;
    if (hasCheckedInThisSeason(friendship, friendship[key]) && hoursSince < 20) {
      return res.status(400).json({ msg: 'You already checked in today' });
    }

    const debtBefore = syncDebtState(friendship[key], now);
    const recoveryStarted = debtBefore.isBankrupt;
    const recoveryCompleted = !debtBefore.isBankrupt && Boolean(friendship[key].recoveryRequired);

    friendship[key].lastInteraction = now;
    friendship[key].daysMissed = 0;
    friendship[key].isBankrupt = false;

    if (recoveryStarted) {
      friendship[key].baseDebt = debtBefore.limit;
      friendship[key].calculatedDebt = debtBefore.limit;
      friendship[key].isInWarningZone = true;
      friendship[key].daysUntilBankrupt = debtBefore.limit;
      friendship[key].recoveryRequired = true;
      friendship[key].wasBankrupt = true;
      if (!friendship[key].bankruptAt) friendship[key].bankruptAt = now;
    } else {
      friendship[key].baseDebt = 0;
      friendship[key].calculatedDebt = 0;
      friendship[key].isInWarningZone = false;
      friendship[key].daysUntilBankrupt = debtBefore.limit * 2;
      friendship[key].recoveryRequired = false;
    }

    const game = await completeCheckinGame(friendship, req.user.id, source, prepared, { checkinStatus, note });

    if (pendingVoiceNote) {
      const committedVoice = await VoiceNote.findOneAndUpdate(
        {
          _id: pendingVoiceNote._id,
          friendshipId: friendship._id,
          senderId: req.user.id,
          status: 'PENDING'
        },
        {
          $set: { status: 'COMMITTED', expiresAt: null }
        },
        { new: true }
      );

      if (!committedVoice) {
        console.error('Voice note commit lost after successful check-in:', pendingVoiceNote._id);
      }
    }

    if (recoveryStarted) {
      await recordEvent(friendship._id, 'BANKRUPTCY_RECOVERY_STARTED', {
        userId: req.user.id,
        metadata: {
          previousDebt: debtBefore.totalDebt,
          recoveryDebt: debtBefore.limit,
          season: friendship.season?.number
        }
      });
    } else if (recoveryCompleted) {
      await recordEvent(friendship._id, 'BANKRUPTCY_RECOVERED', {
        userId: req.user.id,
        metadata: { season: friendship.season?.number }
      });
    }
    const creditedId = bountyDecision === 'CREDIT' ? bountyCreditId : null;
    const bountyResults = await settleBountiesForCheckin(friendship._id, req.user.id, creditedId);

    const otherUserId = friendship.user1.toString() === req.user.id ? friendship.user2 : friendship.user1;
    const actor = await User.findById(req.user.id).select('displayName');
    const actorName = actor?.displayName || 'Your contract partner';
    const statusLabel = checkinStatus ? checkinStatus.toLowerCase().replace('_', ' ') : null;
    const socialSuffix = `${statusLabel ? ` · ${statusLabel}` : ''}${note ? ` · “${note}”` : ''}`;
    const recoveryMessage = recoveryStarted
      ? `${actorName} checked in from bankruptcy. Recovery started. One clean check-in remains. +${game.xp} Duo XP.${socialSuffix}`
      : recoveryCompleted
        ? `${actorName} completed bankruptcy recovery and is stable again. +${game.xp} Duo XP.${socialSuffix}`
        : `${actorName} checked in. +${game.xp} Duo XP.${socialSuffix}`;

    await Notification.create({
      toUserId: otherUserId,
      fromUserId: req.user.id,
      type: recoveryStarted ? 'BANKRUPTCY_RECOVERY' : 'CHECKIN',
      title: recoveryStarted
        ? 'Bankruptcy recovery started'
        : recoveryCompleted
          ? 'Recovery complete'
          : source === 'VOICE' ? 'Voice check-in received' : 'Check-in received',
      message: recoveryMessage,
      friendshipId: friendship._id
    });

    return res.json({
      game: {
        xp: Number(game.xp) || 0,
        chaosResolved: Boolean(game.chaosResolved),
        wantedCleared: Boolean(game.wantedCleared)
      },
      bounty: bountyResults[0] ? { outcome: bountyResults[0].outcome } : null,
      recovery: {
        started: recoveryStarted,
        completed: recoveryCompleted,
        remainingDebt: recoveryStarted ? debtBefore.limit : 0,
        checkinsRemaining: recoveryStarted ? 1 : 0
      }
    });
  } catch (err) {
    console.error('Check-in failed:', err.message);
    return sendRouteError(res, err, 'Could not check in');
  }
});

router.put('/:id/limit', auth, async (req, res) => {
  try {
    const limit = normalizeLimit(req.body.limit);
    if (!limit) return res.status(400).json({ msg: 'Grace period must be between 1 and 30 days' });

    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    const key = participantKey(friendship, req.user.id);
    if (!key) return res.status(403).json({ msg: 'Not authorized' });
    if ((friendship.templateId || 'DONT_GHOST') !== 'CUSTOM') {
      const template = getTemplate(friendship.templateId);
      return res.status(400).json({ msg: `${template.name} has a fixed ${template.limit}-day rule` });
    }

    friendship[key].limit = limit;
    await friendship.save();

    const otherUserId = friendship.user1.toString() === req.user.id ? friendship.user2 : friendship.user1;
    const actor = await User.findById(req.user.id).select('displayName');
    await Notification.create({
      toUserId: otherUserId,
      fromUserId: req.user.id,
      type: 'LIMIT_CHANGED',
      title: 'Grace period updated',
      message: `${actor?.displayName || 'Your contract partner'} changed their grace period to ${limit} day${limit === 1 ? '' : 's'}.`,
      friendshipId: friendship._id
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Update contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not update contract' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (!ensureParticipant(friendship, req.user.id)) return res.status(403).json({ msg: 'Not authorized' });

    await refundOpenBountiesForFriendship(friendship._id);
    await recordEvent(friendship._id, 'CONTRACT_ENDED', { userId: req.user.id });
    const otherUserId = friendship.user1.toString() === req.user.id ? friendship.user2 : friendship.user1;
    const actor = await User.findById(req.user.id).select('displayName');
    await Notification.create({
      toUserId: otherUserId,
      fromUserId: req.user.id,
      type: 'CONTRACT_ENDED',
      title: 'Contract ended',
      message: `${actor?.displayName || 'Your contract partner'} ended your contract.`
    });
    await Promise.all([
      ContractReaction.deleteMany({ friendshipId: friendship._id }),
      friendship.deleteOne()
    ]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not delete contract' });
  }
});

module.exports = router;
