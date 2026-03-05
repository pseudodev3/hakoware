const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route    GET api/users/leaderboard
// @desc     Get the Chimera Ant Selection (Users with lowest Aura Score)
// @access   Private
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const users = await User.find({ 'privacySettings.optOutPublicBankruptcy': false })
      .sort({ auraScore: 1 }) // Lowest score first
      .limit(10)
      .select('displayName avatar auraScore nenType');
      
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
