const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AfterHoursPresence = require('../models/AfterHoursPresence');
const AfterHoursActivity = require('../models/AfterHoursActivity');
const AfterHoursReaction = require('../models/AfterHoursReaction');
const AfterHoursSpark = require('../models/AfterHoursSpark');
const AfterHoursVote = require('../models/AfterHoursVote');
const AuraTransaction = require('../models/AuraTransaction');
const { normalizeUsername } = require('../services/username');
const {
  ACTIVE_MS,
  FEED_MS,
  REACTIONS,
  SHOUT_MAX_LENGTH,
  SOCIAL_POST_MAX_LENGTH,
  REPLY_MAX_LENGTH,
  CHALLENGE_MAX_LENGTH,
  SPARK_AMOUNT,
  SPARK_DAILY_LIMIT,
  SPARK_RECIPIENT_DAILY_LIMIT,
  BURN_OPTIONS,
  SOCIAL_POST_TYPES,
  SOCIAL_CONTENT_TYPES,
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

const socialPostLimiter = createRateLimiter({
  name: 'after-hours-social-post',
  windowMs: 10 * 60 * 1000,
  max: 14,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Give the room a second before posting again.'
});

const socialReplyLimiter = createRateLimiter({
  name: 'after-hours-social-reply',
  windowMs: 10 * 60 * 1000,
  max: 24,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many replies at once. Let the room breathe.'
});

const sparkLimiter = createRateLimiter({
  name: 'after-hours-spark',
  windowMs: 10 * 60 * 1000,
  max: 24,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Slow down on the Aura Sparks.'
});

const noteLimiter = createRateLimiter({
  name: 'after-hours-note',
  windowMs: 10 * 60 * 1000,
  max: 6,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Give people a little space before leaving more notes.'
});

const cleanLine = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const postPromptFor = (type) => ({
  SHOUT: 'Room shout',
  HOT_TAKE: 'Hot take',
  CONFESSION: 'Confession',
  QUESTION: 'Ask After Hours'
}[type] || 'After Hours');

const loadActor = async (userId) => User.findById(userId)
  .select('_id displayName username usernameNormalized avatar auraBalance isTestAccount testOwnerId')
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

router.post('/post', socialPostLimiter, async (req, res) => {
  let burned = 0;
  let createdActivity = null;
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const type = String(req.body.type || 'SHOUT').toUpperCase();
    if (!SOCIAL_POST_TYPES.includes(type)) return res.status(400).json({ msg: 'Pick a valid After Hours post type' });

    const text = cleanLine(req.body.text);
    if (!text) return res.status(400).json({ msg: 'Say something first' });
    if (text.length > SOCIAL_POST_MAX_LENGTH) {
      return res.status(400).json({ msg: `Keep it under ${SOCIAL_POST_MAX_LENGTH} characters` });
    }

    const anonymous = type === 'CONFESSION' && Boolean(req.body.anonymous);
    const burnAmount = Number(req.body.burnAmount) || 0;
    if (burnAmount !== 0 && !BURN_OPTIONS.includes(burnAmount)) {
      return res.status(400).json({ msg: 'Pick a valid Aura burn' });
    }

    const scopeKey = scopeFor(actor);
    const recent = await AfterHoursActivity.exists({
      scopeKey,
      type: { $in: SOCIAL_POST_TYPES },
      actorId: actor._id,
      createdAt: { $gte: new Date(Date.now() - 15 * 1000) }
    });
    if (recent) return res.status(429).json({ msg: 'Give your last post a few seconds.' });

    if (burnAmount > 0) {
      const debited = await User.findOneAndUpdate(
        { _id: actor._id, auraBalance: { $gte: burnAmount } },
        { $inc: { auraBalance: -burnAmount } },
        { new: true }
      ).select('_id auraBalance');
      if (!debited) return res.status(400).json({ msg: `You need ${burnAmount} Aura to burn that much` });
      burned = burnAmount;
    }

    const round = currentRound();
    createdActivity = await AfterHoursActivity.create({
      scopeKey,
      roundKey: round.roundKey,
      type,
      actorId: actor._id,
      promptId: `social-${type.toLowerCase()}`,
      promptText: postPromptFor(type),
      text,
      anonymous,
      burnAmount
    });

    if (burnAmount > 0) {
      await AuraTransaction.create({
        userId: actor._id,
        amount: -burnAmount,
        type: 'AFTER_HOURS_BURN',
        description: `Burned ${burnAmount} Aura on an After Hours post`,
        idempotencyKey: `after-hours-burn:${createdActivity._id}`,
        metadata: { afterHoursActivityId: createdActivity.publicId, postType: type }
      });
    }

    await touchPresence(actor);
    const freshActor = await loadActor(actor._id);
    return res.json(await buildRoomSnapshot(freshActor || actor));
  } catch (error) {
    if (burned > 0 && !createdActivity) {
      await User.updateOne({ _id: req.user.id }, { $inc: { auraBalance: burned } }).catch(() => null);
    }
    console.error('After Hours post failed:', error.message);
    return res.status(500).json({ msg: 'Could not post to After Hours' });
  }
});

router.post('/feed/:activityId/reply', socialReplyLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const text = cleanLine(req.body.text);
    if (!text) return res.status(400).json({ msg: 'Write a reply first' });
    if (text.length > REPLY_MAX_LENGTH) {
      return res.status(400).json({ msg: `Keep replies under ${REPLY_MAX_LENGTH} characters` });
    }

    const scopeKey = scopeFor(actor);
    const parent = await AfterHoursActivity.findOne({
      publicId: req.params.activityId,
      scopeKey,
      type: { $in: SOCIAL_POST_TYPES },
      createdAt: { $gte: new Date(Date.now() - FEED_MS) }
    }).lean();
    if (!parent) return res.status(404).json({ msg: 'That post is gone' });

    if (parent.type === 'CONFESSION' && parent.anonymous && String(parent.actorId) === String(actor._id)) {
      return res.status(400).json({ msg: 'Replying would give away your anonymous confession' });
    }

    const uniqueKey = `reply:${scopeKey}:${parent._id}:${actor._id}`;
    if (await AfterHoursActivity.exists({ uniqueKey })) {
      return res.status(409).json({ msg: 'You already replied to that post' });
    }

    let reply;
    try {
      reply = await AfterHoursActivity.create({
        uniqueKey,
        scopeKey,
        roundKey: parent.roundKey,
        type: 'REPLY',
        actorId: actor._id,
        targetUserId: parent.actorId,
        parentActivityId: parent._id,
        promptId: 'social-reply',
        promptText: parent.promptText || 'After Hours',
        text
      });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ msg: 'You already replied to that post' });
      throw error;
    }

    if (String(parent.actorId) !== String(actor._id)) {
      notify({
        toUserId: parent.actorId,
        fromUserId: actor._id,
        type: 'AFTER_HOURS_REPLY',
        title: 'After Hours',
        message: parent.type === 'CONFESSION' && parent.anonymous
          ? `${actor.displayName} replied to your anonymous confession.`
          : `${actor.displayName} replied to your After Hours post.`,
        afterHoursActivityId: parent.publicId
      });
    }

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours reply failed:', error.message);
    return res.status(500).json({ msg: 'Could not reply' });
  }
});

router.post('/feed/:activityId/vote', actionLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const vote = String(req.body.vote || '').toUpperCase();
    if (!['REAL', 'NONSENSE'].includes(vote)) return res.status(400).json({ msg: 'Pick real or nonsense' });

    const scopeKey = scopeFor(actor);
    const activity = await AfterHoursActivity.findOne({
      publicId: req.params.activityId,
      scopeKey,
      type: 'HOT_TAKE',
      createdAt: { $gte: new Date(Date.now() - FEED_MS) }
    }).lean();
    if (!activity) return res.status(404).json({ msg: 'That hot take is gone' });
    if (String(activity.actorId) === String(actor._id)) return res.status(400).json({ msg: 'Let the room judge your take' });

    await AfterHoursVote.findOneAndUpdate(
      { scopeKey, activityId: activity._id, userId: actor._id },
      { $set: { vote } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours hot take vote failed:', error.message);
    return res.status(500).json({ msg: 'Could not vote on that take' });
  }
});

router.post('/feed/:activityId/spark', sparkLimiter, async (req, res) => {
  let spark = null;
  let debited = false;
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const scopeKey = scopeFor(actor);
    const activity = await AfterHoursActivity.findOne({
      publicId: req.params.activityId,
      scopeKey,
      type: { $in: SOCIAL_CONTENT_TYPES },
      createdAt: { $gte: new Date(Date.now() - FEED_MS) }
    }).lean();
    if (!activity) return res.status(404).json({ msg: 'That post is gone' });
    if (String(activity.actorId) === String(actor._id)) return res.status(400).json({ msg: 'You cannot Spark yourself' });

    if (await AfterHoursSpark.exists({ activityId: activity._id, fromUserId: actor._id })) {
      return res.status(409).json({ msg: 'You already Sparked that' });
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [dailyCount, recipientDailyCount] = await Promise.all([
      AfterHoursSpark.countDocuments({ fromUserId: actor._id, createdAt: { $gte: dayAgo } }),
      AfterHoursSpark.countDocuments({ fromUserId: actor._id, toUserId: activity.actorId, createdAt: { $gte: dayAgo } })
    ]);
    if (dailyCount >= SPARK_DAILY_LIMIT) return res.status(429).json({ msg: 'Your After Hours Sparks reset tomorrow.' });
    if (recipientDailyCount >= SPARK_RECIPIENT_DAILY_LIMIT) {
      return res.status(429).json({ msg: 'You have Sparked them enough today.' });
    }

    try {
      spark = await AfterHoursSpark.create({
        scopeKey,
        activityId: activity._id,
        fromUserId: actor._id,
        toUserId: activity.actorId,
        amount: SPARK_AMOUNT
      });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ msg: 'You already Sparked that' });
      throw error;
    }

    const donor = await User.findOneAndUpdate(
      { _id: actor._id, auraBalance: { $gte: SPARK_AMOUNT } },
      { $inc: { auraBalance: -SPARK_AMOUNT } },
      { new: true }
    ).select('_id auraBalance');
    if (!donor) {
      await AfterHoursSpark.deleteOne({ _id: spark._id });
      spark = null;
      return res.status(400).json({ msg: 'You need Aura to Spark somebody' });
    }
    debited = true;

    const recipient = await User.findByIdAndUpdate(
      activity.actorId,
      { $inc: { auraBalance: SPARK_AMOUNT } },
      { new: true }
    ).select('_id displayName auraBalance');
    if (!recipient) {
      await Promise.all([
        User.updateOne({ _id: actor._id }, { $inc: { auraBalance: SPARK_AMOUNT } }),
        AfterHoursSpark.deleteOne({ _id: spark._id })
      ]);
      spark = null;
      debited = false;
      return res.status(404).json({ msg: 'That person is no longer available' });
    }

    await Promise.all([
      AuraTransaction.create({
        userId: actor._id,
        amount: -SPARK_AMOUNT,
        type: 'AFTER_HOURS_SPARK_SENT',
        description: `Sparked ${recipient.displayName} in After Hours`,
        idempotencyKey: `after-hours-spark-out:${spark._id}`,
        metadata: { afterHoursActivityId: activity.publicId }
      }),
      AuraTransaction.create({
        userId: recipient._id,
        amount: SPARK_AMOUNT,
        type: 'AFTER_HOURS_SPARK_RECEIVED',
        description: 'Received an Aura Spark in After Hours',
        idempotencyKey: `after-hours-spark-in:${spark._id}`,
        metadata: { afterHoursActivityId: activity.publicId }
      })
    ]);

    const sparkTotal = await AfterHoursSpark.countDocuments({ activityId: activity._id });
    await Notification.findOneAndUpdate(
      {
        toUserId: recipient._id,
        type: 'AFTER_HOURS_SPARK',
        afterHoursActivityId: activity.publicId,
        read: false
      },
      {
        $set: {
          fromUserId: actor._id,
          title: 'Aura Spark',
          message: activity.type === 'CONFESSION' && activity.anonymous
            ? `Your anonymous confession picked up ${sparkTotal} Aura.`
            : `Your After Hours post picked up ${sparkTotal} Aura.`,
          createdAt: new Date()
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    ).catch(() => null);

    await touchPresence(actor);
    const freshActor = await loadActor(actor._id);
    return res.json(await buildRoomSnapshot(freshActor || actor));
  } catch (error) {
    if (spark && !debited) await AfterHoursSpark.deleteOne({ _id: spark._id }).catch(() => null);
    console.error('After Hours Spark failed:', error.message);
    return res.status(500).json({ msg: 'Could not send that Spark' });
  }
});

router.post('/note', noteLimiter, async (req, res) => {
  try {
    const actor = await loadActor(req.user.id);
    if (!actor) return res.status(404).json({ msg: 'User not found' });

    const targetUsername = normalizeUsername(req.body.username);
    const text = cleanLine(req.body.text);
    if (!targetUsername) return res.status(400).json({ msg: 'Pick somebody who is around' });
    if (!text) return res.status(400).json({ msg: 'Write a note first' });
    if (text.length > 60) return res.status(400).json({ msg: 'Keep notes under 60 characters' });
    if (targetUsername === actor.usernameNormalized) return res.status(400).json({ msg: 'Leave notes for somebody else' });

    const scopeKey = scopeFor(actor);
    const targetQuery = actor.isTestAccount
      ? { usernameNormalized: targetUsername, isTestAccount: true, testOwnerId: actor.testOwnerId || actor._id }
      : { usernameNormalized: targetUsername, isTestAccount: { $ne: true } };
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

    const recentNote = await Notification.exists({
      toUserId: target._id,
      fromUserId: actor._id,
      type: 'AFTER_HOURS_NOTE',
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    });
    if (recentNote) return res.status(429).json({ msg: 'You already left them a note recently.' });

    await Notification.create({
      toUserId: target._id,
      fromUserId: actor._id,
      type: 'AFTER_HOURS_NOTE',
      title: 'After Hours note',
      message: `${actor.displayName}: “${text}”`
    });

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours note failed:', error.message);
    return res.status(500).json({ msg: 'Could not leave that note' });
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

    let joinedActivity;
    try {
      joinedActivity = await AfterHoursActivity.create({
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
      message: `${actor.displayName} answered your After Hours challenge.`,
      afterHoursActivityId: joinedActivity.publicId
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

    let tagActivity;
    try {
      tagActivity = await AfterHoursActivity.create({
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
      type: 'AFTER_HOURS_TAG_IN',
      title: 'After Hours',
      message: `${actor.displayName} tagged you into the live Pick a Side. Your turn before the room moves on.`,
      afterHoursActivityId: tagActivity.publicId
    });

    await touchPresence(actor);
    return res.json(await buildRoomSnapshot(actor));
  } catch (error) {
    console.error('After Hours tag-in failed:', error.message);
    return res.status(500).json({ msg: 'Could not tag them in' });
  }
});

module.exports = router;
