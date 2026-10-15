const User = require('../models/User');
const { creditAuraEarnings } = require('./auraBank');

const DAILY_ROUNDS = 3, COMPLETION = 5, WIN = 5;
const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);
const keyFor = matchId => `game:${matchId}`;
const policy = Object.freeze({ dailyRounds: DAILY_ROUNDS, completion: COMPLETION, win: WIN, maxDaily: 30, minimumTurns: 2 });
const rewardJobs = (game, players, endedAt) => players.filter(player =>
  !game.forfeited?.includes(player) && game.moves.filter(move => move.actorId === player && move.cardId).length >= 2
).map(player => ({ userId: player, matchId: game.id, day: dayKey(new Date(endedAt)),
  amount: COMPLETION + (game.winnerId === player || game.winnerIds?.includes(player) && game.reason !== 'DRAW' ? WIN : 0),
  createdAt: endedAt }));
const grantReward = async job => {
  // A repaired job may arrive after midnight. Counters belong to the day the
  // round finished, so a delayed credit cannot reset or evade today's cap.
  const path = `gameRewardDays.${job.day}`;
  return creditAuraEarnings(job.userId, job.amount, 'GAME_REWARD', `Card game · completed round${job.amount > COMPLETION ? ' and win' : ''}`, keyFor(job.matchId), {
    filter: { $expr: { $lt: [{ $ifNull: [`$${path}.rounds`, 0] }, DAILY_ROUNDS] } },
    set: { [`${path}.rounds`]: { $add: [{ $ifNull: [`$${path}.rounds`, 0] }, 1] }, [`${path}.earned`]: { $add: [{ $ifNull: [`$${path}.earned`, 0] }, job.amount] } },
    metadata: { matchId: job.matchId, rewardDay: job.day },
  });
};
const flushRewards = async (model, room) => {
  for (const job of room?.rewardQueue || []) {
    try {
      await grantReward(job); // false means the daily cap won the atomic update.
      await model.updateOne({ _id: room._id }, { $pull: { rewardQueue: { userId: job.userId, matchId: job.matchId } } });
    } catch (error) { console.error('Game reward pending:', error.message); }
  }
};
const rewardView = async (userId, game = null) => {
  const user = await User.findById(userId).select('+gameRewardDays +auraWalletReceipts').lean();
  const today = user?.gameRewardDays?.[dayKey()] || {};
  const receipt = game && user?.auraWalletReceipts?.find(item => item.key === keyFor(game.id));
  const eligible = game?.rewardVersion === 1 && game.status === 'FINISHED' && rewardJobs(game, [userId], game.updatedAt).length > 0;
  const round = !game || game.status !== 'FINISHED' || game.rewardVersion !== 1 ? null : receipt
    ? { status: 'EARNED', amount: receipt.amount, repaid: receipt.repaid, spendable: receipt.amount - receipt.repaid }
    : !eligible ? { status: 'SHORT', amount: 0 }
      : (user?.gameRewardDays?.[dayKey(new Date(game.updatedAt))]?.rounds || 0) >= DAILY_ROUNDS ? { status: 'CAPPED', amount: 0 } : { status: 'PENDING', amount: 0 };
  return { ...policy, rounds: today.rounds || 0, earned: today.earned || 0, resetsAt: new Date(Date.parse(`${dayKey()}T00:00:00Z`) + 86400000).toISOString(), round };
};
const reconcileGameRewards = async () => {
  for (const model of [require('../models/DuelRoom'), require('../models/GroupTable')]) {
    const rooms = await model.find({ 'rewardQueue.0': { $exists: true } }).select('+rewardQueue').limit(25).lean();
    for (const room of rooms) await flushRewards(model, room);
  }
};
module.exports = { policy, rewardJobs, flushRewards, rewardView, reconcileGameRewards };
