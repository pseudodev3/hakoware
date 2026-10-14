const ContractMoment = require('../models/ContractMoment');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const RESOLVED_VISIBLE_MS = 6 * HOUR;
const idString = (value) => String(value?._id || value || '');

const partnerIdFor = (friendship, userId) => (
  idString(friendship.user1) === idString(userId) ? friendship.user2 : friendship.user1
);

const partnerNameFor = (friendship, userId) => (
  idString(friendship.user1) === idString(userId)
    ? friendship.user2DisplayName || 'your partner'
    : friendship.user1DisplayName || 'your partner'
);

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
  if (!(moment.options || []).includes(answer)) {
    const error = new Error(`Choose one of the ${typeLabel(moment.type)} answers`);
    error.status = 400;
    throw error;
  }

  const answeredAt = new Date();
  const updated = await ContractMoment.findOneAndUpdate(
    {
      _id: moment._id,
      status: 'OPEN',
      'responses.userId': { $ne: userId }
    },
    {
      $push: { responses: { userId, value: answer, answeredAt } }
    },
    { new: true }
  );

  if (!updated) {
    const error = new Error('Your answer is already locked');
    error.status = 409;
    throw error;
  }

  moment = updated;
  const partnerId = partnerIdFor(friendship, userId);
  const actor = await User.findById(userId).select('displayName');
  const prefix = eventPrefix(moment.type);
  const label = typeLabel(moment.type);

  if (moment.responses.length >= 2) {
    const resolvedAt = new Date();
    const resolved = await ContractMoment.findOneAndUpdate(
      {
        _id: moment._id,
        status: 'OPEN',
        'responses.1': { $exists: true }
      },
      { $set: { status: 'RESOLVED', resolvedAt } },
      { new: true }
    );

    moment = resolved || await ContractMoment.findById(moment._id);
    if (resolved) {
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
    }
  } else {
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
  const partnerId = partnerIdFor(friendship, userId);
  const actor = await User.findById(userId).select('displayName');

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

    const updated = await ContractMoment.findOneAndUpdate(
      {
        _id: moment._id,
        status: 'OPEN',
        startedByUserId: userId,
        'responses.userId': { $ne: userId }
      },
      {
        $push: { responses: { userId, value: answer, answeredAt: new Date() } },
        $set: {
          'metadata.stage': 'SENT',
          'metadata.dare': answer
        }
      },
      { new: true }
    );

    if (!updated) {
      const error = new Error('You already sent this dare');
      error.status = 409;
      throw error;
    }

    moment = updated;
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

  const resolvedAt = new Date();
  const resolved = await ContractMoment.findOneAndUpdate(
    {
      _id: moment._id,
      status: 'OPEN',
      $and: [
        { 'responses.userId': moment.startedByUserId },
        { 'responses.userId': { $ne: userId } }
      ]
    },
    {
      $push: { responses: { userId, value: answer, answeredAt: resolvedAt } },
      $set: {
        status: 'RESOLVED',
        resolvedAt,
        'metadata.stage': 'RESOLVED',
        'metadata.outcome': answer
      }
    },
    { new: true }
  );

  if (!resolved) {
    const error = new Error('This dare already moved on');
    error.status = 409;
    throw error;
  }

  moment = resolved;
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
  getMomentViews,
  respondToMoment,
  refreshMoment
};
