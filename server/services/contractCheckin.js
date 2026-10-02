const { randomUUID } = require('crypto');
const Friendship = require('../models/Friendship');
const VoiceNote = require('../models/VoiceNote');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { ensureActiveGameState } = require('./contractQueries');
const { prepareCheckinGame, completeCheckinGame, recordEvent } = require('./contractGame');
const { getBountyDecisionRequirement, settleBountiesForCheckin } = require('./bountyEscrow');
const { syncDebtState } = require('./debtState');
const checkinError = (status, message) => Object.assign(new Error(message), { status });
const participantKey = (friendship, userId) => String(friendship.user1) === String(userId) ? 'user1Perspective' : 'user2Perspective';
const eligibleForCheckin = (friendship, userId, now = Date.now()) => {
  if (friendship.season?.status === 'COMPLETE') return false;
  const perspective = friendship[participantKey(friendship, userId)];
  const start = new Date(friendship.season?.startedAt || 0).getTime();
  const last = new Date(perspective?.lastInteraction || 0).getTime();
  const hasCheckedIn = start > 0 ? last > start : last > 0;
  return !hasCheckedIn || now - last >= 20 * 60 * 60 * 1000;
};
const hasCheckedInThisSeason = (friendship, perspective) => {
  const start = new Date(friendship.season?.startedAt || 0).getTime();
  const last = new Date(perspective?.lastInteraction || 0).getTime();
  return start > 0 ? last > start : last > 0;
};

const performContractCheckin = async (friendshipId, userId, body = {}) => {
  // A database lease serializes text, voice, and message check-ins across server instances.
  const token = randomUUID();
  const now = new Date();
  const friendship = await Friendship.findOneAndUpdate({
    _id: friendshipId, status: 'ACTIVE',
    $and: [
      { $or: [{ user1: userId }, { user2: userId }] },
      { $or: [{ 'checkinLease.expiresAt': { $lte: now } }, { 'checkinLease.expiresAt': null }] }
    ]
  }, { $set: { checkinLease: { token, expiresAt: new Date(now.getTime() + 5 * 60 * 1000) } } }, { returnDocument: 'after' });
  if (!friendship) throw checkinError(409, 'This check-in is unavailable or already being processed. Refresh and try again.');
  try {
    await ensureActiveGameState(friendship);
    const key = participantKey(friendship, userId);
    const source = String(body.source || 'TEXT').toUpperCase() === 'VOICE' ? 'VOICE' : 'TEXT';
    const voiceNoteId = body.voiceNoteId ? String(body.voiceNoteId) : null;
    const allowedCheckinStatuses = new Set(['ALIVE', 'LOCKED_IN', 'BARELY', 'CHAOS']);
    const rawCheckinStatus = String(body.checkinStatus || '').trim().toUpperCase();
    const checkinStatus = allowedCheckinStatuses.has(rawCheckinStatus) ? rawCheckinStatus : null;
    const note = String(body.note || '').trim().slice(0, 40) || null;
    let pendingVoiceNote = null;

    if (source === 'VOICE') {
      const voiceQuery = {
        friendshipId: friendship._id,
        senderId: userId,
        ...(body.messageEventId
          ? { status: 'COMMITTED' }
          : { status: 'PENDING', expiresAt: { $gt: new Date() } })
      };
      if (voiceNoteId) voiceQuery._id = voiceNoteId;
      pendingVoiceNote = await VoiceNote.findOne(voiceQuery).sort({ createdAt: -1 });
      if (!pendingVoiceNote) {
        throw checkinError(409, 'Upload a fresh voice note before submitting this check-in');
      }
    }

    const bountyCreditId = body.bountyCreditId ? String(body.bountyCreditId) : null;
    const bountyDecision = String(body.bountyDecision || '').toUpperCase();
    const proofRequirement = await getBountyDecisionRequirement(friendship._id, userId);

    if (proofRequirement) {
      if (!['CREDIT', 'ESCAPE'].includes(bountyDecision)) {
        throw checkinError(409, `${proofRequirement.hunterName} has active proof on this bounty. Choose whether to credit them or escape before checking in.`);
      }
      if (bountyDecision === 'CREDIT' && bountyCreditId !== proofRequirement.bountyId) {
        throw checkinError(400, 'The hunter credit no longer matches the active bounty. Refresh and try again.');
      }
    } else if (bountyDecision === 'CREDIT') {
      throw checkinError(409, 'That hunter proof is no longer active. Refresh and check in normally.');
    }

    const prepared = await prepareCheckinGame(friendship, userId, source);
    const now = new Date();
    const lastInteraction = new Date(friendship[key].lastInteraction || 0);
    const hoursSince = (now - lastInteraction) / 3600000;
    if (hasCheckedInThisSeason(friendship, friendship[key]) && hoursSince < 20) {
      throw checkinError(400, 'You already checked in today');
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

    const game = await completeCheckinGame(friendship, userId, source, prepared, { checkinStatus, note, voiceNoteId: pendingVoiceNote?._id || null, messageEventId: body.messageEventId || null });

    if (pendingVoiceNote && pendingVoiceNote.status === 'PENDING') {
      const committedVoice = await VoiceNote.findOneAndUpdate(
        {
          _id: pendingVoiceNote._id,
          friendshipId: friendship._id,
          senderId: userId,
          status: 'PENDING'
        },
        {
          $set: { status: 'COMMITTED', expiresAt: null }
        },
        { returnDocument: 'after' }
      );

      if (!committedVoice) {
        console.error('Voice note commit lost after successful check-in:', pendingVoiceNote._id);
      }
    }

    if (recoveryStarted) {
      await recordEvent(friendship._id, 'BANKRUPTCY_RECOVERY_STARTED', {
        userId: userId,
        metadata: {
          previousDebt: debtBefore.totalDebt,
          recoveryDebt: debtBefore.limit,
          season: friendship.season?.number
        }
      });
    } else if (recoveryCompleted) {
      await recordEvent(friendship._id, 'BANKRUPTCY_RECOVERED', {
        userId: userId,
        metadata: { season: friendship.season?.number }
      });
    }
    const creditedId = bountyDecision === 'CREDIT' ? bountyCreditId : null;
    const bountyResults = await settleBountiesForCheckin(friendship._id, userId, creditedId);

    const otherUserId = friendship.user1.toString() === userId ? friendship.user2 : friendship.user1;
    const actor = await User.findById(userId).select('displayName');
    const actorName = actor?.displayName || 'Your contract partner';
    const statusLabel = checkinStatus ? checkinStatus.toLowerCase().replace('_', ' ') : null;
    const socialSuffix = `${statusLabel ? ` · ${statusLabel}` : ''}${note ? ` · “${note}”` : ''}`;
    const recoveryMessage = recoveryStarted
      ? `${actorName} checked in from bankruptcy. Recovery started. One clean check-in remains. +${game.xp} Duo XP${socialSuffix}.`
      : recoveryCompleted
        ? `${actorName} completed bankruptcy recovery and is stable again. +${game.xp} Duo XP${socialSuffix}.`
        : `${actorName} checked in. +${game.xp} Duo XP${socialSuffix}.`;

    if (!body.messageEventId) await Notification.create({
      toUserId: otherUserId,
      fromUserId: userId,
      type: recoveryStarted ? 'BANKRUPTCY_RECOVERY' : 'CHECKIN',
      title: recoveryStarted
        ? 'Bankruptcy recovery started'
        : recoveryCompleted
          ? 'Recovery complete'
          : source === 'VOICE' ? 'Voice check-in received' : 'Check-in received',
      message: recoveryMessage,
      friendshipId: friendship._id,
      contractEventId: game.checkinEventId
    });

    return {
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
    };
  } finally {
    await Friendship.updateOne({ _id: friendshipId, 'checkinLease.token': token }, { $unset: { checkinLease: '' } });
  }
};
module.exports = { performContractCheckin, eligibleForCheckin };
