const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const auth = require('../middleware/auth');

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const allFriendships = await Friendship.find({ status: 'ACTIVE' });
    const bankruptStats = {};
    const now = new Date();

    allFriendships.forEach((friendship) => {
      const perspectives = [
        { userId: friendship.user1.toString(), perspective: friendship.user1Perspective },
        { userId: friendship.user2.toString(), perspective: friendship.user2Perspective }
      ];

      perspectives.forEach(({ userId, perspective }) => {
        const lastInteraction = new Date(perspective.lastInteraction || 0);
        const daysMissed = Math.floor(Math.max(0, now - lastInteraction) / 86400000);
        const limit = perspective.limit || 7;
        const totalDebt = (perspective.baseDebt || 0) + Math.max(0, daysMissed - limit);
        if (!bankruptStats[userId]) bankruptStats[userId] = { isBankrupt: false, totalDebt: 0 };
        bankruptStats[userId].totalDebt += totalDebt;
        if (totalDebt >= limit * 2) bankruptStats[userId].isBankrupt = true;
      });
    });

    const bankruptUserIds = Object.keys(bankruptStats).filter((userId) => bankruptStats[userId].isBankrupt);
    const users = await User.find({
      _id: { $in: bankruptUserIds },
      'privacySettings.optOutPublicBankruptcy': false
    })
      .select('displayName avatar auraScore nenType')
      .lean();

    const usersWithStats = users
      .map((user) => ({ ...user, totalDebt: bankruptStats[user._id.toString()].totalDebt }))
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return res.json(usersWithStats);
  } catch (err) {
    console.error('Leaderboard failed:', err.message);
    return res.status(500).json({ msg: 'Could not load the Shame Board' });
  }
});

router.get('/hunters', auth, async (req, res) => {
  try {
    const hunterCount = await User.countDocuments({ nenType: { $ne: null } });
    return res.json({ count: hunterCount });
  } catch (err) {
    console.error('Hunter count failed:', err.message);
    return res.status(500).json({ msg: 'Could not load hunter count' });
  }
});

router.patch('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    for (const key of ['hideAuraScore', 'optOutLeaderboard', 'optOutPublicBankruptcy']) {
      if (typeof req.body[key] === 'boolean') user.privacySettings[key] = req.body[key];
    }
    await user.save();
    return res.json({ privacySettings: user.privacySettings });
  } catch (err) {
    console.error('Update preferences failed:', err.message);
    return res.status(500).json({ msg: 'Could not update preferences' });
  }
});

module.exports = router;
