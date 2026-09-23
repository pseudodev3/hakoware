const ContractMoment = require('../models/ContractMoment');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const HOT_SEAT_COOLDOWN_MS = 12 * HOUR;
const HOT_SEAT_OPEN_MS = 12 * HOUR;
const RESOLVED_VISIBLE_MS = 6 * HOUR;

const HOT_SEAT_PROMPTS = Object.freeze([
  {
    id: 'pretend-not-care',
    text: 'If this contract vanished tonight, who would pretend not to care?',
    options: ['Me', 'Them', 'Both of us', 'Neither of us']
  },
  {
    id: 'dry-reply-power',
    text: "Who has more power to ruin the other's mood with one dry reply?",
    options: ['Me', 'Them', 'Both of us', 'Neither of us']
  },
  {
    id: 'argument-fold',
    text: 'Who would fold first after a serious argument?',
    options: ['Me', 'Them', 'Both at once', 'Nobody']
  },
  {
    id: 'distant-first',
    text: 'Who notices first when the other starts acting distant?',
    options: ['Me', 'Them', 'Both instantly', 'Neither']
  },
  {
    id: 'jealous-normal',
    text: 'Who is more likely to get jealous and act completely normal?',
    options: ['Me', 'Them', 'Both of us', 'Nobody admits it']
  },
  {
    id: 'reply-cares',
    text: 'Who secretly cares more about getting a reply?',
    options: ['Me', 'Them', 'Same energy', 'Neither']
  },
  {
    id: 'done-text-first',
    text: "Who would text first after saying “I'm done”?",
    options: ['Me', 'Them', 'Both fold', 'Nobody']
  },
  {
    id: 'unbothered-act',
    text: 'Who is better at pretending they are unbothered?',
    options: ['Me', 'Them', 'Both are frauds', 'Neither']
  },
  {
    id: 'week-disappear',
    text: 'Who would take it more personally if the other disappeared for a week?',
    options: ['Me', 'Them', 'Both of us', 'Neither']
  },
  {
    id: 'one-word-overthink',
    text: 'Who is more likely to overthink a one-word reply?',
    options: ['Me', 'Them', 'Both of us', 'Neither']
  },
  {
    id: 'energy-shift',
    text: "Who notices immediately when the other's energy changes?",
    options: ['Me', 'Them', 'Both instantly', 'Neither']
  },
  {
    id: 'cares-contract',
    text: 'Who actually cares more about keeping this contract alive?',
    options: ['Me', 'Them', 'Same energy', 'Ask us tomorrow']
  }
]);

const idString = (value) => String(value?._id || value || '');

const partnerIdFor = (friendship, userId) => (
  idString(friendship.user1) === idString(userId) ? friendship.user2 : friendship.user1
);

const partnerNameFor = (friendship, userId) => (
  idString(friendship.user1) === idString(userId)
    ? friendship.user2DisplayName || 'your partner'
    : friendship.user1DisplayName || 'your partner'
);

const randomPrompt = () => HOT_SEAT_PROMPTS[Math.floor(Math.random() * HOT_SEAT_PROMPTS.length)];

const recordMomentEvent = (friendshipId, type, userId, metadata = {}) => ContractEvent.create({
  friendshipId,
  userId: userId || null,
  type,
  metadata
});

const refreshMoment = async (moment, now = new Date()) => {
  if (!moment) return null;
  let current = moment;

  if (current.status === 'BREWING' && new Date(current.unlockAt) <= now) {
    const opened = await ContractMoment.findOneAndUpdate(
      { _id: current._id, status: 'BREWING', unlockAt: { $lte: now } },
      { $set: { status: 'OPEN' } },
      { new: true }
    );

    if (opened) {
      current = opened;
      const friendship = await Friendship.findById(current.friendshipId)
        .select('user1 user2 status')
        .lean();

      const writes = [
        recordMomentEvent(current.friendshipId, 'HOT_SEAT_OPENED', null, {
          momentId: String(current._id),
          promptId: current.promptId,
          expiresAt: current.expiresAt
        }).catch(() => null)
      ];

      if (friendship?.status === 'ACTIVE') {
        writes.push(
          Notification.create({
            toUserId: friendship.user1,
            type: 'HOT_SEAT_OPENED',
            title: 'Hot Seat is open',
            message: 'No peeking. Lock your answer before the other person does.',
            friendshipId: current.friendshipId
          }).catch(() => null),
          Notification.create({
            toUserId: friendship.user2,
            type: 'HOT_SEAT_OPENED',
            title: 'Hot Seat is open',
            message: 'No peeking. Lock your answer before the other person does.',
            friendshipId: current.friendshipId
          }).catch(() => null)
        );
      }

      await Promise.all(writes);
    } else {
      current = await ContractMoment.findById(current._id);
      if (!current) return null;
    }
  }

  if (current.status === 'OPEN' && new Date(current.expiresAt) <= now) {
    const expired = await ContractMoment.findOneAndUpdate(
      { _id: current._id, status: 'OPEN', expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' } },
      { new: true }
    );

    if (expired) {
      current = expired;
      await recordMomentEvent(current.friendshipId, 'HOT_SEAT_EXPIRED', null, {
        momentId: String(current._id)
      }).catch(() => null);
    } else {
      current = await ContractMoment.findById(current._id);
    }
  }

  return current;
};

const createBrewingHotSeat = async (friendship, startedByUserId, now = new Date()) => {
  const recent = await ContractMoment.findOne({
    friendshipId: friendship._id,
    type: 'HOT_SEAT',
    createdAt: { $gte: new Date(now.getTime() - HOT_SEAT_COOLDOWN_MS) },
    status: { $in: ['BREWING', 'OPEN', 'RESOLVED'] }
  }).sort({ createdAt: -1 });

  if (recent) {
    if (recent.status === 'RESOLVED') return null;
    return refreshMoment(recent, now);
  }

  const prompt = randomPrompt();
  const brewMinutes = 15 + Math.floor(Math.random() * 21);
  const unlockAt = new Date(now.getTime() + brewMinutes * MINUTE);
  const expiresAt = new Date(unlockAt.getTime() + HOT_SEAT_OPEN_MS);

  const moment = await ContractMoment.create({
    friendshipId: friendship._id,
    type: 'HOT_SEAT',
    status: 'BREWING',
    startedByUserId: startedByUserId || null,
    promptId: prompt.id,
    promptText: prompt.text,
    options: prompt.options,
    responses: [],
    unlockAt,
    expiresAt,
    metadata: { trigger: 'MUTUAL_POKE', season: Number(friendship.season?.number) || 1 }
  });

  await recordMomentEvent(friendship._id, 'HOT_SEAT_BREWING', startedByUserId, {
    momentId: String(moment._id),
    unlockAt,
    expiresAt
  }).catch(() => null);

  return moment;
};

const momentView = (moment, friendship, userId) => {
  if (!moment) return null;
  const viewerId = idString(userId);
  const partnerId = idString(partnerIdFor(friendship, userId));
  const ownResponse = (moment.responses || []).find((item) => idString(item.userId) === viewerId);
  const partnerResponse = (moment.responses || []).find((item) => idString(item.userId) === partnerId);
  const base = {
    id: idString(moment._id),
    type: moment.type,
    status: moment.status,
    unlockAt: moment.unlockAt,
    expiresAt: moment.expiresAt,
    resolvedAt: moment.resolvedAt || null,
    partnerName: partnerNameFor(friendship, userId)
  };

  if (moment.status === 'BREWING') {
    return { ...base, label: 'Something is brewing' };
  }

  if (moment.status === 'OPEN') {
    return {
      ...base,
      label: 'Hot Seat',
      prompt: moment.promptText,
      options: moment.options || [],
      answered: Boolean(ownResponse),
      yourAnswer: ownResponse?.value || null,
      partnerAnswered: Boolean(partnerResponse)
    };
  }

  if (moment.status === 'RESOLVED') {
    return {
      ...base,
      label: 'Hot Seat revealed',
      prompt: moment.promptText,
      yourAnswer: ownResponse?.value || null,
      partnerAnswer: partnerResponse?.value || null
    };
  }

  return null;
};

const getMomentViews = async (userId, friendships) => {
  if (!friendships?.length) return {};
  const friendshipIds = friendships.map((item) => item._id);
  const now = new Date();

  const moments = await ContractMoment.find({
    friendshipId: { $in: friendshipIds },
    $or: [
      { status: { $in: ['BREWING', 'OPEN'] } },
      { status: 'RESOLVED', resolvedAt: { $gte: new Date(now.getTime() - RESOLVED_VISIBLE_MS) } }
    ]
  }).sort({ createdAt: -1 });

  const refreshedMoments = (await Promise.all(moments.map((moment) => refreshMoment(moment, now)))).filter(Boolean);

  const friendshipById = new Map(friendships.map((item) => [idString(item._id), item]));
  const views = {};
  for (const moment of refreshedMoments) {
    if (moment.status === 'EXPIRED') continue;
    const friendshipId = idString(moment.friendshipId);
    if (views[friendshipId]) continue;
    const friendship = friendshipById.get(friendshipId);
    if (!friendship) continue;
    const momentSeason = Number(moment.metadata?.season) || 1;
    const currentSeason = Number(friendship.season?.number) || 1;
    if (momentSeason !== currentSeason) continue;
    views[friendshipId] = momentView(moment, friendship, userId);
  }
  return views;
};

const respondToMoment = async (friendship, userId, momentId, value) => {
  let moment = await ContractMoment.findOne({ _id: momentId, friendshipId: friendship._id });
  if (!moment) {
    const error = new Error('That moment is gone');
    error.status = 404;
    throw error;
  }

  moment = await refreshMoment(moment);
  if (!moment || moment.status !== 'OPEN') {
    const error = new Error(moment?.status === 'BREWING' ? 'Hot Seat is still brewing' : 'That Hot Seat is closed');
    error.status = 409;
    throw error;
  }

  const viewerId = idString(userId);
  const participantIds = [idString(friendship.user1), idString(friendship.user2)];
  if (!participantIds.includes(viewerId)) {
    const error = new Error('Not authorized');
    error.status = 403;
    throw error;
  }

  if ((moment.responses || []).some((item) => idString(item.userId) === viewerId)) {
    const error = new Error('Your answer is already locked');
    error.status = 409;
    throw error;
  }

  const answer = String(value || '').trim();
  if (!(moment.options || []).includes(answer)) {
    const error = new Error('Choose one of the Hot Seat answers');
    error.status = 400;
    throw error;
  }

  moment.responses.push({ userId, value: answer, answeredAt: new Date() });
  const partnerId = partnerIdFor(friendship, userId);
  const actor = await User.findById(userId).select('displayName');

  if (moment.responses.length >= 2) {
    moment.status = 'RESOLVED';
    moment.resolvedAt = new Date();
    await moment.save();

    await Promise.all([
      recordMomentEvent(friendship._id, 'HOT_SEAT_REVEALED', userId, {
        momentId: String(moment._id),
        promptId: moment.promptId
      }).catch(() => null),
      Notification.create({
        toUserId: partnerId,
        fromUserId: userId,
        type: 'HOT_SEAT_REVEALED',
        title: 'Hot Seat revealed',
        message: 'Both answers are in. Go see what happened.',
        friendshipId: friendship._id
      }).catch(() => null)
    ]);
  } else {
    await moment.save();
    await Promise.all([
      recordMomentEvent(friendship._id, 'HOT_SEAT_ANSWERED', userId, {
        momentId: String(moment._id)
      }).catch(() => null),
      Notification.create({
        toUserId: partnerId,
        fromUserId: userId,
        type: 'HOT_SEAT_ANSWERED',
        title: 'Your turn',
        message: `${actor?.displayName || 'Your partner'} answered Hot Seat. Yours is still hidden until you answer.`,
        friendshipId: friendship._id
      }).catch(() => null)
    ]);
  }

  return momentView(moment, friendship, userId);
};

module.exports = {
  HOT_SEAT_PROMPTS,
  createBrewingHotSeat,
  getMomentViews,
  respondToMoment,
  refreshMoment
};
