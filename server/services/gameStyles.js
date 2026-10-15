const User = require('../models/User');
const backs = require('../config/cardBacks.json');
const { hasStyle } = require('./cosmetics');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const roundsPlayed = user => Object.values(user?.gameRewardDays || {}).reduce((sum, day) => sum + (Number(day.rounds) || 0), 0);
const unlocked = (user, back) => back && (back.packId ? hasStyle(user, 'finish', back.packId) : roundsPlayed(user) >= back.rounds);
const effectiveBack = user => {
  const back = backs.find(back => back.id === user?.cardBack);
  return unlocked(user, back) ? back.id : 'original';
};
const projection = 'cardBack +cosmeticUnlocks +gameRewardDays';
const backViews = async userIds => Object.fromEntries((await User.find({ _id: { $in: userIds } }).select(projection).lean()).map(user => [String(user._id), effectiveBack(user)]));
const styleView = async userId => {
  const user = await User.findById(userId).select(projection).lean();
  if (!user) fail(404, 'Account unavailable.');
  return { selected: effectiveBack(user), rewardedRounds: roundsPlayed(user), backs: backs.map(back => ({ ...back, unlocked: Boolean(unlocked(user, back)) })) };
};
const backRequirement = backId => {
  const back = backs.find(value => value.id === backId);
  if (!back) fail(400, 'Choose an available card back.');
  const earned = { $sum: { $map: { input: { $objectToArray: { $ifNull: ['$gameRewardDays', {}] } }, as: 'day', in: { $ifNull: ['$$day.v.rounds', 0] } } } };
  return { back, guard: back.packId ? { cosmeticUnlocks: `finish:${back.packId}` } : back.rounds ? { $expr: { $gte: [earned, back.rounds] } } : {} };
};
const chooseBack = async (userId, body) => {
  if (!body || Array.isArray(body) || Object.keys(body).some(key => key !== 'cardBack') || typeof body.cardBack !== 'string') fail(400, 'Choose a card back.');
  const { back, guard } = backRequirement(body.cardBack);
  const result = await User.updateOne({ _id: userId, ...guard }, { $set: { cardBack: back.id } });
  if (!result.matchedCount) fail(409, back.packId ? 'Unlock this edition in the style shop first.' : `Complete ${back.rounds} rewarded rounds to earn this back.`);
  return styleView(userId);
};
module.exports = { backRequirement, roundsPlayed, effectiveBack, backViews, styleView, chooseBack };
