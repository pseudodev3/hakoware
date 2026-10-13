const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const founder = require('../middleware/founder');
const { createRateLimiter } = require('../middleware/rateLimit');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const PendingInvite = require('../models/PendingInvite');
const ContractEvent = require('../models/ContractEvent');
const GrowthEvent = require('../models/GrowthEvent');
const { recordShopEvent, productSnapshot } = require('../services/productMetrics');
const { sendRouteError } = require('../services/httpError');

const SHARE_SOURCES = new Set([
  'INVITE',
  'RECAP',
  'DUO',
  'SEASON_COMPLETE',
  'CHAOS',
  'LEVEL_UP',
  'GENERAL'
]);

const safeRate = (numerator, denominator) => (
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
);
const shareLimiter = createRateLimiter({
  name: 'growth-share',
  windowMs: 60 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many share events. Try again later.'
});


router.post('/share', auth, shareLimiter, async (req, res) => {
  try {
    const actor = await User.findById(req.user.id).select('isTestAccount');
    if (!actor) return res.status(404).json({ msg: 'User not found' });
    if (actor.isTestAccount) return res.status(201).json({ success: true, tracked: false });

    const source = String(req.body.source || 'GENERAL').trim().toUpperCase();
    if (!SHARE_SOURCES.has(source)) {
      return res.status(400).json({ msg: 'Unknown share source' });
    }

    await GrowthEvent.create({
      userId: req.user.id,
      type: 'SHARE',
      source,
      metadata: {
        method: String(req.body.method || 'UNKNOWN').slice(0, 24)
      }
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Record share failed:', error.message);
    return res.status(500).json({ msg: 'Could not record share' });
  }
});

router.post('/shop', auth, shareLimiter, async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['type', 'packId'].includes(key))) return res.status(400).json({ msg: 'Choose a valid shop event' });
    const tracked = await recordShopEvent(req.user.id, body.type, body.packId ?? null);
    return res.status(201).json({ success: true, tracked: Boolean(tracked) });
  } catch (error) { sendRouteError(res, error, 'Could not record shop activity'); }
});

router.post('/plus-interest', auth, async (req, res) => {
  try {
    const interested = req.body.interested !== false;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { plusInterestAt: interested ? new Date() : null } },
      { new: true }
    ).select('plusInterestAt');

    if (!user) return res.status(404).json({ msg: 'User not found' });
    return res.json({ interested: Boolean(user.plusInterestAt), plusInterestAt: user.plusInterestAt });
  } catch (error) {
    console.error('Plus interest failed:', error.message);
    return res.status(500).json({ msg: 'Could not update Hakoware+ interest' });
  }
});

router.get('/metrics', auth, founder, async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const [friendships, totalUsers, newUsers7d, pendingExternalInvites, plusInterest, totalShares, sharesBySource] = await Promise.all([
      Friendship.find({ isTestData: { $ne: true } }).select('_id user1 user2 status season.number').lean(),
      User.countDocuments({ isTestAccount: { $ne: true } }),
      User.countDocuments({ isTestAccount: { $ne: true }, createdAt: { $gte: sevenDaysAgo } }),
      PendingInvite.countDocuments({ expiresAt: { $gt: now } }),
      User.countDocuments({ isTestAccount: { $ne: true }, plusInterestAt: { $ne: null } }),
      GrowthEvent.countDocuments({ type: 'SHARE' }),
      GrowthEvent.aggregate([
        { $match: { type: 'SHARE' } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const friendshipIds = friendships.map((item) => item._id);
    const activeDuos = friendships.filter((item) => item.status === 'ACTIVE').length;

    const [checkinParticipants, active7dIds, completedSeasons, runItBacks] = friendshipIds.length
      ? await Promise.all([
        ContractEvent.aggregate([
          { $match: { friendshipId: { $in: friendshipIds }, type: { $in: ['CHECKIN', 'VOICE_CHECKIN'] }, createdAt: { $lte: now } } },
          { $group: { _id: '$friendshipId', users: { $addToSet: '$userId' } } }
        ]),
        ContractEvent.distinct('friendshipId', {
          friendshipId: { $in: friendshipIds },
          type: { $in: ['CHECKIN', 'VOICE_CHECKIN'] },
          createdAt: { $gte: sevenDaysAgo }
        }),
        ContractEvent.countDocuments({
          friendshipId: { $in: friendshipIds },
          type: 'SEASON_COMPLETED'
        }),
        ContractEvent.countDocuments({
          friendshipId: { $in: friendshipIds },
          type: 'SEASON_STARTED',
          'metadata.runItBack': true
        })
      ])
      : [[], [], 0, 0];

    const mutualDuos = friendships.filter(friendship => {
      const actors = checkinParticipants.find(row => String(row._id) === String(friendship._id))?.users.map(String) || [];
      return actors.includes(String(friendship.user1)) && actors.includes(String(friendship.user2));
    });
    const activatedDuos = mutualDuos.length;
    const active7dDuos = active7dIds.length;
    const plusInterestRate = safeRate(plusInterest, totalUsers);
    const activationRate = safeRate(mutualDuos.filter(duo => duo.status === 'ACTIVE').length, activeDuos);
    const runItBackRate = safeRate(runItBacks, completedSeasons);

    const product = await productSnapshot(now, { duoUserIds: friendships.filter(duo => ['ACTIVE', 'BANKRUPT'].includes(duo.status)).flatMap(duo => [duo.user1, duo.user2]), mutualUserIds: mutualDuos.flatMap(duo => [duo.user1, duo.user2]) });
    return res.json({
      generatedAt: now,
      product,
      goals: {
        activatedDuosTarget: 20,
        activatedDuosProgress: Math.min(100, safeRate(activatedDuos, 20))
      },
      users: {
        total: totalUsers,
        new7d: newUsers7d,
        plusInterest,
        plusInterestRate
      },
      duos: {
        contractsCreated: friendships.length,
        active: activeDuos,
        activated: activatedDuos,
        active7d: active7dDuos,
        activationRate,
        pendingExternalInvites
      },
      seasons: {
        completed: completedSeasons,
        runItBacks,
        runItBackRate
      },
      sharing: {
        total: totalShares,
        bySource: sharesBySource.map((item) => ({ source: item._id, count: item.count }))
      }
    });
  } catch (error) {
    console.error('Growth metrics failed:', error.message);
    return res.status(500).json({ msg: 'Could not load growth metrics' });
  }
});

module.exports = router;
