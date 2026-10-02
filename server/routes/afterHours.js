const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AfterHoursPresence = require('../models/AfterHoursPresence');
const AfterHoursActivity = require('../models/AfterHoursActivity');
const AfterHoursReaction = require('../models/AfterHoursReaction');
const { normalizeUsername } = require('../services/username');
const {
  ACTIVE_MS,
  FEED_MS,
  REACTIONS,
  SHOUT_MAX_LENGTH,
  CHALLENGE_MAX_LENGTH,
  challengeById,
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
  max: 40,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too much room chaos at once. Try again shortly.'
});

const shoutLimiter = createRateLimiter({
  name: 'after-hours-shout',
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Give the room a second before shouting again.'
});

const challengeLimiter = createRateLimiter({
  name: 'after-hours-challenge',
  windowMs: 60 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many challenges at once. Let the room breathe.'
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

const notify = (payload) => {
  void Notification.create(payload).catch((error) => {
    console.warn('After Hours notification failed:', error.message);
  });
};

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

router.post('/shout', shoutLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const text = String(req.body.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return res.status(400).json({ msg: 'Say something first' });
    if (text.length > SHOUT_MAX_LENGTH) {
      return res.status(400).json({ msg: `Keep it under ${SHOUT_MAX_LENGTH} characters` });
    }

    const scopeKey = scopeFor(actor);
    const recent = await AfterHoursActivity.exists({
      scopeKey,
      type: 'SHOUT',
      actorId: actor._id,
      createdAt: { $gte: new Date(Date.now() - 30 * 1000) }
    });
    if (recent) return res.status(429).json({ msg: 'Give the room a few seconds.' });

    const round = currentRound();
    await AfterHoursActivity.create({
      scopeKey,
      roundKey: round.roundKey,
      type: 'SHOUT',
      actorId: actor._id,
      promptId: 'room-shout',
      promptText: 'Room shout',
      text
    });

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours shout failed:', error.message);
    return res.status(500).json({ msg: 'Could not shout into the room' });
  }
});

router.post('/challenge', challengeLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const suggested = challengeById(String(req.body.promptId || ''));
    const customText = String(req.body.text || '').replace(/\s+/g, ' ').trim();
    const challenge = suggested || (customText ? { id: 'custom', text: customText } : null);
    if (!challenge) return res.status(400).json({ msg: 'Write a challenge or pick one' });
    if (challenge.text.length < 4) return res.status(400).json({ msg: 'Make the challenge a little clearer' });
    if (challenge.text.length > CHALLENGE_MAX_LENGTH) {
      return res.status(400).json({ msg: `Keep challenges under ${CHALLENGE_MAX_LENGTH} characters` });
    }

    const scopeKey = scopeFor(actor);
    const recent = await AfterHoursActivity.exists({
      scopeKey,
      type: 'CHALLENGE',
      actorId: actor._id,
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
    });
    if (recent) return res.status(429).json({ msg: 'Let your last challenge breathe first.' });

    const round = currentRound();
    await AfterHoursActivity.create({
      scopeKey,
      roundKey: round.roundKey,
      type: 'CHALLENGE',
      actorId: actor._id,
      promptId: challenge.id,
      promptText: challenge.text,
      text: challenge.text
    });

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours challenge failed:', error.message);
    return res.status(500).json({ msg: 'Could not throw that challenge' });
  }
});

router.post('/feed/:activityId/join', actionLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const responseText = String(req.body.text || '').replace(/\s+/g, ' ').trim();
    if (!responseText) return res.status(400).json({ msg: 'Answer the challenge first' });
    if (responseText.length > SHOUT_MAX_LENGTH) {
      return res.status(400).json({ msg: `Keep it under ${SHOUT_MAX_LENGTH} characters` });
    }

    const scopeKey = scopeFor(actor);
    const challenge = await AfterHoursActivity.findOne({
      publicId: req.params.activityId,
      scopeKey,
      type: 'CHALLENGE',
      createdAt: { $gte: new Date(Date.now() - FEED_MS) }
    }).lean();
    if (!challenge) return res.status(404).json({ msg: 'That challenge is gone' });
    if (String(challenge.actorId) === String(actor._id)) {
      return res.status(400).json({ msg: 'That one is already yours' });
    }

    const uniqueKey = `challenge-join:${scopeKey}:${challenge._id}:${actor._id}`;
    const existing = await AfterHoursActivity.exists({ uniqueKey });
    if (existing) return res.status(409).json({ msg: 'You already joined that challenge' });

    try {
      await AfterHoursActivity.create({
        uniqueKey,
        scopeKey,
        roundKey: challenge.roundKey,
        type: 'CHALLENGE_JOIN',
        actorId: actor._id,
        targetUserId: challenge.actorId,
        parentActivityId: challenge._id,
        promptId: challenge.promptId,
        promptText: challenge.promptText,
        text: responseText
      });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ msg: 'You already joined that challenge' });
      throw error;
    }

    notify({
      toUserId: challenge.actorId,
      fromUserId: actor._id,
      type: 'AFTER_HOURS_CHALLENGE',
      title: 'After Hours',
      message: `${actor.displayName} answered your After Hours challenge.`
    });

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours challenge join failed:', error.message);
    return res.status(500).json({ msg: 'Could not join that challenge' });
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
      createdAt: { $gte: new Date(Date.now() - FEED_MS) }
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
    if (targetUsername === actor.usernameNormalized) return res.status(400).json({ msg: 'You cannot tag yourself in' });

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

    const round = currentRound();
    const actorAnswered = await AfterHoursActivity.exists({
      scopeKey,
      roundKey: round.roundKey,
      type: 'ANSWER',
      actorId: actor._id
    });
    if (!actorAnswered) return res.status(409).json({ msg: 'Pick a side before tagging somebody in' });

    const alreadyAnswered = await AfterHoursActivity.exists({
      scopeKey,
      roundKey: round.roundKey,
      type: 'ANSWER',
      actorId: target._id
    });
    if (alreadyAnswered) return res.status(409).json({ msg: 'They already picked a side this round' });

    const uniqueKey = `callout:${scopeKey}:${round.roundKey}:${actor._id}:${target._id}`;
    const existing = await AfterHoursActivity.exists({ uniqueKey });
    if (existing) return res.status(409).json({ msg: 'You already tagged them in this round' });

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
      if (error?.code === 11000) return res.status(409).json({ msg: 'You already tagged them in this round' });
      throw error;
    }

    notify({
      toUserId: target._id,
      fromUserId: actor._id,
      type: 'AFTER_HOURS_CALLOUT',
      title: 'After Hours',
      message: `${actor.displayName} tagged you into the live Pick a Side. Your turn before the room moves on.`
    });

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours tag-in failed:', error.message);
    return res.status(500).json({ msg: 'Could not tag them in' });
  }
});

module.exports = router;
