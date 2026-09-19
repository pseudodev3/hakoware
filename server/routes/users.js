const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const auth = require('../middleware/auth');
const { calculateDebtState } = require('../services/debtState');
const { publicKey } = require('../services/clientViews');

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const actor = await User.findById(req.user.id).select('isTestAccount testOwnerId');
    if (!actor) return res.status(404).json({ msg: 'User not found' });
    const friendshipScope = actor.isTestAccount
      ? { status: 'ACTIVE', isTestData: true, testOwnerId: actor.testOwnerId }
      : { status: 'ACTIVE', isTestData: { $ne: true } };
    const allFriendships = await Friendship.find(friendshipScope);
    const bankruptStats = {};
    const now = new Date();

    allFriendships.forEach((friendship) => {
      const perspectives = [
        { userId: friendship.user1.toString(), perspective: friendship.user1Perspective },
        { userId: friendship.user2.toString(), perspective: friendship.user2Perspective }
      ];

      perspectives.forEach(({ userId, perspective }) => {
        const debt = calculateDebtState(perspective, now);
        if (!bankruptStats[userId]) bankruptStats[userId] = { isBankrupt: false, totalDebt: 0 };
        bankruptStats[userId].totalDebt += debt.totalDebt;
        if (debt.isBankrupt) bankruptStats[userId].isBankrupt = true;
      });
    });

    const bankruptUserIds = Object.keys(bankruptStats).filter((userId) => bankruptStats[userId].isBankrupt);
    const users = await User.find({
      _id: { $in: bankruptUserIds },
      ...(actor.isTestAccount
        ? { isTestAccount: true, testOwnerId: actor.testOwnerId }
        : { isTestAccount: { $ne: true } }),
      'privacySettings.optOutPublicBankruptcy': false
    })
      .select('displayName username avatar')
      .lean();

    const usersWithStats = users
      .map((user) => ({
        _id: publicKey(user._id, 'shame'),
        displayName: user.displayName,
        username: user.username || null,
        avatar: user.avatar || null,
        totalDebt: bankruptStats[user._id.toString()].totalDebt
      }))
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return res.json(usersWithStats);
  } catch (err) {
    console.error('Leaderboard failed:', err.message);
    return res.status(500).json({ msg: 'Could not load the Shame Board' });
  }
});

router.patch('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (typeof req.body.optOutPublicBankruptcy === 'boolean') {
      user.privacySettings.optOutPublicBankruptcy = req.body.optOutPublicBankruptcy;
    }
    await user.save();
    return res.json({ privacySettings: user.privacySettings });
  } catch (err) {
    console.error('Update preferences failed:', err.message);
    return res.status(500).json({ msg: 'Could not update preferences' });
  }
});

module.exports = router;
