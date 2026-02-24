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

module.exports = router;
