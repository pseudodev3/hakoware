const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Bounty = require('../models/Bounty');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const AuraTransaction = require('../models/AuraTransaction');
const Notification = require('../models/Notification');
const {
  HUNT_WINDOW_HOURS,
  listingFeeFor,
  hunterBondFor,
  getHunterProfile,
  expireStaleBounties
} = require('../services/bountyEscrow');
const { recordEvent } = require('../services/contractGame');

const HOUR = 60 * 60 * 1000;
const BOUNTY_COOLDOWN_HOURS = 24;

const PRESSURE_MOVES = Object.freeze({
  CLOCK: { id: 'CLOCK', label: "Clock's running.", message: "Clock's running. Check in before I collect." },
  SHOW_UP: { id: 'SHOW_UP', label: 'Show up.', message: 'Your contract is waiting. Show up and close this.' },
  COLLECT: { id: 'COLLECT', label: 'I want that Aura.', message: 'I picked up your bounty. Check in before I collect.' },
  NO_GHOST: { id: 'NO_GHOST', label: 'No ghosting.', message: 'No ghosting. Your bounty is live and I am on it.' }
});

router.get('/meta', auth, (req, res) => {
  res.json({
    pressureMoves: Object.values(PRESSURE_MOVES),
    huntWindowHours: HUNT_WINDOW_HOURS,
    bountyCooldownHours: BOUNTY_COOLDOWN_HOURS,
    listingFeePercent: 5,
    hunterBondPercent: 10
  });
});

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

    const actor = await User.findById(req.user.id).select('isTestAccount testOwnerId');
    if (!actor) return res.status(404).json({ msg: 'User not found' });
    if (Boolean(actor.isTestAccount) !== Boolean(friendship.isTestData)) {
      return res.status(403).json({ msg: 'Test Lab and live Arena data cannot mix' });
    }
    if (actor.isTestAccount && String(actor.testOwnerId) !== String(friendship.testOwnerId)) {
      return res.status(403).json({ msg: 'This test contract belongs to another lab' });
    }

    const targetId = isUser1 ? friendship.user2 : friendship.user1;
    const target = await User.findById(targetId).select('_id displayName');
    if (!target) return res.status(404).json({ msg: 'User not found' });

    const existing = await Bounty.findOne({
      senderId: req.user.id,
      targetId: target._id,
      friendshipId: friendship._id,
      status: { $in: ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'] }
    });
    if (existing) return res.status(400).json({ msg: 'You already have an open bounty on this contract' });

    const cooldownCutoff = new Date(Date.now() - BOUNTY_COOLDOWN_HOURS * HOUR);
    const recentResolved = await Bounty.findOne({
      senderId: req.user.id,
      targetId: target._id,
      friendshipId: friendship._id,
      status: { $in: ['CLAIMED', 'ESCAPED', 'EXPIRED'] },
      resolvedAt: { $gte: cooldownCutoff }
    }).sort({ resolvedAt: -1 }).select('resolvedAt');
    if (recentResolved) {
      const availableAt = new Date(new Date(recentResolved.resolvedAt).getTime() + BOUNTY_COOLDOWN_HOURS * HOUR);
      const hoursLeft = Math.max(1, Math.ceil((availableAt - new Date()) / HOUR));
      return res.status(429).json({ msg: `This contract is cooling down. You can post another bounty in about ${hoursLeft}h.` });
    }

    const listingFee = listingFeeFor(amount);
    const totalCost = amount + listingFee;
    const sender = await User.findOneAndUpdate(
      { _id: req.user.id, auraBalance: { $gte: totalCost } },
      { $inc: { auraBalance: -totalCost } },
      { new: true }
    ).select('_id displayName auraBalance');
    if (!sender) return res.status(400).json({ msg: `You need ${totalCost} Aura including the ${listingFee} Aura Arena fee` });

    let bounty;
    try {
      bounty = await Bounty.create({
        senderId: sender._id,
        senderName: sender.displayName,
        targetId: target._id,
        targetName: target.displayName,
        friendshipId: friendship._id,
        isTestData: Boolean(friendship.isTestData),
        testOwnerId: friendship.testOwnerId || null,
        amount,
        listingFee,
        message: String(req.body.message || '').trim().slice(0, 180)
      });
    } catch (error) {
      await User.updateOne({ _id: sender._id }, { $inc: { auraBalance: totalCost } });
      throw error;
    }

    await Promise.all([
      AuraTransaction.create({
        userId: sender._id,
        amount: -amount,
        type: 'BOUNTY_PLACED',
        description: `Escrowed ${amount} Aura on ${target.displayName}`,
        metadata: { bountyId: bounty._id, friendshipId: friendship._id }
      }),
      AuraTransaction.create({
        userId: sender._id,
        amount: -listingFee,
        type: 'ARENA_FEE',
        description: `Arena listing fee for ${target.displayName}`,
        metadata: { bountyId: bounty._id, friendshipId: friendship._id }
      })
    ]);

    await recordEvent(friendship._id, 'BOUNTY_PLACED', {
      userId: sender._id,
      aura: -totalCost,
      metadata: { amount, listingFee, targetId: target._id, targetName: target.displayName }
    });
    await Notification.create({
      toUserId: target._id,
      fromUserId: sender._id,
      type: 'BOUNTY_PLACED',
      title: `${amount} Aura bounty`,
      message: `${sender.displayName} put ${amount} Aura on your contract. Check in before a hunter closes it.`,
      friendshipId: friendship._id
    });

    return res.status(201).json({ ...bounty.toObject(), economics: { listingFee, totalCost } });
  } catch (err) {
    console.error('Create bounty failed:', err.message);
    return res.status(500).json({ msg: 'Could not place bounty' });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    await expireStaleBounties();
    const actor = await User.findById(req.user.id).select('isTestAccount testOwnerId');
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const scope = actor.isTestAccount
      ? { isTestData: true, testOwnerId: actor.testOwnerId }
      : { isTestData: { $ne: true } };

    const bounties = await Bounty.find({
      ...scope,
      status: { $in: ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'] },
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

router.get('/hunter-profile', auth, async (req, res) => {
  try {
    return res.json(await getHunterProfile(req.user.id));
  } catch (err) {
    console.error('Load hunter profile failed:', err.message);
    return res.status(500).json({ msg: 'Could not load hunter profile' });
  }
});

router.get('/contract/:friendshipId', auth, async (req, res) => {
  try {
    await expireStaleBounties();
    const bounty = await Bounty.findOne({
      friendshipId: req.params.friendshipId,
      targetId: req.user.id,
      status: { $in: ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'] }
    }).sort({ createdAt: -1 });
    if (!bounty) return res.json(null);
    return res.json({
      _id: bounty._id,
      amount: bounty.amount,
      status: bounty.status,
      hunterId: bounty.hunterId,
      hunterName: bounty.hunterName,
      hunterBond: bounty.hunterBond,
      huntExpiresAt: bounty.huntExpiresAt,
      pressureSentAt: bounty.pressureSentAt,
      pressurePreset: bounty.pressurePreset,
      senderName: bounty.senderName
    });
  } catch (err) {
    console.error('Load contract bounty failed:', err.message);
    return res.status(500).json({ msg: 'Could not load bounty pressure' });
  }
});

router.post('/:id/hunt', auth, async (req, res) => {
  try {
    await expireStaleBounties();
    const existing = await Bounty.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: 'Bounty not found' });
    if (existing.status !== 'ACTIVE') return res.status(400).json({ msg: 'Bounty is no longer open' });

    const actor = await User.findById(req.user.id).select('isTestAccount testOwnerId');
    if (!actor) return res.status(404).json({ msg: 'User not found' });
    if (actor.isTestAccount) {
      if (!existing.isTestData || String(existing.testOwnerId) !== String(actor.testOwnerId)) {
        return res.status(403).json({ msg: 'Test players can only hunt inside their Founder Lab' });
      }
    } else if (existing.isTestData) {
      return res.status(403).json({ msg: 'Founder Lab bounties are not part of the live Arena' });
    }

    if (existing.targetId.toString() === req.user.id) return res.status(400).json({ msg: 'You cannot hunt a bounty on yourself' });
    if (existing.senderId.toString() === req.user.id) return res.status(400).json({ msg: 'You cannot hunt a bounty you placed' });

    const bond = hunterBondFor(existing.amount);
    const hunter = await User.findOneAndUpdate(
      { _id: req.user.id, auraBalance: { $gte: bond } },
      { $inc: { auraBalance: -bond } },
      { new: true }
    ).select('_id displayName auraBalance');
    if (!hunter) return res.status(400).json({ msg: `You need ${bond} Aura for the refundable Hunter Bond` });

    const now = new Date();
    const bounty = await Bounty.findOneAndUpdate(
      { _id: existing._id, status: 'ACTIVE', expiresAt: { $gt: now } },
      {
        $set: {
          status: 'HUNTING',
          hunterId: hunter._id,
          hunterName: hunter.displayName,
          hunterBond: bond,
          huntStartedAt: now,
          huntExpiresAt: new Date(now.getTime() + HUNT_WINDOW_HOURS * HOUR),
          pressureSentAt: null,
          pressurePreset: null
        }
      },
      { new: true }
    );

    if (!bounty) {
      await User.updateOne({ _id: hunter._id }, { $inc: { auraBalance: bond } });
      return res.status(409).json({ msg: 'Another hunter already picked up this bounty' });
    }

    await AuraTransaction.create({
      userId: hunter._id,
      amount: -bond,
      type: 'HUNTER_BOND',
      description: `Hunter Bond on ${bounty.targetName}`,
      metadata: { bountyId: bounty._id, friendshipId: bounty.friendshipId }
    });
    await recordEvent(bounty.friendshipId, 'BOUNTY_HUNTING', {
      userId: hunter._id,
      aura: -bond,
      metadata: { amount: bounty.amount, bond, targetId: bounty.targetId, targetName: bounty.targetName }
    });
    await Notification.create({
      toUserId: bounty.targetId,
      fromUserId: hunter._id,
      type: 'BOUNTY_HUNTING',
      title: 'Hunter assigned',
      message: `${hunter.displayName} picked up your bounty. They have ${HUNT_WINDOW_HOURS} hours to prove they got you back.`,
      friendshipId: bounty.friendshipId
    });

    return res.json(bounty);
  } catch (err) {
    console.error('Hunt bounty failed:', err.message);
    return res.status(500).json({ msg: 'Could not hunt bounty' });
  }
});

router.post('/:id/pressure', auth, async (req, res) => {
  try {
    await expireStaleBounties();
    const move = PRESSURE_MOVES[String(req.body.moveId || '').toUpperCase()];
    if (!move) return res.status(400).json({ msg: 'Choose a valid pressure move' });

    const existing = await Bounty.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: 'Bounty not found' });
    if (existing.hunterId?.toString() !== req.user.id) return res.status(403).json({ msg: 'This hunt is not yours' });
    if (existing.status === 'PRESSURE_SENT') return res.status(400).json({ msg: 'Pressure was already sent on this hunt' });
    if (existing.status !== 'HUNTING') return res.status(400).json({ msg: 'This hunt is no longer active' });
    if (!existing.huntExpiresAt || new Date(existing.huntExpiresAt) <= new Date()) return res.status(400).json({ msg: 'Your hunt window has closed' });

    const now = new Date();
    const bounty = await Bounty.findOneAndUpdate(
      { _id: existing._id, status: 'HUNTING', hunterId: req.user.id },
      { $set: { status: 'PRESSURE_SENT', pressureSentAt: now, pressurePreset: move.id } },
      { new: true }
    );
    if (!bounty) return res.status(409).json({ msg: 'Hunt state changed. Refresh the Arena.' });

    await recordEvent(bounty.friendshipId, 'BOUNTY_PRESSURE_SENT', {
      userId: req.user.id,
      metadata: { bountyId: bounty._id, moveId: move.id, targetId: bounty.targetId, huntExpiresAt: bounty.huntExpiresAt }
    });
    await Notification.create({
      toUserId: bounty.targetId,
      fromUserId: req.user.id,
      type: 'BOUNTY_PRESSURE',
      title: `${bounty.hunterName} sent pressure`,
      message: `${move.message} If they actually got you here, credit them when you check in.`,
      friendshipId: bounty.friendshipId
    });

    return res.json({ bounty, move });
  } catch (err) {
    console.error('Send bounty pressure failed:', err.message);
    return res.status(500).json({ msg: 'Could not send pressure' });
  }
});

module.exports = router;
