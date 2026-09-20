const Bounty = require('../models/Bounty');

const DAY = 24 * 60 * 60 * 1000;
const MAX_BOUNTY = 500;
const OPEN_STATUSES = ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'];

const WANTED_BOUNTY_BY_LEVEL = Object.freeze({
  1: 25,
  2: 35,
  3: 50,
  4: 70,
  5: 100
});

const clampChaosLevel = (level) => Math.max(1, Math.min(5, Number(level) || 1));
const chaosBountyAmountForLevel = (level) => WANTED_BOUNTY_BY_LEVEL[clampChaosLevel(level)];

const partnerEscrowAmount = (bounty) => {
  const explicit = Number(bounty?.partnerAmount) || 0;
  if (explicit > 0) return explicit;

  const chaosAmount = Number(bounty?.chaosAmount) || 0;
  const total = Number(bounty?.amount) || 0;
  if (chaosAmount > 0) return Math.max(0, total - chaosAmount);
  return bounty?.senderId ? total : 0;
};

const bountySourceFor = (chaosAmount, partnerAmount) => {
  if (chaosAmount > 0 && partnerAmount > 0) return 'COMBINED';
  if (chaosAmount > 0) return 'CHAOS';
  return 'PLAYER';
};

const wantedStateFor = (wantedUntil, now = new Date()) => {
  if (!wantedUntil) return null;
  return new Date(wantedUntil).getTime() <= now.getTime() ? 'MOST_WANTED' : 'WANTED';
};

const wantedTargetName = (friendship, targetId) => (
  String(friendship.user1) === String(targetId)
    ? friendship.user1DisplayName
    : friendship.user2DisplayName
) || 'Hakoware player';

const ensureWantedBounty = async (friendship, now = new Date()) => {
  const targetId = friendship?.chaos?.wantedUserId;
  if (!friendship?._id || !targetId) return null;

  const level = clampChaosLevel(friendship.chaos.level);
  const wantedUntil = friendship.chaos.wantedUntil;
  const consequence = friendship.chaos.lastConsequence || 'Chaos failure';
  const targetName = wantedTargetName(friendship, targetId);
  const systemAmount = chaosBountyAmountForLevel(level);
  const seasonEnd = friendship.season?.endsAt ? new Date(friendship.season.endsAt) : new Date(now.getTime() + 30 * DAY);

  const existing = await Bounty.findOne({
    friendshipId: friendship._id,
    targetId,
    status: { $in: OPEN_STATUSES }
  });

  if (existing) {
    const currentTotal = Number(existing.amount) || 0;
    const currentChaos = Number(existing.chaosAmount) || 0;
    const partnerAmount = partnerEscrowAmount(existing);
    const chaosToAdd = currentChaos > 0 ? 0 : Math.min(systemAmount, Math.max(0, MAX_BOUNTY - currentTotal));
    const nextChaos = currentChaos + chaosToAdd;
    const nextTotal = currentTotal + chaosToAdd;
    const nextExpiry = existing.expiresAt && new Date(existing.expiresAt) > seasonEnd
      ? existing.expiresAt
      : seasonEnd;

    return Bounty.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          amount: nextTotal,
          source: bountySourceFor(nextChaos, partnerAmount),
          chaosAmount: nextChaos,
          partnerAmount,
          chaosLevel: level,
          wantedUntil,
          wantedConsequence: consequence,
          expiresAt: nextExpiry
        }
      },
      { new: true }
    );
  }

  return Bounty.create({
    senderId: null,
    senderName: 'Hakoware',
    targetId,
    targetName,
    friendshipId: friendship._id,
    isTestData: Boolean(friendship.isTestData),
    testOwnerId: friendship.testOwnerId || null,
    amount: systemAmount,
    source: 'CHAOS',
    chaosAmount: systemAmount,
    partnerAmount: 0,
    chaosLevel: level,
    wantedUntil,
    wantedConsequence: consequence,
    listingFee: 0,
    message: `${consequence}. Hakoware put a Chaos bounty on this check-in.`,
    expiresAt: seasonEnd
  });
};

module.exports = {
  MAX_BOUNTY,
  WANTED_BOUNTY_BY_LEVEL,
  chaosBountyAmountForLevel,
  partnerEscrowAmount,
  bountySourceFor,
  wantedStateFor,
  ensureWantedBounty
};
