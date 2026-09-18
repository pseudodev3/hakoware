const User = require('../models/User');
const Friendship = require('../models/Friendship');
const AuraTransaction = require('../models/AuraTransaction');
const { calculateDebtState } = require('./debtState');

const DAY = 24 * 60 * 60 * 1000;

const auraRankFromEarned = (earned = 0) => {
  const value = Math.max(0, Number(earned) || 0);
  const ranks = [
    { name: 'Spark', floor: 0, next: 250 },
    { name: 'Charged', floor: 250, next: 750 },
    { name: 'Radiant', floor: 750, next: 2000 },
    { name: 'Overflow', floor: 2000, next: 5000 },
    { name: 'Ascendant', floor: 5000, next: null }
  ];
  const rank = [...ranks].reverse().find((item) => value >= item.floor) || ranks[0];
  const progress = rank.next
    ? Math.max(0, Math.min(100, Math.round(((value - rank.floor) / (rank.next - rank.floor)) * 100)))
    : 100;

  return {
    name: rank.name,
    lifetimeEarned: value,
    nextRankAt: rank.next,
    progress
  };
};

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const ensureWelcomeBonus = async (userId) => {
  let user = await User.findById(userId);
  if (!user) return null;

  const existing = await AuraTransaction.findOne({ userId: user._id, type: 'WELCOME_BONUS' });
  if (existing) {
    if (!user.welcomeAuraGranted) {
      await User.updateOne({ _id: user._id }, { $set: { welcomeAuraGranted: true } });
      user.welcomeAuraGranted = true;
    }

    if (!existing.idempotencyKey) {
      try {
        existing.idempotencyKey = `welcome:${user._id}`;
        await existing.save();
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
    return user;
  }

  if (user.welcomeAuraGranted) {
    try {
      await AuraTransaction.create({
        userId: user._id,
        amount: 100,
        type: 'WELCOME_BONUS',
        description: 'Welcome to Hakoware',
        idempotencyKey: `welcome:${user._id}`
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    return user;
  }

  const granted = await User.findOneAndUpdate(
    { _id: user._id, welcomeAuraGranted: { $ne: true } },
    { $inc: { auraBalance: 100 }, $set: { welcomeAuraGranted: true } },
    { new: true }
  );

  if (granted) {
    try {
      await AuraTransaction.create({
        userId: granted._id,
        amount: 100,
        type: 'WELCOME_BONUS',
        description: 'Welcome to Hakoware',
        idempotencyKey: `welcome:${granted._id}`
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    return granted;
  }

  return User.findById(userId);
};

const addDailyBonusIfEligible = async (userId) => {
  const now = new Date();
  const key = dayKey(now);
  const user = await User.findById(userId);
  if (!user || user.lastDailyAuraBonusKey === key) return 0;

  const startOfDay = new Date(`${key}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay.getTime() + DAY);
  const existing = await AuraTransaction.findOne({
    userId: user._id,
    type: 'DAILY_BONUS',
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  if (existing) {
    await User.updateOne({ _id: user._id }, { $set: { lastDailyAuraBonusKey: key } });

    if (!existing.idempotencyKey) {
      try {
        existing.idempotencyKey = `daily:${user._id}:${key}`;
        await existing.save();
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
    return 0;
  }

  const friendships = await Friendship.find({
    $or: [{ user1: user._id }, { user2: user._id }],
    status: 'ACTIVE'
  });

  if (friendships.length === 0) return 0;

  const debtFree = friendships.every((friendship) => {
    const isUser1 = friendship.user1.toString() === user._id.toString();
    const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    return calculateDebtState(perspective, now).totalDebt === 0;
  });

  if (!debtFree) return 0;

  const updated = await User.findOneAndUpdate(
    { _id: user._id, lastDailyAuraBonusKey: { $ne: key } },
    { $inc: { auraBalance: 10 }, $set: { lastDailyAuraBonusKey: key } },
    { new: true }
  );
  if (!updated) return 0;

  try {
    await AuraTransaction.create({
      userId: updated._id,
      amount: 10,
      type: 'DAILY_BONUS',
      description: 'Daily clean-contract bonus',
      idempotencyKey: `daily:${updated._id}:${key}`
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  return 10;
};

const buildAuraSummary = async (userId) => {
  let user = await ensureWelcomeBonus(userId);
  if (!user) return null;

  await addDailyBonusIfEligible(user._id);
  user = await User.findById(user._id);

  const [history, earned, spent, reputationEarned, count] = await Promise.all([
    AuraTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(40),
    AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.aggregate([
      {
        $match: {
          userId: user._id,
          amount: { $gt: 0 },
          type: { $nin: ['BOUNTY_REFUND', 'HUNTER_BOND_RETURN', 'REVENGE_STEAL'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.countDocuments({ userId: user._id })
  ]);

  const lifetimeEarned = reputationEarned[0]?.total || 0;
  return {
    balance: Number(user.auraBalance) || 0,
    totalEarned: earned[0]?.total || 0,
    totalSpent: Math.abs(spent[0]?.total || 0),
    totalTransactions: count,
    reputation: auraRankFromEarned(lifetimeEarned),
    history
  };
};

module.exports = {
  auraRankFromEarned,
  buildAuraSummary
};
