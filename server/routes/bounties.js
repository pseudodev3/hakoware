const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Bounty = require('../models/Bounty');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const AuraTransaction = require('../models/AuraTransaction');
const Notification = require('../models/Notification');
const { expireStaleBounties } = require('../services/bountyEscrow');
const { recordEvent } = require('../services/contractGame');

router.post('/', auth, async (req, res) => {
  try {
    await expireStaleBounties();
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount < 10 || amount > 500) {
      return res.status(400).json({ msg: 'Bounty must be between 10 and 500 Aura' });
    }

    const friendship = await Friendship.findById(req.body.friendshipId);
    if (!friendship || friendship.status !== 'ACTIVE') {
      return res.status(404).json({ msg: 'Active contract not found' });
    }

    const isUser1 = friendship.user1.toString() === req.user.id;
    const isUser2 = friendship.user2.toString() === req.user.id;
    if (!isUser1 && !isUser2) return res.status(403).json({ msg: 'Not authorized' });

    const targetId = isUser1 ? friendship.user2 : friendship.user1;
    const target = await User.findById(targetId).select('_id displayName');
    if (!target) return res.status(404).json({ msg: 'User not found' });

    const existing = await Bounty.findOne({
      senderId: req.user.id,
      targetId: target._id,
      friendshipId: friendship._id,
      status: { $in: ['ACTIVE', 'HUNTING'] }
    });
    if (existing) return res.status(400).json({ msg: 'You already have an open bounty on this contract' });

    const sender = await User.findOneAndUpdate(
      { _id: req.user.id, auraBalance: { $gte: amount } },
      { $inc: { auraBalance: -amount } },
      { new: true }
    ).select('_id displayName');
    if (!sender) return res.status(400).json({ msg: 'Not enough Aura' });

    let bounty;
    try {
      bounty = await Bounty.create({
        senderId: sender._id,
        senderName: sender.displayName,
        targetId: target._id,
        targetName: target.displayName,
        friendshipId: friendship._id,
        amount,
        message: String(req.body.message || '').trim().slice(0, 180)
      });
    } catch (error) {
      await User.updateOne({ _id: sender._id }, { $inc: { auraBalance: amount } });
      throw error;
    }

    await AuraTransaction.create({
      userId: sender._id,
      amount: -amount,
      type: 'BOUNTY_PLACED',
      description: `Placed a ${amount} Aura bounty on ${target.displayName}`
    });
    await recordEvent(friendship._id, 'BOUNTY_PLACED', {
      userId: sender._id,
      aura: -amount,
      metadata: { amount, targetId: target._id, targetName: target.displayName }
    });
    await Notification.create({
      toUserId: target._id,
      fromUserId: sender._id,
      type: 'BOUNTY_PLACED',
      title: `${amount} Aura bounty`,
      message: `${sender.displayName} placed a bounty on your contract. Check in to resolve it.`,
      friendshipId: friendship._id
    });

    return res.status(201).json(bounty);
  } catch (err) {
    console.error('Create bounty failed:', err.message);
    return res.status(500).json({ msg: 'Could not place bounty' });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    await expireStaleBounties();
    const bounties = await Bounty.find({
      status: { $in: ['ACTIVE', 'HUNTING'] },
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json(bounties);
  } catch (err) {
    console.error('Load bounties failed:', err.message);
    return res.status(500).json({ msg: 'Could not load bounties' });
  }
});

router.post('/:id/hunt', auth, async (req, res) => {
  try {
    await expireStaleBounties();
    const existing = await Bounty.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: 'Bounty not found' });
    if (existing.status !== 'ACTIVE') return res.status(400).json({ msg: 'Bounty is no longer open' });
    if (existing.targetId.toString() === req.user.id) return res.status(400).json({ msg: 'You cannot hunt a bounty on yourself' });
    if (existing.senderId.toString() === req.user.id) return res.status(400).json({ msg: 'You cannot hunt a bounty you placed' });

    const hunter = await User.findById(req.user.id).select('_id displayName');
    if (!hunter) return res.status(404).json({ msg: 'User not found' });

    const bounty = await Bounty.findOneAndUpdate(
      { _id: existing._id, status: 'ACTIVE', expiresAt: { $gt: new Date() } },
      { $set: { status: 'HUNTING', hunterId: hunter._id, hunterName: hunter.displayName } },
      { new: true }
    );
    if (!bounty) return res.status(409).json({ msg: 'Another hunter already picked up this bounty' });

    await recordEvent(bounty.friendshipId, 'BOUNTY_HUNTING', {
      userId: hunter._id,
      metadata: { amount: bounty.amount, targetId: bounty.targetId, targetName: bounty.targetName }
    });
    await Notification.create({
      toUserId: bounty.targetId,
      fromUserId: hunter._id,
      type: 'BOUNTY_HUNTING',
      title: 'Hunter assigned',
      message: `${hunter.displayName} picked up the bounty on your contract.`,
      friendshipId: bounty.friendshipId
    });

    return res.json(bounty);
  } catch (err) {
    console.error('Hunt bounty failed:', err.message);
    return res.status(500).json({ msg: 'Could not hunt bounty' });
  }
});

module.exports = router;
