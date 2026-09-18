const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const Friendship = require('../models/Friendship');
const PendingInvite = require('../models/PendingInvite');
const User = require('../models/User');
const Notification = require('../models/Notification');
const VoiceNote = require('../models/VoiceNote');
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

router.get('/meta', auth, (req, res) => {
  res.json({ templates: Object.values(TEMPLATES), worldEvent: getWorldEvent() });
});

router.post('/', auth, inviteLimiter, async (req, res) => {
  try {
    const email = String(req.body.friendEmail || '').trim().toLowerCase();
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const template = gameTemplate(req.body.templateId);
    if (!template) return res.status(400).json({ msg: 'Choose a valid contract type' });
    const limit = template.id === 'CUSTOM'
      ? normalizeLimit(req.body.limit, user.defaultLimit || 7)
      : template.limit;

    if (!email) return res.status(400).json({ msg: 'Friend email is required' });
    if (!limit) return res.status(400).json({ msg: 'Grace period must be between 1 and 30 days' });
    if (email === user.email) return res.status(400).json({ msg: 'You cannot create a contract with yourself' });

    const friend = await User.findOne({ email });
    if (!friend) {
      const expiresAt = new Date(Date.now() + 14 * DAY);
      const pendingInvite = await PendingInvite.findOneAndUpdate(
        { inviterId: user._id, recipientEmail: email },
        { $set: { inviterName: user.displayName, templateId: template.id, limit, expiresAt } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      void sendFriendRequestEmail(email, user.displayName, true);
      return res.status(202).json({
        inviteReady: true,
        inviteUrl: `${frontendUrl()}/?join=1`,
        recipientEmail: pendingInvite.recipientEmail,
        templateId: pendingInvite.templateId,
        expiresAt: pendingInvite.expiresAt
      });
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

    await PendingInvite.deleteOne({ inviterId: user._id, recipientEmail: email });
    void sendFriendRequestEmail(friend.email, user.displayName, false);
    return res.status(202).json({
      inviteReady: true,
      inviteUrl: `${frontendUrl()}/?join=1`,
      recipientEmail: email,
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
    await friendship.populate('user1 user2', 'displayName avatar');

    const recap = await buildRecap(friendship);
    return res.json({
      ...recap,
      players: [
        { id: friendship.user1?._id || friendship.user1, displayName: friendship.user1?.displayName || friendship.user1DisplayName },
        { id: friendship.user2?._id || friendship.user2, displayName: friendship.user2?.displayName || friendship.user2DisplayName }
      ]
    });
  } catch (err) {
    console.error('Load recap failed:', err.message);
    return res.status(err.status || 500).json({ msg: err.message || 'Could not load recap' });
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
    return res.json(friendship);
  } catch (err) {
    console.error('Run it back failed:', err.message);
    return res.status(err.status || 500).json({ msg: err.message || 'Could not start another season' });
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

    return res.json(friendship);
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
    if (hoursSince < 20) return res.status(400).json({ msg: 'You already checked in today' });

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

    const game = await completeCheckinGame(friendship, req.user.id, source, prepared);

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
    const recoveryMessage = recoveryStarted
      ? `${actorName} checked in from bankruptcy. Recovery started. One clean check-in remains. +${game.xp} Duo XP.`
      : recoveryCompleted
        ? `${actorName} completed bankruptcy recovery and is stable again. +${game.xp} Duo XP.`
        : `${actorName} checked in. +${game.xp} Duo XP.`;

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
      friendship,
      game,
      bounty: bountyResults[0] || null,
      recovery: {
        started: recoveryStarted,
        completed: recoveryCompleted,
        remainingDebt: recoveryStarted ? debtBefore.limit : 0,
        checkinsRemaining: recoveryStarted ? 1 : 0
      }
    });
  } catch (err) {
    console.error('Check-in failed:', err.message);
    return res.status(err.status || 500).json({ msg: err.message || 'Could not check in' });
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

    return res.json(friendship);
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
    await friendship.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not delete contract' });
  }
});

module.exports = router;
