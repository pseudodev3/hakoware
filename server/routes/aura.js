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
    description: 'Reset your current contract debt. It does not change your grace periods.'
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

const addDailyBonusIfEligible = async (user) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const existing = await AuraTransaction.findOne({
    userId: user._id,
    type: 'DAILY_BONUS',
    createdAt: { $gte: startOfDay }
  });
  if (existing) return 0;

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

  const amount = 10;
  user.auraBalance += amount;
  await user.save();
  await AuraTransaction.create({
    userId: user._id,
    amount,
    type: 'DAILY_BONUS',
    description: 'Daily clean-contract bonus'
  });
  return amount;
};

const buildAuraSummary = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const hasWelcome = await AuraTransaction.exists({ userId: user._id, type: 'WELCOME_BONUS' });
  if (!hasWelcome) {
    user.auraBalance += 100;
    await user.save();
    await AuraTransaction.create({
      userId: user._id,
      amount: 100,
      type: 'WELCOME_BONUS',
      description: 'Welcome to Hakoware'
    });
  }

  await addDailyBonusIfEligible(user);

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
    balance: user.auraBalance || 0,
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

// Kept temporarily for older clients, but it can only read the authenticated account.
router.get('/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user.id) return res.status(403).json({ msg: 'Not authorized' });
    const summary = await buildAuraSummary(req.user.id);
    if (!summary) return res.status(404).json({ msg: 'User not found' });
    return res.json(summary);
  } catch (err) {
    console.error('Aura summary failed:', err.message);
    return res.status(500).json({ msg: 'Could not load Aura' });
  }
});

router.post('/initialize', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const exists = await AuraTransaction.exists({ userId: user._id, type: 'WELCOME_BONUS' });
    if (exists) return res.json({ success: true, balance: user.auraBalance });

    user.auraBalance += 100;
    await user.save();
    await AuraTransaction.create({
      userId: user._id,
      amount: 100,
      type: 'WELCOME_BONUS',
      description: 'Welcome to Hakoware'
    });
    return res.json({ success: true, balance: user.auraBalance });
  } catch (err) {
    console.error('Aura initialization failed:', err.message);
    return res.status(500).json({ msg: 'Could not initialize Aura' });
  }
});

router.post('/buy-card', auth, async (req, res) => {
  try {
    const card = CARD_CATALOG[String(req.body.cardId || '').toUpperCase()];
    if (!card) return res.status(400).json({ msg: 'Unknown card' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.auraBalance < card.cost) return res.status(400).json({ msg: 'Not enough Aura' });

    user.auraBalance -= card.cost;
    user.inventory.push(card.id);
    await user.save();
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
      for (const friendship of friendships) {
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
      if (amount > 0) {
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
