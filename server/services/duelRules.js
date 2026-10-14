const { randomInt } = require('node:crypto');

const CARDS = Object.freeze({
  SIGNAL_FLARE: { id: 'SIGNAL_FLARE', name: 'Signal Flare', rank: 1, copies: 4, effect: 'Guess their hidden card. A correct guess wins. You cannot guess Signal Flare.' },
  WATCHER: { id: 'WATCHER', name: 'Watcher', rank: 2, copies: 2, effect: 'Privately peek at their hidden card. It may change afterward.' },
  GHOST: { id: 'GHOST', name: 'Ghost', rank: 3, copies: 2, effect: 'Block opponent-targeted effects until your next turn.' },
  PURIFY: { id: 'PURIFY', name: 'Clean Slate', rank: 4, copies: 2, effect: 'Make either player redraw their hidden card. Discarding Oath loses.' },
  ORBIT: { id: 'ORBIT', name: 'Orbit', rank: 5, copies: 1, effect: 'Swap the two hidden cards.' },
  OATH: { id: 'OATH', name: 'Oath', rank: 6, copies: 1, effect: 'Highest held rank. Playing or discarding it loses immediately.' },
});
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const opponent = (game, userId) => game.players.find(player => player !== userId);
const deck = () => Object.values(CARDS).flatMap(card => Array(card.copies).fill(card.id));
const shuffle = (values, choose = randomInt) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = choose(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const invalidatePeeks = (game, changedPlayers) => {
  for (const peek of Object.values(game.peeks)) {
    if (changedPlayers.includes(peek.targetId)) peek.stale = true;
  }
};
const finish = (game, winnerId, reason) => {
  game.status = 'FINISHED';
  game.winnerId = winnerId;
  game.reason = reason;
  game.currentPlayerId = null;
};
const nextTurn = (game, userId) => {
  game.protected = game.protected.filter(value => value !== userId);
  game.hands[userId].push(game.deck.shift());
  game.currentPlayerId = userId;
  game.turn += 1;
};
const deal = (players, starterId, shuffled = shuffle(deck())) => {
  if (players.length !== 2 || !players.includes(starterId)) fail('Invalid players');
  const game = {
    players: [...players], status: 'ACTIVE', starterId, currentPlayerId: null, turn: 0,
    hands: { [players[0]]: [shuffled[0]], [players[1]]: [shuffled[1]] },
    aside: shuffled.slice(2, 4), deck: shuffled.slice(4), protected: [], peeks: {}, moves: [],
    winnerId: null, reason: null,
  };
  nextTurn(game, starterId);
  return game;
};
const play = (source, userId, input, now = new Date()) => {
  const game = structuredClone(source);
  if (game.status !== 'ACTIVE' || game.currentPlayerId !== userId) fail('It is not your turn.');
  const card = typeof input.cardId === 'string' ? CARDS[input.cardId] : null;
  if (!card || !game.hands[userId].includes(card.id)) fail('Choose a card in your hand.');
  if (card.id === 'SIGNAL_FLARE' && (typeof input.guess !== 'string' || !Object.hasOwn(CARDS, input.guess) || input.guess === 'SIGNAL_FLARE')) fail('Choose one of the five eligible cards to guess.');
  if (card.id !== 'SIGNAL_FLARE' && input.guess) fail('This card does not need a guess.');
  if (card.id === 'PURIFY' && !['SELF', 'OPPONENT'].includes(input.target)) fail('Choose who redraws.');
  if (card.id !== 'PURIFY' && input.target) fail('This card does not need a target.');
  const other = opponent(game, userId);
  const targetId = card.id === 'PURIFY' && input.target === 'SELF' ? userId : other;
  const targeted = ['SIGNAL_FLARE', 'WATCHER', 'PURIFY', 'ORBIT'].includes(card.id);
  const blocked = targeted && targetId === other && game.protected.includes(other);
  const playedIndex = game.hands[userId].indexOf(card.id);
  game.hands[userId].splice(playedIndex, 1);
  if (playedIndex === 0) invalidatePeeks(game, [userId]);
  const move = { turn: game.turn, actorId: userId, cardId: card.id, blocked, createdAt: now.toISOString(),
    ...(targeted ? { targetId } : {}), ...(input.guess ? { guess: input.guess } : {}) };
  if (blocked) move.outcome = 'BLOCKED';
  else switch (card.id) {
    case 'SIGNAL_FLARE':
      move.outcome = game.hands[other][0] === input.guess ? 'CORRECT_GUESS' : 'MISSED_GUESS';
      if (move.outcome === 'CORRECT_GUESS') finish(game, userId, 'GUESS');
      break;
    case 'WATCHER':
      game.peeks[userId] = { targetId: other, cardId: game.hands[other][0], turn: game.turn, createdAt: now.toISOString(), stale: false };
      move.outcome = 'PEEK';
      break;
    case 'GHOST':
      game.protected.push(userId);
      move.outcome = 'PROTECTED';
      break;
    case 'PURIFY': {
      const discarded = game.hands[targetId].shift();
      move.discardedCardId = discarded;
      invalidatePeeks(game, [targetId]);
      if (discarded === 'OATH') {
        move.outcome = 'OATH_DISCARDED';
        finish(game, opponent(game, targetId), 'OATH_DISCARDED');
      } else {
        game.hands[targetId].push(game.deck.length ? game.deck.shift() : game.aside.shift());
        move.outcome = 'REDRAW';
      }
      break;
    }
    case 'ORBIT':
      [game.hands[userId], game.hands[other]] = [game.hands[other], game.hands[userId]];
      invalidatePeeks(game, game.players);
      move.outcome = 'SWAPPED';
      break;
    case 'OATH':
      move.outcome = 'OATH_PLAYED';
      finish(game, other, 'OATH_DISCARDED');
      break;
  }
  game.moves.push(move);
  if (game.status === 'ACTIVE') {
    if (!game.deck.length) {
      const a = CARDS[game.hands[game.players[0]][0]].rank;
      const b = CARDS[game.hands[game.players[1]][0]].rank;
      finish(game, a === b ? null : game.players[a > b ? 0 : 1], a === b ? 'DRAW' : 'HIGH_CARD');
    } else nextTurn(game, other);
  }
  return game;
};

module.exports = { CARDS, deck, shuffle, deal, play };
