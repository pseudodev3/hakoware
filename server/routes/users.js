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
    // 1. Find all friendships where someone is bankrupt
    const allFriendships = await Friendship.find({ status: 'ACTIVE' });
    const bankruptUserIds = new Set();

    const now = new Date();
    allFriendships.forEach(f => {
      // Check user1
      const p1 = f.user1Perspective;
      const d1 = Math.floor(Math.max(0, now - new Date(p1.lastInteraction)) / (1000 * 60 * 60 * 24));
      if ((p1.baseDebt || 0) + Math.max(0, d1 - (p1.limit || 7)) >= (p1.limit || 7) * 2) {
        bankruptUserIds.add(f.user1.toString());
      }
      // Check user2
      const p2 = f.user2Perspective;
      const d2 = Math.floor(Math.max(0, now - new Date(p2.lastInteraction)) / (1000 * 60 * 60 * 24));
      if ((p2.baseDebt || 0) + Math.max(0, d2 - (p2.limit || 7)) >= (p2.limit || 7) * 2) {
        bankruptUserIds.add(f.user2.toString());
      }
    });

    // 2. Fetch user details for those IDs
    const users = await User.find({ 
      _id: { $in: Array.from(bankruptUserIds) },
      'privacySettings.optOutPublicBankruptcy': false 
    })
      .sort({ auraScore: 1 })
      .limit(20)
      .select('displayName avatar auraScore nenType');
      
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
