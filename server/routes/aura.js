const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const AuraTransaction = require('../models/AuraTransaction');

// @route    GET api/aura/:userId
// @desc     Get aura balance and history
// @access   Private
router.get('/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const history = await AuraTransaction.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    // Calculate stats
    const totalEarned = await AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalSpent = await AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const earningsByType = await AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $gt: 0 } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } }
    ]);

    const stats = {};
    earningsByType.forEach(item => stats[item._id] = item.total);

    res.json({
      balance: user.auraBalance || 0,
      totalEarned: totalEarned.length > 0 ? totalEarned[0].total : 0,
      totalSpent: totalSpent.length > 0 ? Math.abs(totalSpent[0].total) : 0,
      totalTransactions: await AuraTransaction.countDocuments({ userId: user._id }),
      earningsByType: stats,
      history
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/aura/initialize
// @desc     Initialize aura for new user
// @access   Private
router.post('/initialize', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Check if already initialized (has transactions or non-zero balance)
    const count = await AuraTransaction.countDocuments({ userId: user._id });
    if (count > 0) return res.json({ msg: 'Already initialized' });

    // Initial gift
    const amount = 100;
    user.auraBalance = amount;
    await user.save();

    const transaction = new AuraTransaction({
      userId: user._id,
      amount,
      type: 'WELCOME_BONUS',
      description: 'Welcome to Hakoware! Initial Aura gift.'
    });

    await transaction.save();
    res.json({ success: true, balance: user.auraBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/aura/buy-card
// @desc     Buy a spell card
// @access   Private
router.post('/buy-card', auth, async (req, res) => {
  const { cardId, cardName, cost } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.auraBalance < cost) return res.status(400).json({ msg: 'INSUFFICIENT AURA' });

    user.auraBalance -= cost;
    user.inventory.push(cardId);
    await user.save();

    const transaction = new AuraTransaction({
      userId: user._id,
      amount: -cost,
      type: 'MARKETPLACE_PURCHASE',
      description: `Purchased spell card: ${cardName}`
    });

    await transaction.save();
    res.json({ success: true, balance: user.auraBalance, inventory: user.inventory });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/aura/use-card
// @desc     Use a spell card
// @access   Private
router.post('/use-card', auth, async (req, res) => {
  const { cardId, index, targetFriendshipId } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    // Check if user has the card
    if (!user.inventory.includes(cardId)) {
      return res.status(400).json({ msg: 'CARD NOT FOUND IN INVENTORY' });
    }

    if (cardId === 'PURIFY') {
      const Friendship = require('../models/Friendship');
      // Reset all debts for this user
      const friendships = await Friendship.find({
        $or: [{ user1: req.user.id }, { user2: req.user.id }]
      });

      for (const f of friendships) {
        const isUser1 = f.user1.toString() === req.user.id;
        const pKey = isUser1 ? 'user1Perspective' : 'user2Perspective';
        f[pKey].baseDebt = 0;
        f[pKey].lastInteraction = new Date();
        f[pKey].calculatedDebt = 0;
        await f.save();
      }
    }

    // Remove one instance of the card
    const cardIndex = user.inventory.indexOf(cardId);
    if (cardIndex > -1) {
      user.inventory.splice(cardIndex, 1);
    }
    
    await user.save();

    res.json({ success: true, inventory: user.inventory });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
