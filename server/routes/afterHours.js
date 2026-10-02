const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const User = require('../models/User');
const AfterHoursPresence = require('../models/AfterHoursPresence');
const AfterHoursActivity = require('../models/AfterHoursActivity');
const AfterHoursReaction = require('../models/AfterHoursReaction');
const { normalizeUsername } = require('../services/username');
const {
  ACTIVE_MS,
  REACTIONS,
  currentRound,
  scopeFor,
  touchPresence,
  buildRoomSnapshot
} = require('../services/afterHours');

const readLimiter = createRateLimiter({
  name: 'after-hours-read',
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'After Hours is moving fast. Try again in a moment.'
});

const actionLimiter = createRateLimiter({
  name: 'after-hours-action',
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too much room chaos at once. Try again shortly.'
});

const calloutLimiter = createRateLimiter({
  name: 'after-hours-callout',
  windowMs: 10 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Give the room a second before another call-out.'
});

const loadActor = async (userId) => User.findById(userId)
  .select('_id displayName username usernameNormalized avatar isTestAccount testOwnerId')
  .lean();

router.use(auth);

router.get('/', readLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });
    if (!actor.username) return res.status(409).json({ msg: 'Pick a username before entering After Hours' });
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours load failed:', error.message);
    return res.status(500).json({ msg: 'Could not enter After Hours' });
  }
});

router.post('/answer', actionLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const round = currentRound();
    const roundKey = String(req.body.roundKey || '');
    const choice = String(req.body.choice || '');
    if (roundKey !== round.roundKey) return res.status(409).json({ msg: 'The room moved on. Pick again.' });
    if (!round.options.includes(choice)) return res.status(400).json({ msg: 'Pick one of the live sides' });

    const scopeKey = scopeFor(actor);
    await touchPresence(actor);
    const uniqueKey = `answer:${scopeKey}:${round.roundKey}:${actor._id}`;
    const existing = await AfterHoursActivity.findOne({ uniqueKey }).lean();
    if (!existing) {
      try {
        await AfterHoursActivity.create({
          uniqueKey,
          scopeKey,
          roundKey: round.roundKey,
          type: 'ANSWER',
          actorId: actor._id,
          promptId: round.promptId,
          promptText: round.text,
          choice
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }

    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours answer failed:', error.message);
    return res.status(500).json({ msg: 'Could not lock your side' });
  }
});

router.post('/feed/:activityId/react', actionLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const reaction = String(req.body.reaction || '');
    if (!REACTIONS.includes(reaction)) return res.status(400).json({ msg: 'That reaction is not available here' });

    const scopeKey = scopeFor(actor);
    const activity = await AfterHoursActivity.findOne({
      publicId: req.params.activityId,
      scopeKey,
      type: 'ANSWER'
    }).lean();
    if (!activity) return res.status(404).json({ msg: 'That room moment is gone' });
    if (String(activity.actorId) === String(actor._id)) return res.status(400).json({ msg: 'React to somebody else' });

    const existing = await AfterHoursReaction.findOne({ activityId: activity._id, userId: actor._id });
    if (existing?.reaction === reaction) {
      await existing.deleteOne();
    } else if (existing) {
      existing.reaction = reaction;
      await existing.save();
    } else {
      await AfterHoursReaction.create({
        scopeKey,
        activityId: activity._id,
        userId: actor._id,
        reaction
      });
    }

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours reaction failed:', error.message);
    return res.status(500).json({ msg: 'Could not react' });
  }
});

router.post('/callout', calloutLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const targetUsername = normalizeUsername(req.body.username);
    if (!targetUsername) return res.status(400).json({ msg: 'Pick somebody who is around' });
    if (targetUsername === actor.usernameNormalized) return res.status(400).json({ msg: 'You cannot call yourself out' });

    const scopeKey = scopeFor(actor);
    const targetQuery = actor.isTestAccount
      ? {
          usernameNormalized: targetUsername,
          isTestAccount: true,
          testOwnerId: actor.testOwnerId || actor._id
        }
      : {
          usernameNormalized: targetUsername,
          isTestAccount: { $ne: true }
        };

    const target = await User.findOne(targetQuery)
      .select('_id displayName username usernameNormalized avatar isTestAccount testOwnerId')
      .lean();
    if (!target) return res.status(404).json({ msg: 'They are not in this room' });

    const activePresence = await AfterHoursPresence.exists({
      scopeKey,
      userId: target._id,
      lastSeenAt: { $gte: new Date(Date.now() - ACTIVE_MS) }
    });
    if (!activePresence) return res.status(409).json({ msg: 'They just left the room' });

    if (String(target._id) === String(actor._id)) {
      return res.status(400).json({ msg: 'You cannot call yourself out' });
    }

    const round = currentRound();
    const actorAnswered = await AfterHoursActivity.exists({
      scopeKey,
      roundKey: round.roundKey,
      type: 'ANSWER',
      actorId: actor._id
    });
    if (!actorAnswered) return res.status(409).json({ msg: 'Pick a side before calling somebody out' });

    const alreadyAnswered = await AfterHoursActivity.exists({
      scopeKey,
      roundKey: round.roundKey,
      type: 'ANSWER',
      actorId: target._id
    });
    if (alreadyAnswered) return res.status(409).json({ msg: 'They already picked a side this round' });

    const uniqueKey = `callout:${scopeKey}:${round.roundKey}:${actor._id}:${target._id}`;
    const existing = await AfterHoursActivity.exists({ uniqueKey });
    if (existing) return res.status(409).json({ msg: 'You already called them out this round' });

    try {
      await AfterHoursActivity.create({
        uniqueKey,
        scopeKey,
        roundKey: round.roundKey,
        type: 'CALLOUT',
        actorId: actor._id,
        targetUserId: target._id,
        promptId: round.promptId,
        promptText: round.text
      });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ msg: 'You already called them out this round' });
      throw error;
    }

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours call-out failed:', error.message);
    return res.status(500).json({ msg: 'Could not call them out' });
  }
});

module.exports = router;
