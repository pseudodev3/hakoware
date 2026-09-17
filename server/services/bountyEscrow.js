const Bounty = require('../models/Bounty');
const User = require('../models/User');
const AuraTransaction = require('../models/AuraTransaction');
const Notification = require('../models/Notification');
const { recordEvent } = require('./contractGame');

const HOUR = 60 * 60 * 1000;
const HUNT_WINDOW_HOURS = 12;
const OPEN_STATUSES = ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'];

const listingFeeFor = (amount) => Math.max(1, Math.min(25, Math.ceil((Number(amount) || 0) * 0.05)));
const hunterBondFor = (amount) => Math.max(5, Math.min(50, Math.ceil((Number(amount) || 0) * 0.1)));

const hunterRankFromRep = (rep = 0) => {
  const safe = Math.max(0, Number(rep) || 0);
  if (safe >= 1500) return { name: 'Apex Hunter', nextAt: null };
  if (safe >= 700) return { name: 'Closer', nextAt: 1500 };
  if (safe >= 300) return { name: 'Pursuer', nextAt: 700 };
  if (safe >= 100) return { name: 'Tracker', nextAt: 300 };
  return { name: 'Rookie Hunter', nextAt: 100 };
};

const addAura = async (userId, amount, type, description, metadata = {}) => {
  if (!amount || amount <= 0) return false;
  const updated = await User.updateOne({ _id: userId }, { $inc: { auraBalance: amount } });
  if (!updated.matchedCount) return false;
  await AuraTransaction.create({ userId, amount, type, description, metadata });
  return true;
};

const returnHunterBond = async (bounty, reason) => {
  const amount = Number(bounty.hunterBond) || 0;
  if (!bounty.hunterId || amount <= 0) return false;
  const exists = await User.exists({ _id: bounty.hunterId });
  if (!exists) return false;
  return addAura(
    bounty.hunterId,
    amount,
    'HUNTER_BOND_RETURN',
    `Hunter bond returned: ${reason}`,
    { bountyId: bounty._id, friendshipId: bounty.friendshipId }
  );
};

const activeAttempt = (bounty, outcome, now = new Date(), repDelta = 0, creditedAt = null) => {
  if (!bounty.hunterId) return null;
  return {
    hunterId: bounty.hunterId,
    hunterName: bounty.hunterName || 'Hunter',
    bond: Number(bounty.hunterBond) || 0,
    startedAt: bounty.huntStartedAt || now,
    pressureSentAt: bounty.pressureSentAt || null,
    pressurePreset: bounty.pressurePreset || null,
    endedAt: now,
    outcome,
    repDelta,
    creditedAt
  };
};

const refundBounty = async (bounty, reason) => {
  const now = new Date();
  const attempt = activeAttempt(bounty, 'HUNT_EXPIRED', now, 0);
  const update = {
    $set: { status: 'EXPIRED', resolvedAt: now }
  };
  if (attempt) update.$push = { attempts: attempt };

  const closed = await Bounty.findOneAndUpdate(
    { _id: bounty._id, status: { $in: OPEN_STATUSES } },
    update,
    { new: true }
  );
  if (!closed) return false;

  await addAura(
    closed.senderId,
    closed.amount,
    'BOUNTY_REFUND',
    `${reason}: ${closed.targetName}`,
    { bountyId: closed._id, friendshipId: closed.friendshipId }
  );
  await returnHunterBond(closed, reason);
  await recordEvent(closed.friendshipId, 'BOUNTY_REFUND', {
    userId: closed.senderId,
    aura: closed.amount,
    metadata: { amount: closed.amount, targetId: closed.targetId, targetName: closed.targetName, reason }
  }).catch(() => null);
  await Notification.create({
    toUserId: closed.senderId,
    type: 'BOUNTY_REFUND',
    title: `+${closed.amount} Aura refunded`,
    message: `${reason}. Your bounty on ${closed.targetName} was returned.`
  }).catch(() => null);
  return true;
};

const payHuntedBounty = async (bounty) => {
  if (!bounty.hunterId || !bounty.pressureSentAt) return false;

  const hunter = await User.findById(bounty.hunterId).select('_id displayName');
  if (!hunter) return refundBounty(bounty, 'Bounty hunter is no longer available');

  const now = new Date();
  const attempt = activeAttempt(bounty, 'CLAIMED', now, 100, now);
  const claimed = await Bounty.findOneAndUpdate(
    { _id: bounty._id, status: 'PRESSURE_SENT', hunterId: bounty.hunterId },
    {
      $set: { status: 'CLAIMED', creditedAt: now, resolvedAt: now },
      $push: { attempts: attempt }
    },
    { new: true }
  );
  if (!claimed) return false;

  await addAura(
    hunter._id,
    claimed.amount,
    'BOUNTY_REWARD',
    `Proof accepted: ${claimed.targetName} credited your pressure`,
    { bountyId: claimed._id, friendshipId: claimed.friendshipId }
  );
  await returnHunterBond(claimed, 'proof accepted');
  await recordEvent(claimed.friendshipId, 'BOUNTY_REWARD', {
    userId: hunter._id,
    aura: claimed.amount,
    metadata: {
      amount: claimed.amount,
      targetId: claimed.targetId,
      targetName: claimed.targetName,
      hunterId: hunter._id,
      proof: 'TARGET_CREDIT'
    }
  }).catch(() => null);

  await Promise.all([
    Notification.create({
      toUserId: hunter._id,
      type: 'BOUNTY_REWARD',
      title: `+${claimed.amount} Aura · proof accepted`,
      message: `${claimed.targetName} credited your pressure. Hunt closed.`
    }).catch(() => null),
    Notification.create({
      toUserId: claimed.senderId,
      fromUserId: hunter._id,
      type: 'BOUNTY_REWARD',
      title: 'Bounty collected',
      message: `${hunter.displayName} got ${claimed.targetName} to check in and received ${claimed.amount} Aura.`
    }).catch(() => null)
  ]);
  return { outcome: 'CLAIMED', bounty: claimed };
};

const resolveTargetEscape = async (bounty, reason = 'Target checked in without crediting a hunter') => {
  const now = new Date();
  const attempt = activeAttempt(bounty, 'TARGET_ESCAPED', now, bounty.pressureSentAt ? 10 : 0);
  const update = {
    $set: { status: 'ESCAPED', resolvedAt: now }
  };
  if (attempt) update.$push = { attempts: attempt };

  const closed = await Bounty.findOneAndUpdate(
    { _id: bounty._id, status: { $in: OPEN_STATUSES } },
    update,
    { new: true }
  );
  if (!closed) return false;

  await addAura(
    closed.senderId,
    closed.amount,
    'BOUNTY_REFUND',
    `Target escaped: ${closed.targetName}`,
    { bountyId: closed._id, friendshipId: closed.friendshipId }
  );
  await returnHunterBond(closed, 'target escaped');
  await recordEvent(closed.friendshipId, 'BOUNTY_ESCAPED', {
    userId: closed.targetId,
    aura: closed.amount,
    metadata: {
      amount: closed.amount,
      hunterId: closed.hunterId || null,
      pressureSent: Boolean(closed.pressureSentAt),
      reason
    }
  }).catch(() => null);

  await Promise.all([
    Notification.create({
      toUserId: closed.senderId,
      type: 'BOUNTY_REFUND',
      title: `${closed.targetName} escaped`,
      message: `They checked in without crediting a hunter. ${closed.amount} Aura returned.`
    }).catch(() => null),
    closed.hunterId ? Notification.create({
      toUserId: closed.hunterId,
      type: 'BOUNTY_REFUND',
      title: 'Target escaped',
      message: `${closed.targetName} checked in without crediting your pressure. Your bond was returned.`
    }).catch(() => null) : Promise.resolve()
  ]);

  return { outcome: 'ESCAPED', bounty: closed };
};

const getBountyDecisionRequirement = async (friendshipId, targetUserId) => {
  await expireStaleBounties();
  const bounty = await Bounty.findOne({
    friendshipId,
    targetId: targetUserId,
    status: 'PRESSURE_SENT',
    pressureSentAt: { $ne: null },
    hunterId: { $ne: null }
  }).select('_id amount hunterId hunterName huntExpiresAt');

  if (!bounty) return null;
  return {
    bountyId: String(bounty._id),
    amount: bounty.amount,
    hunterId: String(bounty.hunterId),
    hunterName: bounty.hunterName || 'Hunter',
    huntExpiresAt: bounty.huntExpiresAt
  };
};

const settleBountiesForCheckin = async (friendshipId, targetUserId, creditedBountyId = null) => {
  await expireStaleBounties();
  const bounties = await Bounty.find({
    friendshipId,
    targetId: targetUserId,
    status: { $in: OPEN_STATUSES }
  });
  const results = [];

  for (const bounty of bounties) {
    const credited = creditedBountyId && String(creditedBountyId) === String(bounty._id);
    if (credited && bounty.status === 'PRESSURE_SENT' && bounty.pressureSentAt && bounty.hunterId) {
      const result = await payHuntedBounty(bounty);
      if (result) results.push(result);
    } else {
      const result = await resolveTargetEscape(bounty);
      if (result) results.push(result);
    }
  }
  return results;
};

const reopenExpiredHunt = async (bounty, now = new Date()) => {
  if (!bounty.hunterId) return false;
  const sentPressure = Boolean(bounty.pressureSentAt);
  const outcome = sentPressure ? 'HUNT_EXPIRED' : 'NO_PRESSURE';
  const repDelta = sentPressure ? 5 : -10;
  const attempt = activeAttempt(bounty, outcome, now, repDelta);

  const reopened = await Bounty.findOneAndUpdate(
    { _id: bounty._id, status: { $in: ['HUNTING', 'PRESSURE_SENT'] }, hunterId: bounty.hunterId },
    {
      $set: {
        status: 'ACTIVE',
        hunterId: null,
        hunterName: null,
        hunterBond: 0,
        huntStartedAt: null,
        huntExpiresAt: null,
        pressureSentAt: null,
        pressurePreset: null
      },
      $push: { attempts: attempt }
    },
    { new: true }
  );
  if (!reopened) return false;

  if (sentPressure) {
    await returnHunterBond(bounty, 'hunt window expired after pressure');
  }

  await recordEvent(bounty.friendshipId, sentPressure ? 'BOUNTY_HUNT_EXPIRED' : 'BOUNTY_BOND_BURNED', {
    userId: bounty.hunterId,
    aura: sentPressure ? 0 : -(Number(bounty.hunterBond) || 0),
    metadata: { bountyId: bounty._id, targetId: bounty.targetId, repDelta }
  }).catch(() => null);

  await Notification.create({
    toUserId: bounty.hunterId,
    type: 'GAME_EVENT',
    title: sentPressure ? 'Hunt window closed' : 'Hunter bond burned',
    message: sentPressure
      ? `${bounty.targetName} did not convert in time. Your bond was returned and the bounty reopened.`
      : `You never sent pressure on ${bounty.targetName}. Your ${bounty.hunterBond || 0} Aura bond was burned.`
  }).catch(() => null);
  return true;
};

const refundOpenBountiesForFriendship = async (friendshipId) => {
  const bounties = await Bounty.find({ friendshipId, status: { $in: OPEN_STATUSES } });
  for (const bounty of bounties) await refundBounty(bounty, 'Contract ended');
};

const expireStaleBounties = async () => {
  const now = new Date();
  const staleHunts = await Bounty.find({
    status: { $in: ['HUNTING', 'PRESSURE_SENT'] },
    $or: [
      { huntExpiresAt: { $lte: now } },
      { huntExpiresAt: null }
    ],
    expiresAt: { $gt: now }
  });
  for (const bounty of staleHunts) await reopenExpiredHunt(bounty, now);

  const expired = await Bounty.find({
    status: { $in: OPEN_STATUSES },
    expiresAt: { $lte: now }
  });
  for (const bounty of expired) await refundBounty(bounty, 'Bounty expired');
};

const getHunterProfile = async (userId) => {
  await expireStaleBounties();
  const [bounties, activeHunts] = await Promise.all([
    Bounty.find({ 'attempts.hunterId': userId }).select('amount targetName attempts').lean(),
    Bounty.countDocuments({ hunterId: userId, status: { $in: ['HUNTING', 'PRESSURE_SENT'] } })
  ]);

  const attempts = [];
  for (const bounty of bounties) {
    for (const attempt of bounty.attempts || []) {
      if (String(attempt.hunterId) === String(userId)) attempts.push({ ...attempt, amount: bounty.amount, targetName: bounty.targetName });
    }
  }

  const successful = attempts.filter((attempt) => attempt.outcome === 'CLAIMED');
  const rep = Math.max(0, attempts.reduce((sum, attempt) => sum + (Number(attempt.repDelta) || 0), 0));
  const rank = hunterRankFromRep(rep);
  const fastest = successful.reduce((best, attempt) => {
    const duration = new Date(attempt.endedAt) - new Date(attempt.startedAt);
    if (!Number.isFinite(duration) || duration < 0) return best;
    return best === null || duration < best ? duration : best;
  }, null);

  return {
    rep,
    rank: rank.name,
    nextRankAt: rank.nextAt,
    successfulHunts: successful.length,
    attempts: attempts.length,
    conversionRate: attempts.length ? Math.round((successful.length / attempts.length) * 100) : 0,
    auraCollected: successful.reduce((sum, attempt) => sum + (Number(attempt.amount) || 0), 0),
    fastestHuntMs: fastest,
    activeHunts
  };
};

module.exports = {
  HUNT_WINDOW_HOURS,
  listingFeeFor,
  hunterBondFor,
  getHunterProfile,
  getBountyDecisionRequirement,
  expireStaleBounties,
  refundOpenBountiesForFriendship,
  settleBountiesForCheckin
};
