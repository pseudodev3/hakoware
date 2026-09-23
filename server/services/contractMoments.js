const ContractMoment = require('../models/ContractMoment');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MOMENT_OPEN_MS = 12 * HOUR;
const RESOLVED_VISIBLE_MS = 6 * HOUR;
const MOMENT_ORDER = Object.freeze(['HOT_SEAT', 'SPLIT_DECISION', 'DOUBLE_DARE']);

const HOT_SEAT_PROMPTS = Object.freeze([
  { id: 'pretend-not-care', text: 'If this contract vanished tonight, who would pretend not to care?', options: ['Me', 'Them', 'Both of us', 'Neither of us'] },
  { id: 'dry-reply-power', text: "Who has more power to ruin the other's mood with one dry reply?", options: ['Me', 'Them', 'Both of us', 'Neither of us'] },
  { id: 'argument-fold', text: 'Who would fold first after a serious argument?', options: ['Me', 'Them', 'Both at once', 'Nobody'] },
  { id: 'distant-first', text: 'Who notices first when the other starts acting distant?', options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'jealous-normal', text: 'Who is more likely to get jealous and act completely normal?', options: ['Me', 'Them', 'Both of us', 'Nobody admits it'] },
  { id: 'reply-cares', text: 'Who secretly cares more about getting a reply?', options: ['Me', 'Them', 'Same energy', 'Neither'] },
  { id: 'done-text-first', text: "Who would text first after saying “I'm done”?", options: ['Me', 'Them', 'Both fold', 'Nobody'] },
  { id: 'unbothered-act', text: 'Who is better at pretending they are unbothered?', options: ['Me', 'Them', 'Both are frauds', 'Neither'] },
  { id: 'week-disappear', text: 'Who would take it more personally if the other disappeared for a week?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'one-word-overthink', text: 'Who is more likely to overthink a one-word reply?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'energy-shift', text: "Who notices immediately when the other's energy changes?", options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'cares-contract', text: 'Who actually cares more about keeping this contract alive?', options: ['Me', 'Them', 'Same energy', 'Ask us tomorrow'] }
]);

const SPLIT_DECISION_PROMPTS = Object.freeze([
  { id: 'peace-chaos', text: 'Pick the contract energy for tonight.', options: ['Protect the peace', 'Choose chaos'] },
  { id: 'last-word', text: 'Only one of you gets the last word. Who takes it?', options: ['Me', 'Them'] },
  { id: 'reset-receipts', text: 'You can settle one thing without explaining. What do you choose?', options: ['Drop the grudge', 'Keep receipts'] },
  { id: 'tomorrow-rule', text: 'Choose tomorrow’s one unwritten rule.', options: ['No disappearing', 'No dry replies'] },
  { id: 'soft-hard', text: 'How should this contract handle the next weird moment?', options: ['Soft reset', 'Call it out'] },
  { id: 'protect-push', text: 'If the vibe gets tense, what should win?', options: ['Protect the duo', 'Push the issue'] },
  { id: 'say-wait', text: 'Something feels off. What is the move?', options: ['Say it now', 'Wait and watch'] },
  { id: 'forgive-receipt', text: 'One tiny offense happens tonight. What survives?', options: ['Instant forgiveness', 'The receipt'] }
]);

const DOUBLE_DARES = Object.freeze([
  'Use your next tiny note to roast me.',
  'Send a 10-second voice check-in with zero context.',
  'Say one thing you almost kept to yourself.',
  'Give me one painfully specific compliment.',
  'Admit the pettiest thing you noticed this week.',
  'Make your next check-in status “chaos.”',
  'Send the most unserious voice check-in you can.',
  'Tell me one thing I do that is annoyingly predictable.'
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

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const recordMomentEvent = (friendshipId, type, userId, metadata = {}) => ContractEvent.create({
  friendshipId,
  userId: userId || null,
  type,
  metadata
});

const typeLabel = (type) => {
  if (type === 'SPLIT_DECISION') return 'Split Decision';
  if (type === 'DOUBLE_DARE') return 'Double Dare';
  return 'Hot Seat';
};

const eventPrefix = (type) => type;

const openNotificationCopy = (type) => {
  if (type === 'SPLIT_DECISION') {
    return {
      title: 'Split Decision is open',
      message: 'Pick your side. Their answer stays hidden until both choices are locked.'
    };
  }
  return {
    title: 'Hot Seat is open',
    message: 'No peeking. Lock your answer before the other person does.'
  };
};

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
      const prefix = eventPrefix(current.type);
      const copy = openNotificationCopy(current.type);
      const writes = [
        recordMomentEvent(current.friendshipId, `${prefix}_OPENED`, null, {
          momentId: String(current._id),
          promptId: current.promptId,
          expiresAt: current.expiresAt
        }).catch(() => null)
      ];

      if (friendship?.status === 'ACTIVE') {
        writes.push(
          Notification.create({
            toUserId: friendship.user1,
            type: `${prefix}_OPENED`,
            title: copy.title,
            message: copy.message,
            friendshipId: current.friendshipId
          }).catch(() => null),
          Notification.create({
            toUserId: friendship.user2,
            type: `${prefix}_OPENED`,
            title: copy.title,
            message: copy.message,
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
      await recordMomentEvent(current.friendshipId, `${eventPrefix(current.type)}_EXPIRED`, null, {
        momentId: String(current._id)
      }).catch(() => null);
    } else {
      current = await ContractMoment.findById(current._id);
    }
  }

  return current;
};

const nextMomentType = async (friendshipId) => {
  const latest = await ContractMoment.findOne({ friendshipId }).sort({ createdAt: -1 }).select('type').lean();
  if (!latest?.type) return MOMENT_ORDER[0];
  const index = MOMENT_ORDER.indexOf(latest.type);
  return MOMENT_ORDER[(index + 1 + MOMENT_ORDER.length) % MOMENT_ORDER.length];
};

const createMutualMenaceMoment = async (friendship, startedByUserId, now = new Date()) => {
  const active = await ContractMoment.findOne({
    friendshipId: friendship._id,
    status: { $in: ['BREWING', 'OPEN'] }
  }).sort({ createdAt: -1 });

  if (active) return refreshMoment(active, now);

  const type = await nextMomentType(friendship._id);
  const season = Number(friendship.season?.number) || 1;

  if (type === 'DOUBLE_DARE') {
    const expiresAt = new Date(now.getTime() + MOMENT_OPEN_MS);
    const moment = await ContractMoment.create({
      friendshipId: friendship._id,
      type,
      status: 'OPEN',
      startedByUserId: startedByUserId || null,
      promptId: 'double-dare',
      promptText: 'Pick one to send.',
      options: DOUBLE_DARES,
      responses: [],
      unlockAt: now,
      expiresAt,
      metadata: { trigger: 'MUTUAL_POKE', season, stage: 'PICKING' }
    });

    await recordMomentEvent(friendship._id, 'DOUBLE_DARE_STARTED', startedByUserId, {
      momentId: String(moment._id),
      expiresAt
    }).catch(() => null);

    return moment;
  }

  const prompt = type === 'SPLIT_DECISION'
    ? randomItem(SPLIT_DECISION_PROMPTS)
    : randomItem(HOT_SEAT_PROMPTS);
  const brewMinutes = type === 'SPLIT_DECISION'
    ? 8 + Math.floor(Math.random() * 13)
    : 15 + Math.floor(Math.random() * 21);
  const unlockAt = new Date(now.getTime() + brewMinutes * MINUTE);
  const expiresAt = new Date(unlockAt.getTime() + MOMENT_OPEN_MS);

  const moment = await ContractMoment.create({
    friendshipId: friendship._id,
    type,
    status: 'BREWING',
    startedByUserId: startedByUserId || null,
    promptId: prompt.id,
    promptText: prompt.text,
    options: prompt.options,
    responses: [],
    unlockAt,
    expiresAt,
    metadata: { trigger: 'MUTUAL_POKE', season }
  });

  await recordMomentEvent(friendship._id, `${eventPrefix(type)}_BREWING`, startedByUserId, {
    momentId: String(moment._id),
    unlockAt,
    expiresAt
  }).catch(() => null);

  return moment;
};

const sharedHiddenAnswerView = (moment, base, ownResponse, partnerResponse) => {
  const label = typeLabel(moment.type);
  if (moment.status === 'BREWING') {
    return { ...base, label: `${label} brewing` };
  }

  if (moment.status === 'OPEN') {
    return {
      ...base,
      label,
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
      label: `${label} revealed`,
      prompt: moment.promptText,
      yourAnswer: ownResponse?.value || null,
      partnerAnswer: partnerResponse?.value || null,
      matched: moment.type === 'SPLIT_DECISION'
        ? Boolean(ownResponse?.value && ownResponse.value === partnerResponse?.value)
        : null
    };
  }

  return null;
};

const doubleDareView = (moment, friendship, userId, base) => {
  const viewerId = idString(userId);
  const starterId = idString(moment.startedByUserId);
  const isStarter = viewerId === starterId;
  const starterResponse = (moment.responses || []).find((item) => idString(item.userId) === starterId);
  const otherResponse = (moment.responses || []).find((item) => idString(item.userId) !== starterId);
  const partnerName = partnerNameFor(friendship, userId);

  if (moment.status === 'OPEN') {
    if (!starterResponse) {
      return {
        ...base,
        label: 'Double Dare',
        phase: isStarter ? 'PICK' : 'WAITING',
        prompt: isStarter ? 'Pick one to send.' : `${partnerName} is choosing your dare.`,
        options: isStarter ? moment.options || [] : []
      };
    }

    return {
      ...base,
      label: 'Double Dare',
      phase: isStarter ? 'WAITING' : 'RESPOND',
      prompt: isStarter ? `Dare sent to ${partnerName}.` : `${partnerName} dared you:`,
      dare: starterResponse.value,
      options: isStarter ? [] : ['Accept', 'Pass']
    };
  }

  if (moment.status === 'RESOLVED') {
    return {
      ...base,
      label: 'Double Dare resolved',
      phase: 'RESOLVED',
      dare: starterResponse?.value || null,
      outcome: otherResponse?.value || null,
      startedByYou: isStarter
    };
  }

  return null;
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

  if (moment.type === 'DOUBLE_DARE') {
    return doubleDareView(moment, friendship, userId, base);
  }

  return sharedHiddenAnswerView(moment, base, ownResponse, partnerResponse);
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

const resolveSharedMoment = async (moment, friendship, userId, answer) => {
  const viewerId = idString(userId);
  if ((moment.responses || []).some((item) => idString(item.userId) === viewerId)) {
    const error = new Error('Your answer is already locked');
    error.status = 409;
    throw error;
  }

  if (!(moment.options || []).includes(answer)) {
    const error = new Error(`Choose one of the ${typeLabel(moment.type)} answers`);
    error.status = 400;
    throw error;
  }

  moment.responses.push({ userId, value: answer, answeredAt: new Date() });
  const partnerId = partnerIdFor(friendship, userId);
  const actor = await User.findById(userId).select('displayName');
  const prefix = eventPrefix(moment.type);
  const label = typeLabel(moment.type);

  if (moment.responses.length >= 2) {
    moment.status = 'RESOLVED';
    moment.resolvedAt = new Date();
    await moment.save();

    await Promise.all([
      recordMomentEvent(friendship._id, `${prefix}_REVEALED`, userId, {
        momentId: String(moment._id),
        promptId: moment.promptId
      }).catch(() => null),
      Notification.create({
        toUserId: partnerId,
        fromUserId: userId,
        type: `${prefix}_REVEALED`,
        title: `${label} revealed`,
        message: 'Both choices are in. Go see the reveal.',
        friendshipId: friendship._id
      }).catch(() => null)
    ]);
  } else {
    await moment.save();
    await Promise.all([
      recordMomentEvent(friendship._id, `${prefix}_ANSWERED`, userId, {
        momentId: String(moment._id)
      }).catch(() => null),
      Notification.create({
        toUserId: partnerId,
        fromUserId: userId,
        type: `${prefix}_ANSWERED`,
        title: 'Your turn',
        message: `${actor?.displayName || 'Your partner'} answered ${label}. Their choice stays hidden until you answer.`,
        friendshipId: friendship._id
      }).catch(() => null)
    ]);
  }

  return momentView(moment, friendship, userId);
};

const resolveDoubleDare = async (moment, friendship, userId, answer) => {
  const viewerId = idString(userId);
  const starterId = idString(moment.startedByUserId);
  const isStarter = viewerId === starterId;
  const starterResponse = (moment.responses || []).find((item) => idString(item.userId) === starterId);
  const ownResponse = (moment.responses || []).find((item) => idString(item.userId) === viewerId);
  const partnerId = partnerIdFor(friendship, userId);
  const actor = await User.findById(userId).select('displayName');

  if (ownResponse) {
    const error = new Error(isStarter ? 'You already sent this dare' : 'You already answered this dare');
    error.status = 409;
    throw error;
  }

  if (!starterResponse) {
    if (!isStarter) {
      const error = new Error('They are still choosing your dare');
      error.status = 409;
      throw error;
    }
    if (!(moment.options || []).includes(answer)) {
      const error = new Error('Choose one of the dares');
      error.status = 400;
      throw error;
    }

    moment.responses.push({ userId, value: answer, answeredAt: new Date() });
    moment.metadata = { ...(moment.metadata || {}), stage: 'SENT', dare: answer };
    await moment.save();

    await Promise.all([
      recordMomentEvent(friendship._id, 'DOUBLE_DARE_SENT', userId, {
        momentId: String(moment._id),
        dare: answer
      }).catch(() => null),
      Notification.create({
        toUserId: partnerId,
        fromUserId: userId,
        type: 'DOUBLE_DARE_SENT',
        title: 'Double Dare',
        message: `${actor?.displayName || 'Your partner'} sent you a dare. Accept it or pass.`,
        friendshipId: friendship._id
      }).catch(() => null)
    ]);

    return momentView(moment, friendship, userId);
  }

  if (isStarter) {
    const error = new Error('Waiting on your partner');
    error.status = 409;
    throw error;
  }

  if (!['Accept', 'Pass'].includes(answer)) {
    const error = new Error('Accept the dare or pass');
    error.status = 400;
    throw error;
  }

  moment.responses.push({ userId, value: answer, answeredAt: new Date() });
  moment.status = 'RESOLVED';
  moment.resolvedAt = new Date();
  moment.metadata = { ...(moment.metadata || {}), stage: 'RESOLVED', outcome: answer };
  await moment.save();

  const starterUserId = moment.startedByUserId;
  await Promise.all([
    recordMomentEvent(friendship._id, 'DOUBLE_DARE_REVEALED', userId, {
      momentId: String(moment._id),
      outcome: answer
    }).catch(() => null),
    Notification.create({
      toUserId: starterUserId,
      fromUserId: userId,
      type: 'DOUBLE_DARE_REVEALED',
      title: answer === 'Accept' ? 'Dare accepted' : 'Dare passed',
      message: `${actor?.displayName || 'Your partner'} ${answer === 'Accept' ? 'accepted' : 'passed on'} your Double Dare.`,
      friendshipId: friendship._id
    }).catch(() => null)
  ]);

  return momentView(moment, friendship, userId);
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
    const error = new Error(moment?.status === 'BREWING' ? `${typeLabel(moment.type)} is still brewing` : 'That moment is closed');
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

  const answer = String(value || '').trim();
  if (moment.type === 'DOUBLE_DARE') {
    return resolveDoubleDare(moment, friendship, userId, answer);
  }

  return resolveSharedMoment(moment, friendship, userId, answer);
};

module.exports = {
  HOT_SEAT_PROMPTS,
  SPLIT_DECISION_PROMPTS,
  DOUBLE_DARES,
  createMutualMenaceMoment,
  getMomentViews,
  respondToMoment,
  refreshMoment
};
