const Friendship = require('../models/Friendship');
const User = require('../models/User');
const { publicKey } = require('./clientViews');
const { DAY } = require('./debtState');

const numeric = (field, fallback) => ({ $let: {
  vars: { value: { $convert: { input: field, to: 'double', onError: fallback, onNull: fallback } } },
  in: { $cond: [{ $eq: ['$$value', 0] }, fallback, '$$value'] }
} });

const debtLeaderboard = async (actor, now = new Date()) => {
  const testScope = actor.isTestAccount
    ? { isTestAccount: true, testOwnerId: actor.testOwnerId }
    : { isTestAccount: { $ne: true } };
  const rows = await Friendship.aggregate([
    { $match: actor.isTestAccount
      ? { status: 'ACTIVE', isTestData: true, testOwnerId: actor.testOwnerId }
      : { status: 'ACTIVE', isTestData: { $ne: true } } },
    { $project: { people: [
      { userId: '$user1', state: '$user1Perspective' },
      { userId: '$user2', state: '$user2Perspective' }
    ] } },
    { $unwind: '$people' },
    { $project: {
      userId: '$people.userId',
      limit: { $max: [1, numeric('$people.state.limit', 7)] },
      baseDebt: { $max: [0, numeric('$people.state.baseDebt', 0)] },
      daysMissed: { $floor: { $divide: [{ $max: [0, { $subtract: [now, { $ifNull: ['$people.state.lastInteraction', new Date(0)] }] }] }, DAY] } }
    } },
    { $set: { debt: { $add: ['$baseDebt', { $max: [0, { $subtract: ['$daysMissed', '$limit'] }] }] } } },
    { $group: { _id: '$userId', totalDebt: { $sum: '$debt' }, bankrupt: { $max: { $cond: [{ $gte: ['$debt', { $multiply: ['$limit', 2] }] }, 1, 0] } } } },
    { $match: { bankrupt: 1 } },
    { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', pipeline: [
      { $match: { ...testScope, 'privacySettings.optOutPublicBankruptcy': false } },
      { $project: { displayName: 1, username: 1, avatar: 1 } }
    ], as: 'person' } },
    { $unwind: '$person' },
    { $sort: { totalDebt: -1, _id: 1 } },
    { $limit: 50 },
    { $project: { totalDebt: 1, person: 1 } }
  ]);
  return rows.map(row => ({
    _id: publicKey(row._id, 'shame'),
    displayName: row.person.displayName,
    username: row.person.username || null,
    avatar: row.person.avatar || null,
    totalDebt: row.totalDebt
  }));
};

module.exports = { debtLeaderboard };
