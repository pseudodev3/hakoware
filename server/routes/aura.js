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

    // --- DAILY PASSIVE AURA GENERATION ---
    const now = new Date();
    const lastGeneration = user.updatedAt; // Using updatedAt as a proxy for last visit for now, but we'll check transactions
    const lastDailyTx = await AuraTransaction.findOne({
      userId: user._id,
      type: 'DAILY_BONUS',
      createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
    });

    if (!lastDailyTx) {
      // 1. Check if user is debt-free (Social Health)
      const Friendship = require('../models/Friendship');
      const friendships = await Friendship.find({ $or: [{ user1: user._id }, { user2: user._id }] });
      
      let isDebtFree = true;
      for (const f of friendships) {
        const isU1 = f.user1.toString() === user._id.toString();
        const p = isU1 ? f.user1Perspective : f.user2Perspective;
        const d = Math.floor(Math.max(0, now - new Date(p.lastInteraction)) / (1000 * 60 * 60 * 24));
        if ((p.baseDebt || 0) + Math.max(0, d - (p.limit || 7)) > 0) {
          isDebtFree = false;
          break;
        }
      }

      if (isDebtFree) {
        let dailyAmount = 10; // Base healthy bonus
        
        // Nen Affinity Passives
        if (user.nenType === 'ENHANCER') dailyAmount += 15; // +15 extra for Enhancers
        if (user.nenType === 'SPECIALIST') dailyAmount += 5; // +5 for Specialists (random factor handled simply)

        user.auraBalance += dailyAmount;
        await user.save();

        const bonusTx = new AuraTransaction({
          userId: user._id,
          amount: dailyAmount,
          type: 'DAILY_BONUS',
          description: `Daily Social Health Bonus (${user.nenType || 'HUNTER'})`
        });
        await bonusTx.save();
      }
    }
    // ---------------------------------------

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

    // Calculate weekly change
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyTransactions = await AuraTransaction.find({
      userId: user._id,
      createdAt: { $gte: sevenDaysAgo }
    });

    const netChange = weeklyTransactions.reduce((acc, tx) => acc + tx.amount, 0);
    const previousBalance = (user.auraBalance || 0) - netChange;
    const weeklyChangePercent = previousBalance > 0 
      ? Math.round((netChange / previousBalance) * 100) 
      : netChange > 0 ? 100 : 0;

    res.json({
      balance: user.auraBalance || 0,
      totalEarned: totalEarned.length > 0 ? totalEarned[0].total : 0,
      totalSpent: totalSpent.length > 0 ? Math.abs(totalSpent[0].total) : 0,
      totalTransactions: await AuraTransaction.countDocuments({ userId: user._id }),
      earningsByType: stats,
      weeklyChangePercent,
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

    if (cardId === 'STEAL') {
      const Friendship = require('../models/Friendship');
      const targetFriendship = await Friendship.findById(targetFriendshipId);
      if (!targetFriendship) return res.status(404).json({ msg: 'TARGET NOT FOUND' });

      const isUser1 = targetFriendship.user1.toString() === req.user.id;
      const targetId = isUser1 ? targetFriendship.user2 : targetFriendship.user1;
      const targetUser = await User.findById(targetId);
      
      if (!targetUser) return res.status(404).json({ msg: 'TARGET USER NOT FOUND' });

      // Check if target is actually bankrupt
      const pKey = isUser1 ? 'user2Perspective' : 'user1Perspective';
      const p = targetFriendship[pKey];
      const daysMissed = Math.floor(Math.max(0, new Date() - new Date(p.lastInteraction)) / (1000 * 60 * 60 * 24));
      const totalDebt = (p.baseDebt || 0) + Math.max(0, daysMissed - (p.limit || 7));
      
      if (totalDebt < (p.limit || 7) * 2) {
        return res.status(400).json({ msg: 'TARGET IS NOT BANKRUPT' });
      }

      const stealAmount = Math.floor(targetUser.auraBalance * 0.1);
      targetUser.auraBalance -= stealAmount;
      user.auraBalance += stealAmount;
      
      await targetUser.save();
      
      const stealTx = new AuraTransaction({
        userId: targetUser._id,
        amount: -stealAmount,
        type: 'SPELL_EFFECT',
        description: `Aura stolen by ${user.displayName} (THIEF SPELL)`
      });
      await stealTx.save();

      const gainTx = new AuraTransaction({
        userId: user._id,
        amount: stealAmount,
        type: 'SPELL_EFFECT',
        description: `Stole aura from ${targetUser.displayName} (THIEF SPELL)`
      });
      await gainTx.save();
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
