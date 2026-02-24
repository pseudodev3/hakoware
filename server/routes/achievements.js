const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const UserAchievement = require('../models/UserAchievement');

// @route    GET api/achievements/:userId
// @desc     Get user achievements
// @access   Private
router.get('/:userId', auth, async (req, res) => {
  try {
    let achievement = await UserAchievement.findOne({ userId: req.params.userId });
    if (!achievement) {
      // Auto-initialize if not found
      achievement = new UserAchievement({ userId: req.params.userId });
      await achievement.save();
    }
    res.json(achievement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/achievements/initialize
// @desc     Initialize achievements for user
// @access   Private
router.post('/initialize', auth, async (req, res) => {
  try {
    let achievement = await UserAchievement.findOne({ userId: req.user.id });
    if (achievement) return res.json({ msg: 'Already initialized' });

    achievement = new UserAchievement({ userId: req.user.id });
    await achievement.save();
    res.json(achievement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
