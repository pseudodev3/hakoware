const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Bounty = require('../models/Bounty');
const User = require('../models/User');

// @route    POST api/bounties
// @desc     Create a new bounty
// @access   Private
router.post('/', auth, async (req, res) => {
  const { targetId, targetName, friendshipId, amount, message, senderName } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (user.auraBalance < amount) {
      return res.status(400).json({ msg: 'INSUFFICIENT AURA BALANCE' });
    }

    const newBounty = new Bounty({
      senderId: req.user.id,
      senderName: senderName || user.displayName,
      targetId,
      targetName,
      friendshipId,
      amount,
      message
    });

    // Deduct Aura from sender
    user.auraBalance -= amount;
    await user.save();

    const bounty = await newBounty.save();
    res.json(bounty);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/bounties/active
// @desc     Get all active bounties
// @access   Private
router.get('/active', auth, async (req, res) => {
  try {
    const bounties = await Bounty.find({ status: 'ACTIVE' }).sort({ createdAt: -1 });
    res.json(bounties);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/bounties/:id/hunt
// @desc     Accept a bounty contract
// @access   Private
router.post('/:id/hunt', auth, async (req, res) => {
  try {
    const bounty = await Bounty.findById(req.params.id);
    if (!bounty) return res.status(404).json({ msg: 'BOUNTY NOT FOUND' });
    if (bounty.status !== 'ACTIVE') return res.status(400).json({ msg: 'BOUNTY NO LONGER ACTIVE' });
    if (bounty.targetId.toString() === req.user.id) return res.status(400).json({ msg: 'CANNOT HUNT YOURSELF' });

    const user = await User.findById(req.user.id);
    
    bounty.status = 'HUNTING';
    bounty.hunterId = req.user.id;
    bounty.hunterName = user.displayName;
    
    await bounty.save();
    res.json(bounty);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
