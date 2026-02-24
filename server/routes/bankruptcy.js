const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
// We'll need a model for MercyRequests soon, but for now let's return empty arrays 
// to stop the frontend from crashing.

// @route    GET api/bankruptcy/mercy-requests/pending
// @desc     Get pending mercy requests
router.get('/mercy-requests/pending', auth, async (req, res) => {
  try {
    // Return empty for now to stop crash
    res.json([]);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route    GET api/bankruptcy/bailouts/user/:userId
// @desc     Get bailout history
router.get('/bailouts/user/:userId', auth, async (req, res) => {
  try {
    res.json([]);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route    GET api/bankruptcy/active
// @desc     Get active bankruptcies for Shame Wall
router.get('/active', auth, async (req, res) => {
  try {
    res.json([]);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
