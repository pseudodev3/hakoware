const ContractEvent = require('../models/ContractEvent');

const idString = (value) => String(value?._id || value || '');
const PAYOFF_WINDOW_MS = 48 * 60 * 60 * 1000;

// Season activation timestamps are debt baselines, not check-ins. Only real
// check-in events from both participants can complete this shared first.
const firstMutualPayoff = (friendship, checkins, now = Date.now()) => {
  if (friendship.season?.status !== 'ACTIVE' || Number(friendship.season?.number) !== 1) return null;
  const startedAt = new Date(friendship.season?.startedAt || 0).getTime();
  if (!(startedAt > 0)) return null;
  const firstFor = (userId) => checkins
    .filter((event) => idString(event.userId) === idString(userId)
      && ['CHECKIN', 'VOICE_CHECKIN'].includes(event.type)
      && new Date(event.createdAt).getTime() >= startedAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  const first = firstFor(friendship.user1);
  const second = firstFor(friendship.user2);
  if (!first || !second) return null;
  const completedAt = Math.max(new Date(first.createdAt).getTime(), new Date(second.createdAt).getTime());
  if (completedAt > now || completedAt < now - PAYOFF_WINDOW_MS) return null;
  return {
    id: `first-mutual:${idString(friendship._id)}`,
    type: 'FIRST_MUTUAL_CHECKIN',
    createdAt: new Date(completedAt),
    xp: (Number(first.xp) || 0) + (Number(second.xp) || 0)
  };
};

const getFirstMutualPayoffs = async (friendships) => {
  const eligible = friendships.filter((item) => item.season?.status === 'ACTIVE'
    && Number(item.season?.number) === 1 && item.season?.startedAt);
  if (!eligible.length) return {};
  const earliest = await ContractEvent.aggregate([
    { $match: {
      type: { $in: ['CHECKIN', 'VOICE_CHECKIN'] },
      $or: eligible.map((item) => ({
        friendshipId: item._id,
        userId: { $in: [item.user1, item.user2] },
        createdAt: { $gte: new Date(item.season.startedAt) }
      }))
    } },
    { $sort: { createdAt: 1, _id: 1 } },
    { $group: {
      _id: { friendshipId: '$friendshipId', userId: '$userId' },
      event: { $first: '$$ROOT' }
    } }
  ]);
  const byContract = new Map();
  for (const { event } of earliest) {
    const key = idString(event.friendshipId);
    if (!byContract.has(key)) byContract.set(key, []);
    byContract.get(key).push(event);
  }
  return Object.fromEntries(eligible.map((item) => [
    idString(item._id), firstMutualPayoff(item, byContract.get(idString(item._id)) || [])
  ]));
};

module.exports = { firstMutualPayoff, getFirstMutualPayoffs };
