const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const Bounty = require('../models/Bounty');

// @route    POST api/friendships
// @desc     Create a new friendship (Contract)
// @access   Private
router.post('/', auth, async (req, res) => {
  const { friendEmail, limit } = req.body;

  try {
    const friend = await User.findOne({ email: friendEmail });
    if (!friend) {
      return res.status(404).json({ msg: 'Friend not found' });
    }

    if (friend.id === req.user.id) {
      return res.status(400).json({ msg: 'You cannot friend yourself' });
    }

    // Check if friendship already exists
    let friendship = await Friendship.findOne({
      $or: [
        { user1: req.user.id, user2: friend.id },
        { user1: friend.id, user2: req.user.id }
      ]
    });

    if (friendship) {
      return res.status(400).json({ msg: 'Friendship already exists' });
    }

    const user = await User.findById(req.user.id);

    friendship = new Friendship({
      user1: req.user.id,
      user2: friend.id,
      user1DisplayName: user.displayName,
      user2DisplayName: friend.displayName,
      user1Perspective: { limit: limit || user.defaultLimit },
      user2Perspective: { limit: friend.defaultLimit },
      status: 'ACTIVE' // For now, auto-accept
    });

    await friendship.save();

    // Update Hunter Exam Progress
    user.examTasks.friendAdded = true;
    if (user.examTasks.nenTypeSet && user.examTasks.voiceNoteSent) {
      user.hunterLicense = true;
    }
    await user.save();

    res.json(friendship);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    GET api/friendships
// @desc     Get all friendships for a user
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ user1: req.user.id }, { user2: req.user.id }]
    }).populate('user1 user2', 'displayName email avatar auraScore nenType');
    
    res.json(friendships);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Helper function to calculate debt
const calculateDebt = (perspective, now = new Date()) => {
  const lastInteraction = new Date(perspective.lastInteraction);
  const diffTime = Math.abs(now - lastInteraction);
  const daysMissed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const daysOverLimit = Math.max(0, daysMissed - perspective.limit);
  const totalDebt = (perspective.baseDebt || 0) + daysOverLimit;
  
  const bankruptcyLimit = perspective.limit * 2;
  const isBankrupt = totalDebt >= bankruptcyLimit;
  
  return {
    totalDebt,
    daysMissed,
    isBankrupt,
    daysUntilBankrupt: Math.max(0, bankruptcyLimit - totalDebt)
  };
};

// @route    POST api/friendships/:id/checkin
// @desc     Perform a check-in
// @access   Private
router.post('/:id/checkin', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Friendship not found' });

    const isUser1 = friendship.user1.toString() === req.user.id;
    const perspectiveKey = isUser1 ? 'user1Perspective' : 'user2Perspective';
    
    const now = new Date();
    const lastInteraction = new Date(friendship[perspectiveKey].lastInteraction);
    const hoursSince = (now - lastInteraction) / (1000 * 60 * 60);

    if (hoursSince < 20) {
      return res.status(400).json({ msg: 'Already checked in today' });
    }

    // Reset debt and update lastInteraction
    friendship[perspectiveKey].baseDebt = 0;
    friendship[perspectiveKey].lastInteraction = now;
    friendship[perspectiveKey].calculatedDebt = 0;
    friendship.streak += 1;

    await friendship.save();

    // BOUNTY CLAIM LOGIC
    // If there were bounties on the user who just checked in, they are now 'Claimed'
    const activeBounties = await Bounty.find({ targetId: req.user.id, status: { $in: ['ACTIVE', 'HUNTING'] } });
    
    for (const bounty of activeBounties) {
      bounty.status = 'CLAIMED';
      await bounty.save();
      
      // Reward the hunter if one was assigned, otherwise reward the first person who might have nudged (simulated)
      if (bounty.hunterId) {
        const hunter = await User.findById(bounty.hunterId);
        if (hunter) {
          hunter.auraBalance += bounty.amount;
          await hunter.save();
        }
      }
    }

    res.json(friendship);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    PUT api/friendships/:id/limit
// @desc     Update friendship limit
// @access   Private
router.put('/:id/limit', auth, async (req, res) => {
  try {
    const { limit } = req.body;
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Friendship not found' });

    const isUser1 = friendship.user1.toString() === req.user.id;
    const perspectiveKey = isUser1 ? 'user1Perspective' : 'user2Perspective';
    
    friendship[perspectiveKey].limit = limit;
    await friendship.save();
    
    res.json(friendship);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/friendships/:id
// @desc     Delete a friendship
// @access   Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Friendship not found' });

    // Check if user is part of the friendship
    if (friendship.user1.toString() !== req.user.id && friendship.user2.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await friendship.deleteOne();
    res.json({ msg: 'Friendship removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
