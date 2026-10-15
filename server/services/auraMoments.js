// These recognitions use public plays only. They never disclose a private peek
// or a surviving hand before the round has finished.
const descriptions = require('../config/auraMoments.json');
const auraMoments = game => {
  if (!game) return [];
  const moments = [], watched = new Set(), knockedOut = new Map();
  const add = (kind, playerId, turn) => {
    if (playerId && !moments.some(moment => moment.kind === kind && moment.playerId === playerId)) moments.push({ kind, playerId, turn, ...descriptions[kind] });
  };
  for (const move of game.moves || []) {
    if (['WATCHER', 'ORBIT'].includes(move.cardId) && !move.blocked) watched.add(move.actorId);
    if (move.cardId === 'ORBIT' && !move.blocked && move.targetId) watched.add(move.targetId);
    if (move.cardId === 'SIGNAL_FLARE' && move.blocked) add('ghosted', move.targetId, move.turn);
    if (move.outcome === 'CORRECT_GUESS' && !watched.has(move.actorId)) add('cold_read', move.actorId, move.turn);
    if (['CORRECT_GUESS', 'OATH_DISCARDED'].includes(move.outcome) && !move.blocked && move.targetId && move.targetId !== move.actorId) {
      const targets = knockedOut.get(move.actorId) || new Set(); targets.add(move.targetId); knockedOut.set(move.actorId, targets);
      if (targets.size >= 2) add('table_sweep', move.actorId, move.turn);
    }
  }
  if (game.status === 'FINISHED' && ['HIGH_CARD', 'DRAW'].includes(game.reason)) {
    for (const playerId of game.winnerIds || [game.winnerId].filter(Boolean)) if (game.hands?.[playerId]?.includes('OATH')) add('oath_keeper', playerId, game.turn);
  }
  return moments;
};
const bestMoment = (game, playerId) => {
  const priority = ['table_sweep', 'cold_read', 'ghosted', 'oath_keeper'];
  return auraMoments(game).filter(moment => moment.playerId === playerId).sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))[0] || null;
};
module.exports = { auraMoments, bestMoment };
