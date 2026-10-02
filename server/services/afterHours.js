const AfterHoursPresence = require('../models/AfterHoursPresence');
const AfterHoursActivity = require('../models/AfterHoursActivity');
const AfterHoursReaction = require('../models/AfterHoursReaction');

const MINUTE = 60 * 1000;
const ROUND_MS = 10 * MINUTE;
const ACTIVE_MS = 5 * MINUTE;
const FEED_MS = 90 * MINUTE;
const REACTIONS = Object.freeze(['💀', '👀', '😭', '🤝']);

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

const buildRoomSnapshot = async (user, now = new Date()) => {
  const scopeKey = await touchPresence(user, now);
  const round = currentRound(now);
  const activeSince = new Date(now.getTime() - ACTIVE_MS);
  const feedSince = new Date(now.getTime() - FEED_MS);

  const [presences, currentAnswers, activities] = await Promise.all([
    AfterHoursPresence.find({ scopeKey, lastSeenAt: { $gte: activeSince } })
      .sort({ lastSeenAt: -1 })
      .limit(24)
      .populate('userId', 'displayName username avatar isTestAccount testOwnerId')
      .lean(),
    AfterHoursActivity.find({ scopeKey, roundKey: round.roundKey, type: 'ANSWER' })
      .select('actorId choice')
      .lean(),
    AfterHoursActivity.find({ scopeKey, createdAt: { $gte: feedSince } })
      .sort({ createdAt: -1 })
      .limit(40)
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

  const answerActivityIds = activities
    .filter((item) => item.type === 'ANSWER')
    .map((item) => item._id);
  const reactions = answerActivityIds.length
    ? await AfterHoursReaction.find({ activityId: { $in: answerActivityIds } }).lean()
    : [];
  const reactionsByActivity = new Map();
  reactions.forEach((item) => {
    const key = idString(item.activityId);
    if (!reactionsByActivity.has(key)) reactionsByActivity.set(key, []);
    reactionsByActivity.get(key).push(item);
  });

  const people = presences
    .filter((item) => item.userId?.username)
    .map((item) => ({
      ...publicUser(item.userId),
      isYou: idString(item.userId?._id) === idString(user._id),
      answeredCurrent: answerByUser.has(idString(item.userId?._id)),
      lastSeenAt: item.lastSeenAt
    }));

  const feed = activities
    .map((item) => {
      if (!item.actorId?.username) return null;
      const base = {
        id: item.publicId,
        type: item.type,
        actor: publicUser(item.actorId),
        roundKey: item.roundKey,
        promptText: item.promptText,
        createdAt: item.createdAt
      };

      if (item.type === 'ANSWER') {
        return {
          ...base,
          choice: item.choice,
          reactions: buildReactionState(reactionsByActivity.get(idString(item._id)) || [], user._id)
        };
      }

      if (item.type === 'CALLOUT' && item.targetUserId?.username) {
        return {
          ...base,
          target: publicUser(item.targetUserId)
        };
      }

      return null;
    })
    .filter(Boolean);

  return {
    generatedAt: now,
    presenceCount: people.length,
    people,
    roomEvent: {
      ...round,
      totalAnswers: currentAnswers.length,
      viewerAnswer,
      tally
    },
    reactions: REACTIONS,
    feed
  };
};

module.exports = {
  ACTIVE_MS,
  FEED_MS,
  REACTIONS,
  currentRound,
  scopeFor,
  touchPresence,
  buildRoomSnapshot
};
