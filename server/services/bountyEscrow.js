const Bounty = require('../models/Bounty');
const User = require('../models/User');
const AuraTransaction = require('../models/AuraTransaction');
const Notification = require('../models/Notification');
const { recordEvent } = require('./contractGame');

const refundBounty = async (bounty, reason) => {
  const closed = await Bounty.findOneAndUpdate(
    { _id: bounty._id, status: { $in: ['ACTIVE', 'HUNTING'] } },
    { $set: { status: 'EXPIRED' } },
    { new: true }
  );
  if (!closed) return false;

  await User.updateOne({ _id: closed.senderId }, { $inc: { auraBalance: closed.amount } });
  await AuraTransaction.create({
    userId: closed.senderId,
    amount: closed.amount,
    type: 'BOUNTY_REFUND',
    description: `${reason}: ${closed.targetName}`
  });
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
  });
  return true;
};

const payHuntedBounty = async (bounty) => {
  if (!bounty.hunterId) return refundBounty(bounty, 'Bounty closed without a hunter');
  const hunter = await User.findById(bounty.hunterId).select('_id displayName');
  if (!hunter) return refundBounty(bounty, 'Bounty hunter is no longer available');

  const claimed = await Bounty.findOneAndUpdate(
    { _id: bounty._id, status: 'HUNTING' },
    { $set: { status: 'CLAIMED' } },
    { new: true }
  );
  if (!claimed) return false;

  await User.updateOne({ _id: hunter._id }, { $inc: { auraBalance: claimed.amount } });
  await AuraTransaction.create({
    userId: hunter._id,
    amount: claimed.amount,
    type: 'BOUNTY_REWARD',
    description: `Bounty resolved after ${claimed.targetName} checked in`
  });
  await recordEvent(claimed.friendshipId, 'BOUNTY_REWARD', {
    userId: hunter._id,
    aura: claimed.amount,
    metadata: { amount: claimed.amount, targetId: claimed.targetId, targetName: claimed.targetName }
  }).catch(() => null);
  await Notification.create({
    toUserId: hunter._id,
    type: 'BOUNTY_REWARD',
    title: `+${claimed.amount} Aura`,
    message: `${claimed.targetName} checked in and your bounty paid out.`
  });
  return true;
};

const settleBountiesForCheckin = async (friendshipId, targetUserId) => {
  const bounties = await Bounty.find({
    friendshipId,
    targetId: targetUserId,
    status: { $in: ['ACTIVE', 'HUNTING'] }
  });

  for (const bounty of bounties) {
    if (bounty.status === 'HUNTING') await payHuntedBounty(bounty);
    else await refundBounty(bounty, 'Target checked in before a hunter picked up the bounty');
  }
};

const refundOpenBountiesForFriendship = async (friendshipId) => {
  const bounties = await Bounty.find({
    friendshipId,
    status: { $in: ['ACTIVE', 'HUNTING'] }
  });
  for (const bounty of bounties) await refundBounty(bounty, 'Contract ended');
};

const expireStaleBounties = async () => {
  const bounties = await Bounty.find({
    status: { $in: ['ACTIVE', 'HUNTING'] },
    expiresAt: { $lte: new Date() }
  });
  for (const bounty of bounties) await refundBounty(bounty, 'Bounty expired');
};

module.exports = {
  expireStaleBounties,
  refundOpenBountiesForFriendship,
  settleBountiesForCheckin
};
