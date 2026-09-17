const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const Bounty = require('../models/Bounty');
const AuraTransaction = require('../models/AuraTransaction');
const Notification = require('../models/Notification');
const { sendFriendRequestEmail } = require('../services/emailService');

const normalizeLimit = (value, fallback = 7) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) return null;
  return parsed;
};

const participantKey = (friendship, userId) => {
  if (friendship.user1.toString() === userId) return 'user1Perspective';
  if (friendship.user2.toString() === userId) return 'user2Perspective';
  return null;
};

router.post('/', auth, async (req, res) => {
  try {
    const email = String(req.body.friendEmail || '').trim().toLowerCase();
    const user = await User.findById(req.user.id);
    const limit = normalizeLimit(req.body.limit, user?.defaultLimit || 7);

    if (!email) return res.status(400).json({ msg: 'Friend email is required' });
    if (!limit) return res.status(400).json({ msg: 'Grace period must be between 1 and 30 days' });

    const friend = await User.findOne({ email });
    if (!friend) return res.status(404).json({ msg: 'That person is not on Hakoware yet' });
    if (friend.id === req.user.id) return res.status(400).json({ msg: 'You cannot create a contract with yourself' });

    const existing = await Friendship.findOne({
      $or: [
        { user1: req.user.id, user2: friend.id },
        { user1: friend.id, user2: req.user.id }
      ]
    });
    if (existing) return res.status(400).json({ msg: 'A contract with this person already exists' });

    const friendship = await Friendship.create({
      user1: req.user.id,
      user2: friend.id,
      user1DisplayName: user.displayName,
      user2DisplayName: friend.displayName,
      user1Perspective: { limit },
      user2Perspective: { limit: normalizeLimit(friend.defaultLimit, 7) || 7 },
      status: 'PENDING'
    });

    await Notification.create({
      toUserId: friend._id,
      fromUserId: user._id,
      type: 'CONTRACT_INVITE',
      title: 'New contract request',
      message: `${user.displayName} wants to start a Hakoware contract with you.`,
      friendshipId: friendship._id
    });

    void sendFriendRequestEmail(friend.email, user.displayName);
    return res.status(201).json(friendship);
  } catch (err) {
    console.error('Create contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not create contract' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ user1: req.user.id }, { user2: req.user.id }]
    })
      .sort({ updatedAt: -1 })
      .populate('user1 user2', 'displayName email avatar nenType auraBalance');

    const active = friendships.filter((f) => f.status === 'ACTIVE');
    const pendingReceived = friendships.filter((f) => f.status === 'PENDING' && f.user2?._id?.toString() === req.user.id);
    const pendingSent = friendships.filter((f) => f.status === 'PENDING' && f.user1?._id?.toString() === req.user.id);
    return res.json({ active, pendingReceived, pendingSent });
  } catch (err) {
    console.error('Load contracts failed:', err.message);
    return res.status(500).json({ msg: 'Could not load contracts' });
  }
});

router.put('/:id/respond', auth, async (req, res) => {
  try {
    const action = String(req.body.action || '').toUpperCase();
    if (!['ACCEPT', 'DECLINE'].includes(action)) {
      return res.status(400).json({ msg: 'Response must be ACCEPT or DECLINE' });
    }

    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (friendship.user2.toString() !== req.user.id) return res.status(403).json({ msg: 'Not authorized' });
    if (friendship.status !== 'PENDING') return res.status(400).json({ msg: 'This request is no longer pending' });

    const responder = await User.findById(req.user.id);
    const inviter = await User.findById(friendship.user1);

    if (action === 'DECLINE') {
      await friendship.deleteOne();
      if (inviter) {
        await Notification.create({
          toUserId: inviter._id,
          fromUserId: responder?._id,
          type: 'CONTRACT_DECLINED',
          title: 'Contract declined',
          message: `${responder?.displayName || 'Your invitee'} declined your contract request.`
        });
      }
      return res.json({ success: true });
    }

    friendship.status = 'ACTIVE';
    friendship.user1Perspective.lastInteraction = new Date();
    friendship.user2Perspective.lastInteraction = new Date();
    await friendship.save();

    for (const user of [responder, inviter]) {
      if (!user) continue;
      user.examTasks.friendAdded = true;
      user.hunterLicense = Boolean(user.examTasks.nenTypeSet && user.examTasks.voiceNoteSent);
      await user.save();
    }

    if (inviter) {
      await Notification.create({
        toUserId: inviter._id,
        fromUserId: responder?._id,
        type: 'CONTRACT_ACCEPTED',
        title: 'Contract accepted',
        message: `${responder?.displayName || 'Your invitee'} accepted your contract request.`,
        friendshipId: friendship._id
      });
    }

    return res.json(friendship);
  } catch (err) {
    console.error('Respond to contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not respond to contract' });
  }
});

router.post('/:id/checkin', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (friendship.status !== 'ACTIVE') return res.status(400).json({ msg: 'Contract is not active' });

    const key = participantKey(friendship, req.user.id);
    if (!key) return res.status(403).json({ msg: 'Not authorized' });

    const now = new Date();
    const lastInteraction = new Date(friendship[key].lastInteraction || 0);
    const hoursSince = (now - lastInteraction) / 3600000;
    if (hoursSince < 20) return res.status(400).json({ msg: 'You already checked in today' });

    friendship[key].baseDebt = 0;
    friendship[key].lastInteraction = now;
    friendship[key].calculatedDebt = 0;
    friendship[key].daysMissed = 0;
    friendship[key].isBankrupt = false;
    friendship[key].isInWarningZone = false;
    friendship.streak += 1;
    await friendship.save();

    const huntingBounties = await Bounty.find({ targetId: req.user.id, status: 'HUNTING' });
    for (const bounty of huntingBounties) {
      bounty.status = 'CLAIMED';
      await bounty.save();

      const hunter = bounty.hunterId ? await User.findById(bounty.hunterId) : null;
      if (!hunter) continue;
      hunter.auraBalance += bounty.amount;
      await hunter.save();
      await AuraTransaction.create({
        userId: hunter._id,
        amount: bounty.amount,
        type: 'BOUNTY_REWARD',
        description: `Bounty resolved after ${bounty.targetName} checked in.`
      });
      await Notification.create({
        toUserId: hunter._id,
        type: 'BOUNTY_REWARD',
        title: `+${bounty.amount} Aura`,
        message: `${bounty.targetName} checked in and your bounty paid out.`
      });
    }

    const otherUserId = friendship.user1.toString() === req.user.id ? friendship.user2 : friendship.user1;
    const actor = await User.findById(req.user.id).select('displayName');
    await Notification.create({
      toUserId: otherUserId,
      fromUserId: req.user.id,
      type: 'CHECKIN',
      title: 'Check-in received',
      message: `${actor?.displayName || 'Your contract partner'} checked in.`,
      friendshipId: friendship._id
    });

    return res.json(friendship);
  } catch (err) {
    console.error('Check-in failed:', err.message);
    return res.status(500).json({ msg: 'Could not check in' });
  }
});

router.put('/:id/limit', auth, async (req, res) => {
  try {
    const limit = normalizeLimit(req.body.limit);
    if (!limit) return res.status(400).json({ msg: 'Grace period must be between 1 and 30 days' });

    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    const key = participantKey(friendship, req.user.id);
    if (!key) return res.status(403).json({ msg: 'Not authorized' });

    friendship[key].limit = limit;
    await friendship.save();
    return res.json(friendship);
  } catch (err) {
    console.error('Update contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not update contract' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Contract not found' });
    if (!participantKey(friendship, req.user.id)) return res.status(403).json({ msg: 'Not authorized' });

    await Bounty.deleteMany({ friendshipId: friendship._id, status: { $in: ['ACTIVE', 'HUNTING'] } });
    await friendship.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete contract failed:', err.message);
    return res.status(500).json({ msg: 'Could not delete contract' });
  }
});

module.exports = router;
