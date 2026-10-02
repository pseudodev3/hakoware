const AfterHoursPresence = require('../models/AfterHoursPresence');
const AfterHoursActivity = require('../models/AfterHoursActivity');
const AfterHoursReaction = require('../models/AfterHoursReaction');
const AfterHoursSpark = require('../models/AfterHoursSpark');
const AfterHoursVote = require('../models/AfterHoursVote');

const MINUTE = 60 * 1000;
const ROUND_MS = 10 * MINUTE;
const ACTIVE_MS = 5 * MINUTE;
const FEED_MS = 3 * 60 * MINUTE;
const SHOUT_MAX_LENGTH = 88;
const SOCIAL_POST_MAX_LENGTH = 160;
const REPLY_MAX_LENGTH = 100;
const CHALLENGE_MAX_LENGTH = 96;
const SPARK_AMOUNT = 1;
const SPARK_DAILY_LIMIT = 15;
const SPARK_RECIPIENT_DAILY_LIMIT = 3;
const BURN_OPTIONS = Object.freeze([5, 10, 25]);
const REACTIONS = Object.freeze(['💀', '👀', '😭', '🤝']);
const SOCIAL_POST_TYPES = Object.freeze(['SHOUT', 'HOT_TAKE', 'CONFESSION', 'QUESTION']);
const SOCIAL_CONTENT_TYPES = Object.freeze([...SOCIAL_POST_TYPES, 'REPLY']);

const PROMPTS = Object.freeze([
  { id: 'hill-voice-note', text: 'Worst social crime?', options: ['4-minute voice note', 'Calling with no warning'] },
  { id: 'hill-group-chat', text: 'You are losing a group chat argument. What now?', options: ['Double down', 'Disappear'] },
  { id: 'hill-late', text: 'Pick your liar.', options: ['“5 minutes away”', '“I was just about to reply”'] },
  { id: 'hill-screenshot', text: 'Choose the worse mistake.', options: ['Send the screenshot to them', 'Like a post from 2019'] },
  { id: 'hill-battery', text: 'Choose your curse.', options: ['1% battery forever', 'Wi-Fi drops every hour'] },
  { id: 'hill-plans', text: 'Plans got cancelled last minute.', options: ['Secret relief', 'Instant annoyance'] },
  { id: 'hill-food', text: 'Someone says “I am not hungry” then eats your food.', options: ['Share anyway', 'Protect the plate'] },
  { id: 'hill-alarm', text: 'One has to go forever.', options: ['Snooze button', 'Read receipts'] },
  { id: 'hill-chaos', text: 'You get one harmless power for a day.', options: ['Mute anyone', 'Read deleted messages'] },
  { id: 'hill-game', text: 'A game gets too competitive.', options: ['Lock in harder', 'Pretend not to care'] },
  { id: 'hill-spam', text: 'Which notification gets opened first?', options: ['“we need to talk”', '“you will not believe this”'] },
  { id: 'hill-favour', text: 'Someone owes you a small favour.', options: ['Cash it immediately', 'Save it for later'] },
  { id: 'hill-wrong', text: 'You realise you are completely wrong.', options: ['Admit it', 'Change the subject'] },
  { id: 'hill-party', text: 'At a party you know nobody.', options: ['Find one person', 'Become mysterious furniture'] },
  { id: 'hill-secret', text: 'A friend says “do not tell anyone.”', options: ['Vault mode', 'Tell one trusted person'] },
  { id: 'hill-menu', text: 'Thirty-item menu.', options: ['Try something new', 'Order the usual'] },
  { id: 'hill-reply', text: 'You opened the message and forgot to reply.', options: ['Apologise', 'Act like nothing happened'] },
  { id: 'hill-win', text: 'Which win feels better?', options: ['Proving a point', 'Unexpected free food'] },
  { id: 'hill-trip', text: 'Public embarrassment draft.', options: ['Trip in front of everyone', 'Wave back at nobody'] },
  { id: 'hill-button', text: 'A red button says DO NOT PRESS.', options: ['Press it', 'Walk away'] },
  { id: 'hill-queue', text: 'You spot a much shorter queue.', options: ['Switch immediately', 'Trust your original line'] },
  { id: 'hill-spoiler', text: 'Someone spoils the ending.', options: ['Unforgivable', 'I will survive'] },
  { id: 'hill-mic', text: 'Accidentally unmuted.', options: ['Own it', 'Leave the call'] },
  { id: 'hill-last', text: 'Last slice. Nobody claimed it.', options: ['Take it', 'Wait for permission'] }
]);

const CHALLENGES = Object.freeze([
  { id: 'defend-bad-take', text: 'Defend your last bad take.' },
  { id: 'three-word-roast', text: 'Roast your day in three words.' },
  { id: 'tiny-confession', text: 'Drop one harmless confession.' },
  { id: 'worst-excuse', text: 'Give the worst believable excuse for being late.' },
  { id: 'unpopular-rule', text: 'Invent one ridiculous rule everybody here must follow.' },
  { id: 'main-character', text: 'Describe your current main-character problem in one line.' },
  { id: 'petty-hill', text: 'Name a petty hill you will die on.' },
  { id: 'cancelled-plan', text: 'Pitch the best excuse to cancel plans tonight.' },
  { id: 'bad-advice', text: 'Give one piece of terrible advice with confidence.' },
  { id: 'green-flag', text: 'Name a weird green flag.' },
  { id: 'groupchat-law', text: 'Write one law every group chat should obey.' },
  { id: 'chaos-title', text: 'Give today a dramatic episode title.' }
]);

const idString = (value) => String(value?._id || value || '');

const scopeFor = (user) => (
  user?.isTestAccount
    ? `test:${idString(user.testOwnerId || user._id)}`
    : 'live'
);

const publicUser = (user) => ({
  displayName: user?.displayName || user?.username || 'Someone',
  username: user?.username || null,
  avatar: user?.avatar || null
});

const currentRound = (now = new Date()) => {
  const time = now.getTime();
  const bucket = Math.floor(time / ROUND_MS);
  const prompt = PROMPTS[bucket % PROMPTS.length];
  const startsAt = new Date(bucket * ROUND_MS);
  return {
    roundKey: `r${bucket}`,
    kind: 'PICK_SIDE',
    promptId: prompt.id,
    text: prompt.text,
    options: [...prompt.options],
    startsAt,
    endsAt: new Date(startsAt.getTime() + ROUND_MS)
  };
};

const challengeChoices = (now = new Date()) => {
  const bucket = Math.floor(now.getTime() / (30 * MINUTE));
  const start = bucket % CHALLENGES.length;
  return Array.from({ length: 4 }, (_, index) => CHALLENGES[(start + index) % CHALLENGES.length]);
};

const challengeById = (id) => CHALLENGES.find((item) => item.id === id) || null;

const touchPresence = async (user, now = new Date()) => {
  const scopeKey = scopeFor(user);
  await AfterHoursPresence.findOneAndUpdate(
    { scopeKey, userId: user._id },
    { $set: { lastSeenAt: now } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return scopeKey;
};

const buildReactionState = (reactions, viewerId) => {
  const counts = Object.fromEntries(REACTIONS.map((reaction) => [reaction, 0]));
  let viewerReaction = null;
  reactions.forEach((item) => {
    if (counts[item.reaction] !== undefined) counts[item.reaction] += 1;
    if (idString(item.userId) === idString(viewerId)) viewerReaction = item.reaction;
  });
  return { counts, viewerReaction };
};

const buildSparkState = (sparks, viewerId) => ({
  total: sparks.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  viewerSparked: sparks.some((item) => idString(item.fromUserId) === idString(viewerId))
});

const buildVoteState = (votes, viewerId) => {
  const counts = { REAL: 0, NONSENSE: 0 };
  let viewerVote = null;
  votes.forEach((item) => {
    if (counts[item.vote] !== undefined) counts[item.vote] += 1;
    if (idString(item.userId) === idString(viewerId)) viewerVote = item.vote;
  });
  const total = counts.REAL + counts.NONSENSE;
  return {
    counts,
    total,
    viewerVote,
    realPercent: total > 0 ? Math.round((counts.REAL / total) * 100) : 0,
    nonsensePercent: total > 0 ? Math.round((counts.NONSENSE / total) * 100) : 0
  };
};

const publicActorFor = (item, viewerId) => {
  const isOwn = idString(item.actorId?._id || item.actorId) === idString(viewerId);
  if (item.type === 'CONFESSION' && item.anonymous) {
    return {
      actor: { displayName: 'Anonymous', username: null, avatar: null, anonymous: true },
      isOwn
    };
  }
  return { actor: publicUser(item.actorId), isOwn };
};

const buildRoomSnapshot = async (user, now = new Date()) => {
  const scopeKey = await touchPresence(user, now);
  const round = currentRound(now);
  const activeSince = new Date(now.getTime() - ACTIVE_MS);
  const feedSince = new Date(now.getTime() - FEED_MS);

  const [presences, currentAnswers, activities] = await Promise.all([
    AfterHoursPresence.find({ scopeKey, lastSeenAt: { $gte: activeSince } })
      .sort({ lastSeenAt: -1 })
      .limit(28)
      .populate('userId', 'displayName username avatar isTestAccount testOwnerId')
      .lean(),
    AfterHoursActivity.find({ scopeKey, roundKey: round.roundKey, type: 'ANSWER' })
      .select('actorId choice')
      .lean(),
    AfterHoursActivity.find({ scopeKey, createdAt: { $gte: feedSince } })
      .sort({ createdAt: -1 })
      .limit(90)
      .populate('actorId', 'displayName username avatar')
      .populate('targetUserId', 'displayName username avatar')
      .lean()
  ]);

  const answerByUser = new Map(currentAnswers.map((item) => [idString(item.actorId), item.choice]));
  const viewerAnswer = answerByUser.get(idString(user._id)) || null;
  const tally = Object.fromEntries(round.options.map((option) => [option, 0]));
  currentAnswers.forEach((item) => {
    if (tally[item.choice] !== undefined) tally[item.choice] += 1;
  });

  const challengeIds = activities.filter((item) => item.type === 'CHALLENGE').map((item) => item._id);
  const socialPostIds = activities.filter((item) => SOCIAL_POST_TYPES.includes(item.type)).map((item) => item._id);
  const hotTakeIds = activities.filter((item) => item.type === 'HOT_TAKE').map((item) => item._id);

  const [challengeJoins, replies, votes] = await Promise.all([
    challengeIds.length
      ? AfterHoursActivity.find({
          scopeKey,
          type: 'CHALLENGE_JOIN',
          parentActivityId: { $in: challengeIds }
        }).select('parentActivityId actorId').lean()
      : Promise.resolve([]),
    socialPostIds.length
      ? AfterHoursActivity.find({
          scopeKey,
          type: 'REPLY',
          parentActivityId: { $in: socialPostIds },
          createdAt: { $gte: feedSince }
        })
          .sort({ createdAt: 1 })
          .limit(180)
          .populate('actorId', 'displayName username avatar')
          .lean()
      : Promise.resolve([]),
    hotTakeIds.length
      ? AfterHoursVote.find({ activityId: { $in: hotTakeIds } }).lean()
      : Promise.resolve([])
  ]);

  const contentIds = [...activities.map((item) => item._id), ...replies.map((item) => item._id)];
  const [reactions, sparks] = await Promise.all([
    contentIds.length
      ? AfterHoursReaction.find({ activityId: { $in: contentIds } }).lean()
      : Promise.resolve([]),
    contentIds.length
      ? AfterHoursSpark.find({ activityId: { $in: contentIds } }).lean()
      : Promise.resolve([])
  ]);

  const reactionsByActivity = new Map();
  reactions.forEach((item) => {
    const key = idString(item.activityId);
    if (!reactionsByActivity.has(key)) reactionsByActivity.set(key, []);
    reactionsByActivity.get(key).push(item);
  });

  const sparksByActivity = new Map();
  sparks.forEach((item) => {
    const key = idString(item.activityId);
    if (!sparksByActivity.has(key)) sparksByActivity.set(key, []);
    sparksByActivity.get(key).push(item);
  });

  const votesByActivity = new Map();
  votes.forEach((item) => {
    const key = idString(item.activityId);
    if (!votesByActivity.has(key)) votesByActivity.set(key, []);
    votesByActivity.get(key).push(item);
  });

  const joinsByChallenge = new Map();
  challengeJoins.forEach((item) => {
    const key = idString(item.parentActivityId);
    if (!joinsByChallenge.has(key)) joinsByChallenge.set(key, []);
    joinsByChallenge.get(key).push(item);
  });

  const repliesByPost = new Map();
  replies.forEach((item) => {
    const key = idString(item.parentActivityId);
    if (!repliesByPost.has(key)) repliesByPost.set(key, []);
    repliesByPost.get(key).push(item);
  });

  const recentPostCountByUser = new Map();
  activities.forEach((item) => {
    if (!SOCIAL_POST_TYPES.includes(item.type)) return;
    if (item.type === 'CONFESSION' && item.anonymous) return;
    const key = idString(item.actorId?._id || item.actorId);
    recentPostCountByUser.set(key, (recentPostCountByUser.get(key) || 0) + 1);
  });

  const people = presences
    .filter((item) => item.userId?.username)
    .map((item) => ({
      ...publicUser(item.userId),
      isYou: idString(item.userId?._id) === idString(user._id),
      answeredCurrent: answerByUser.has(idString(item.userId?._id)),
      recentPostCount: recentPostCountByUser.get(idString(item.userId?._id)) || 0
    }));

  const mapReply = (reply) => {
    if (!reply.actorId?.username) return null;
    const { actor, isOwn } = publicActorFor(reply, user._id);
    return {
      id: reply.publicId,
      type: 'REPLY',
      actor,
      isOwn,
      text: reply.text,
      createdAt: reply.createdAt,
      reactions: buildReactionState(reactionsByActivity.get(idString(reply._id)) || [], user._id),
      spark: buildSparkState(sparksByActivity.get(idString(reply._id)) || [], user._id)
    };
  };

  const feed = activities
    .filter((item) => !['REPLY', 'ANSWER', 'CALLOUT'].includes(item.type))
    .map((item) => {
      if (!item.actorId?.username) return null;
      const { actor, isOwn } = publicActorFor(item, user._id);
      const base = {
        id: item.publicId,
        type: item.type,
        actor,
        isOwn,
        anonymous: Boolean(item.type === 'CONFESSION' && item.anonymous),
        burnAmount: Number(item.burnAmount) || 0,
        roundKey: item.roundKey,
        promptText: item.promptText,
        createdAt: item.createdAt,
        reactions: buildReactionState(reactionsByActivity.get(idString(item._id)) || [], user._id),
        spark: buildSparkState(sparksByActivity.get(idString(item._id)) || [], user._id)
      };

      if (item.type === 'ANSWER') return { ...base, choice: item.choice };

      if (item.type === 'CALLOUT' && item.targetUserId?.username) {
        return { ...base, target: publicUser(item.targetUserId) };
      }

      if (SOCIAL_POST_TYPES.includes(item.type)) {
        const postReplies = (repliesByPost.get(idString(item._id)) || []).map(mapReply).filter(Boolean);
        return {
          ...base,
          text: item.text,
          replies: postReplies,
          replyCount: postReplies.length,
          canReply: !(base.anonymous && isOwn),
          vote: item.type === 'HOT_TAKE'
            ? buildVoteState(votesByActivity.get(idString(item._id)) || [], user._id)
            : null
        };
      }

      if (item.type === 'CHALLENGE') {
        const joins = joinsByChallenge.get(idString(item._id)) || [];
        return {
          ...base,
          text: item.text,
          joinCount: joins.length,
          viewerJoined: joins.some((join) => idString(join.actorId) === idString(user._id)),
          canJoin: idString(item.actorId?._id) !== idString(user._id)
        };
      }

      if (item.type === 'CHALLENGE_JOIN' && item.targetUserId?.username) {
        return { ...base, text: item.text, target: publicUser(item.targetUserId) };
      }

      return null;
    })
    .filter(Boolean);

  return {
    generatedAt: now,
    presenceCount: people.length,
    people,
    viewerAuraBalance: Number(user.auraBalance) || 0,
    roomEvent: {
      ...round,
      totalAnswers: currentAnswers.length,
      viewerAnswer,
      tally
    },
    composer: {
      shoutMaxLength: SHOUT_MAX_LENGTH,
      socialPostMaxLength: SOCIAL_POST_MAX_LENGTH,
      replyMaxLength: REPLY_MAX_LENGTH,
      challengeMaxLength: CHALLENGE_MAX_LENGTH,
      challenges: challengeChoices(now),
      burnOptions: [...BURN_OPTIONS]
    },
    aura: {
      sparkAmount: SPARK_AMOUNT,
      sparkDailyLimit: SPARK_DAILY_LIMIT,
      sparkRecipientDailyLimit: SPARK_RECIPIENT_DAILY_LIMIT
    },
    reactions: REACTIONS,
    feed
  };
};

module.exports = {
  ACTIVE_MS,
  FEED_MS,
  SHOUT_MAX_LENGTH,
  SOCIAL_POST_MAX_LENGTH,
  REPLY_MAX_LENGTH,
  CHALLENGE_MAX_LENGTH,
  SPARK_AMOUNT,
  SPARK_DAILY_LIMIT,
  SPARK_RECIPIENT_DAILY_LIMIT,
  BURN_OPTIONS,
  REACTIONS,
  SOCIAL_POST_TYPES,
  SOCIAL_CONTENT_TYPES,
  challengeById,
  challengeChoices,
  currentRound,
  scopeFor,
  touchPresence,
  buildRoomSnapshot
};
