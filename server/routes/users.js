const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const auth = require('../middleware/auth');

// @route    GET api/users/leaderboard
// @desc     Get the Chimera Ant Selection (Users who are currently bankrupt)
// @access   Private
router.get('/leaderboard', auth, async (req, res) => {
  try {
    // 1. Find all active friendships
    const allFriendships = await Friendship.find({ status: 'ACTIVE' });
    const bankruptStats = {}; // Map of userId -> { isBankrupt: boolean, totalDebt: number }

    const now = new Date();
    allFriendships.forEach(f => {
      const perspectives = [
        { userId: f.user1.toString(), p: f.user1Perspective },
        { userId: f.user2.toString(), p: f.user2Perspective }
      ];

      perspectives.forEach(({ userId, p }) => {
        const lastInteraction = new Date(p.lastInteraction || 0);
        const daysMissed = Math.floor(Math.max(0, now - lastInteraction) / (1000 * 60 * 60 * 24));
        const limit = p.limit || 7;
        const totalDebt = (p.baseDebt || 0) + Math.max(0, daysMissed - limit);
        
        if (!bankruptStats[userId]) {
          bankruptStats[userId] = { isBankrupt: false, totalDebt: 0 };
        }
        
        bankruptStats[userId].totalDebt += totalDebt;
        if (totalDebt >= limit * 2) {
          bankruptStats[userId].isBankrupt = true;
        }
      });
    });

    // 2. Filter IDs of users who are actually bankrupt
    const bankruptUserIds = Object.keys(bankruptStats).filter(uid => bankruptStats[uid].isBankrupt);

    // 3. Fetch user details
    const users = await User.find({ 
      _id: { $in: bankruptUserIds },
      'privacySettings.optOutPublicBankruptcy': false 
    })
      .select('displayName avatar auraScore nenType')
      .lean();
      
    // 4. Attach the calculated debt stats
    const usersWithStats = users.map(u => ({
      ...u,
      totalDebt: bankruptStats[u._id.toString()].totalDebt
    })).sort((a, b) => b.totalDebt - a.totalDebt); // Rank by highest debt first
      
    res.json(usersWithStats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
