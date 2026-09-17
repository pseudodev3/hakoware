const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const AuraTransaction = require('../models/AuraTransaction');

const CARD_CATALOG = Object.freeze({
  PURIFY: {
    id: 'PURIFY',
    name: 'Clean Slate',
    cost: 120,
    description: 'Reset your debt across every active contract. Grace periods do not change.'
  },
  STEAL: {
    id: 'STEAL',
    name: 'Claim',
    cost: 180,
    description: 'Take 10% Aura from a contract partner who is currently bankrupt.'
  }
});

const calculateDebt = (perspective, now = new Date()) => {
  const limit = Number(perspective?.limit) || 7;
  const lastInteraction = new Date(perspective?.lastInteraction || now);
  const daysMissed = Math.floor(Math.max(0, now - lastInteraction) / 86400000);
  return (perspective?.baseDebt || 0) + Math.max(0, daysMissed - limit);
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
  if (!user) return 0;
  if (user.lastDailyAuraBonusKey === key) return 0;

  const startOfDay = new Date(`${key}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
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
    return calculateDebt(perspective, now) === 0;
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

  const [history, earned, spent, count] = await Promise.all([
    AuraTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(40),
    AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.countDocuments({ userId: user._id })
  ]);

  return {
    balance: Number(user.auraBalance) || 0,
    totalEarned: earned[0]?.total || 0,
    totalSpent: Math.abs(spent[0]?.total || 0),
    totalTransactions: count,
    history
  };
};

router.get('/me', auth, async (req, res) => {
  try {
    const summary = await buildAuraSummary(req.user.id);
    if (!summary) return res.status(404).json({ msg: 'User not found' });
    return res.json(summary);
  } catch (err) {
    console.error('Aura summary failed:', err.message);
    return res.status(500).json({ msg: 'Could not load Aura' });
  }
});

router.get('/cards', auth, (req, res) => {
  res.json(Object.values(CARD_CATALOG));
});

router.post('/buy-card', auth, async (req, res) => {
  try {
    const card = CARD_CATALOG[String(req.body.cardId || '').toUpperCase()];
    if (!card) return res.status(400).json({ msg: 'Unknown card' });

    const user = await User.findOneAndUpdate(
      { _id: req.user.id, auraBalance: { $gte: card.cost } },
      { $inc: { auraBalance: -card.cost }, $push: { inventory: card.id } },
      { new: true }
    );

    if (!user) {
      const exists = await User.exists({ _id: req.user.id });
      return res.status(exists ? 400 : 404).json({ msg: exists ? 'Not enough Aura' : 'User not found' });
    }

    await AuraTransaction.create({
      userId: user._id,
      amount: -card.cost,
      type: 'MARKETPLACE_PURCHASE',
      description: `Purchased ${card.name}`
    });

    return res.json({ success: true, balance: user.auraBalance, inventory: user.inventory, card });
  } catch (err) {
    console.error('Card purchase failed:', err.message);
    return res.status(500).json({ msg: 'Could not purchase card' });
  }
});

router.post('/use-card', auth, async (req, res) => {
  try {
    const cardId = String(req.body.cardId || '').toUpperCase();
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!CARD_CATALOG[cardId]) return res.status(400).json({ msg: 'Unknown card' });
    if (!user.inventory.includes(cardId)) return res.status(400).json({ msg: 'Card not found in inventory' });

    if (cardId === 'PURIFY') {
      const friendships = await Friendship.find({
        $or: [{ user1: user._id }, { user2: user._id }],
        status: 'ACTIVE'
      });
      const now = new Date();
      const withDebt = friendships.filter((friendship) => {
        const isUser1 = friendship.user1.toString() === req.user.id;
        const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
        return calculateDebt(perspective, now) > 0;
      });
      if (withDebt.length === 0) return res.status(400).json({ msg: 'You do not have any debt to clear' });

      for (const friendship of withDebt) {
        const isUser1 = friendship.user1.toString() === req.user.id;
        const key = isUser1 ? 'user1Perspective' : 'user2Perspective';
        friendship[key].baseDebt = 0;
        friendship[key].lastInteraction = now;
        friendship[key].calculatedDebt = 0;
        friendship[key].daysMissed = 0;
        friendship[key].isBankrupt = false;
        friendship[key].isInWarningZone = false;
        await friendship.save();
      }
    }

    if (cardId === 'STEAL') {
      const friendship = await Friendship.findById(req.body.targetFriendshipId);
      if (!friendship || friendship.status !== 'ACTIVE') return res.status(404).json({ msg: 'Contract not found' });

      const isUser1 = friendship.user1.toString() === req.user.id;
      const isUser2 = friendship.user2.toString() === req.user.id;
      if (!isUser1 && !isUser2) return res.status(403).json({ msg: 'Not authorized' });

      const targetId = isUser1 ? friendship.user2 : friendship.user1;
      const targetPerspective = isUser1 ? friendship.user2Perspective : friendship.user1Perspective;
      const targetLimit = Number(targetPerspective.limit) || 7;
      if (calculateDebt(targetPerspective) < targetLimit * 2) {
        return res.status(400).json({ msg: 'This contract partner is not bankrupt' });
      }

      const target = await User.findById(targetId);
      if (!target) return res.status(404).json({ msg: 'Target not found' });
      const amount = Math.floor((target.auraBalance || 0) * 0.1);
      if (amount <= 0) return res.status(400).json({ msg: 'There is no Aura to claim from this partner' });

      target.auraBalance -= amount;
      user.auraBalance += amount;
      await target.save();
      await AuraTransaction.create({
        userId: target._id,
        amount: -amount,
        type: 'SPELL_EFFECT',
        description: `Aura claimed by ${user.displayName}`
      });
      await AuraTransaction.create({
        userId: user._id,
        amount,
        type: 'SPELL_EFFECT',
        description: `Claimed Aura from ${target.displayName}`
      });
    }

    const cardIndex = user.inventory.indexOf(cardId);
    user.inventory.splice(cardIndex, 1);
    await user.save();
    return res.json({ success: true, balance: user.auraBalance, inventory: user.inventory });
  } catch (err) {
    console.error('Use card failed:', err.message);
    return res.status(500).json({ msg: 'Could not use card' });
  }
});

module.exports = router;
