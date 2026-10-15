const { CARDS, shuffle } = require('./duelRules');

const COPIES = Object.freeze({ SIGNAL_FLARE: 6, WATCHER: 3, GHOST: 3, PURIFY: 3, ORBIT: 2, OATH: 1 });
const effects = { SIGNAL_FLARE: 'Guess a player’s hidden card. A correct guess knocks them out. You cannot guess Signal Flare.', WATCHER: 'Privately peek at one player’s hidden card. It may change afterward.', PURIFY: 'Make yourself or another player redraw. Discarding Oath knocks that player out.', ORBIT: 'Swap your hidden card with another player’s.', OATH: 'Highest held rank. Playing or discarding it knocks you out immediately.' };
const cards = () => Object.values(CARDS).map(card => ({ ...card, copies: COPIES[card.id], effect: effects[card.id] || card.effect }));
const deck = () => Object.entries(COPIES).flatMap(([card, count]) => Array(count).fill(card));
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const survivors = game => game.players.filter(player => !game.eliminated.includes(player));
const invalidate = (game, changed) => { for (const peek of Object.values(game.peeks)) if (changed.includes(peek.targetId)) peek.stale = true; };
const eliminate = (game, player) => {
  if (!game.eliminated.includes(player)) game.eliminated.push(player);
  game.protected = game.protected.filter(value => value !== player);
  invalidate(game, [player]);
};
const finish = (game, winners, reason) => { game.status = 'FINISHED'; game.winnerIds = winners; game.reason = reason; game.currentPlayerId = null; };
const advance = (game, after) => {
  const left = survivors(game);
  if (left.length === 1) return finish(game, left, 'LAST_STANDING');
  if (!game.deck.length) {
    const rank = Math.max(...left.map(player => CARDS[game.hands[player][0]].rank));
    const winners = left.filter(player => CARDS[game.hands[player][0]].rank === rank);
    return finish(game, winners, winners.length > 1 ? 'DRAW' : 'HIGH_CARD');
  }
  let next = game.players.indexOf(after);
  do { next = (next + 1) % game.players.length; } while (game.eliminated.includes(game.players[next]));
  const player = game.players[next];
  game.protected = game.protected.filter(value => value !== player);
  game.hands[player].push(game.deck.shift()); game.currentPlayerId = player; game.turn += 1;
};
const deal = (players, starterId, shuffled = shuffle(deck())) => {
  if (players.length < 2 || players.length > 4 || new Set(players).size !== players.length || !players.includes(starterId)) fail('Choose two to four different players.');
  const game = { players: [...players], status: 'ACTIVE', starterId, currentPlayerId: starterId, turn: 1,
    hands: Object.fromEntries(players.map((player, index) => [player, [shuffled[index]]])),
    aside: shuffled.slice(players.length, players.length + 1), deck: shuffled.slice(players.length + 1),
    eliminated: [], forfeited: [], protected: [], peeks: {}, moves: [], winnerIds: [], reason: null };
  game.hands[starterId].push(game.deck.shift());
  return game;
};
const play = (source, player, input, now = new Date()) => {
  const game = structuredClone(source);
  if (game.status !== 'ACTIVE' || game.currentPlayerId !== player) fail('It is not your turn.');
  const card = typeof input.cardId === 'string' && Object.hasOwn(CARDS, input.cardId) ? CARDS[input.cardId] : null;
  if (!card || !game.hands[player].includes(card.id)) fail('Choose a card in your hand.');
  const targeted = ['SIGNAL_FLARE', 'WATCHER', 'PURIFY', 'ORBIT'].includes(card.id);
  const target = input.targetId;
  if (targeted && (typeof target !== 'string' || !survivors(game).includes(target) || card.id !== 'PURIFY' && target === player)) fail('Choose a player still in this round.');
  if (!targeted && target) fail('This card does not need a target.');
  if (card.id === 'SIGNAL_FLARE' && (typeof input.guess !== 'string' || !Object.hasOwn(CARDS, input.guess) || input.guess === 'SIGNAL_FLARE')) fail('Choose an eligible hidden card to guess.');
  if (card.id !== 'SIGNAL_FLARE' && input.guess) fail('This card does not need a guess.');
  const index = game.hands[player].indexOf(card.id); game.hands[player].splice(index, 1);
  if (index === 0) invalidate(game, [player]);
  const blocked = targeted && target !== player && game.protected.includes(target);
  const move = { turn: game.turn, actorId: player, cardId: card.id, blocked, createdAt: now.toISOString(), ...(targeted ? { targetId: target } : {}), ...(input.guess ? { guess: input.guess } : {}) };
  if (blocked) move.outcome = 'BLOCKED';
  else switch (card.id) {
    case 'SIGNAL_FLARE':
      move.outcome = game.hands[target][0] === input.guess ? 'CORRECT_GUESS' : 'MISSED_GUESS';
      if (move.outcome === 'CORRECT_GUESS') eliminate(game, target);
      break;
    case 'WATCHER':
      game.peeks[player] = { targetId: target, cardId: game.hands[target][0], turn: game.turn, stale: false };
      move.outcome = 'PEEK'; break;
    case 'GHOST': game.protected.push(player); move.outcome = 'PROTECTED'; break;
    case 'PURIFY': {
      const discarded = game.hands[target].shift(); move.discardedCardId = discarded; invalidate(game, [target]);
      if (discarded === 'OATH') { eliminate(game, target); move.outcome = 'OATH_DISCARDED'; }
      else { game.hands[target].push(game.deck.length ? game.deck.shift() : game.aside.shift()); move.outcome = 'REDRAW'; }
      break;
    }
    case 'ORBIT':
      [game.hands[player], game.hands[target]] = [game.hands[target], game.hands[player]];
      invalidate(game, [player, target]); move.outcome = 'SWAPPED'; break;
    case 'OATH': eliminate(game, player); move.outcome = 'OATH_PLAYED'; break;
  }
  game.moves.push(move); advance(game, player); return game;
};
const forfeit = (source, player, now = new Date()) => {
  const game = structuredClone(source);
  if (game.status !== 'ACTIVE' || !game.players.includes(player) || game.eliminated.includes(player)) fail('You are no longer playing this round.');
  game.forfeited.push(player); eliminate(game, player);
  game.moves.push({ turn: game.turn, actorId: player, outcome: 'FORFEIT', createdAt: now.toISOString() });
  if (survivors(game).length === 1) finish(game, survivors(game), 'LAST_STANDING');
  else if (game.currentPlayerId === player) {
    // A departing player may have drawn. Keep both cards private until the result.
    advance(game, player);
  }
  return game;
};
module.exports = { cards, deck, deal, play, forfeit };
