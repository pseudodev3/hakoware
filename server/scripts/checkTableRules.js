const test = require('node:test');
const assert = require('node:assert/strict');
const { cards, deck, deal, play, forfeit } = require('../services/tableRules');

const fixture = () => deal(['one', 'two', 'three', 'four'], 'one', ['SIGNAL_FLARE', 'WATCHER', 'GHOST', 'OATH', 'PURIFY', 'WATCHER', 'SIGNAL_FLARE', 'GHOST', 'ORBIT', 'PURIFY', 'SIGNAL_FLARE', 'GHOST', 'ORBIT', 'PURIFY', 'SIGNAL_FLARE', 'WATCHER', 'SIGNAL_FLARE', 'SIGNAL_FLARE']);
test('group deck has eighteen cards and accepts only two to four distinct players', () => {
  assert.equal(deck().length, 18); assert.equal(cards().reduce((sum, card) => sum + card.copies, 0), 18);
  for (const players of [[], ['one'], ['one', 'one'], ['one', 'two', 'three', 'four', 'five']]) assert.throws(() => deal(players, 'one'));
});
test('a correct Flare knocks out its chosen target and play continues past them', () => {
  let game = fixture(); game = play(game, 'one', { cardId: 'SIGNAL_FLARE', targetId: 'two', guess: 'WATCHER' });
  assert.deepEqual(game.eliminated, ['two']); assert.equal(game.status, 'ACTIVE'); assert.equal(game.currentPlayerId, 'three');
  assert.deepEqual(game.hands.two, ['WATCHER']);
});
test('private peeks name only the chosen target and swaps invalidate the right memories', () => {
  let game = fixture(); game.hands.one = ['WATCHER', 'ORBIT'];
  game = play(game, 'one', { cardId: 'WATCHER', targetId: 'four' });
  assert.equal(game.peeks.one.cardId, 'OATH'); assert.equal('observedCardId' in game.moves[0], false);
  game.currentPlayerId = 'one'; game.hands.one.push('GHOST');
  game = play(game, 'one', { cardId: 'ORBIT', targetId: 'four' });
  assert.equal(game.peeks.one.stale, true); assert.deepEqual(game.hands.one, ['OATH']);
});
test('Ghost blocks chosen-target effects; Oath and redraw eliminate only their owner', () => {
  let game = fixture(); game.protected = ['two'];
  game = play(game, 'one', { cardId: 'SIGNAL_FLARE', targetId: 'two', guess: 'WATCHER' });
  assert.equal(game.moves[0].blocked, true); assert.equal(game.eliminated.length, 0); assert.equal(game.currentPlayerId, 'two');
  game = fixture(); game.hands.one = ['PURIFY', 'OATH'];
  game = play(game, 'one', { cardId: 'PURIFY', targetId: 'one' });
  assert.deepEqual(game.eliminated, ['one']); assert.equal(game.status, 'ACTIVE');
  game = fixture(); game.hands.one = ['OATH', 'GHOST'];
  assert.deepEqual(play(game, 'one', { cardId: 'OATH' }).eliminated, ['one']);
});
test('eliminated targets, self-targeting attacks, malicious guesses and wrong turns preserve the game', () => {
  const game = fixture(), copy = structuredClone(game); game.eliminated = ['two']; copy.eliminated = ['two'];
  for (const [actor, body] of [['one', { cardId: 'SIGNAL_FLARE', targetId: 'two', guess: 'OATH' }], ['one', { cardId: 'SIGNAL_FLARE', targetId: 'one', guess: 'OATH' }], ['one', { cardId: 'SIGNAL_FLARE', targetId: 'three', guess: 'constructor' }], ['two', { cardId: 'WATCHER', targetId: 'one' }]]) assert.throws(() => play(game, actor, body));
  assert.deepEqual(game, copy);
});
test('a forfeit skips its owner without interrupting the others; last survivor wins', () => {
  let game = forfeit(fixture(), 'one'); assert.equal(game.currentPlayerId, 'two'); assert.equal(game.status, 'ACTIVE');
  game = forfeit(game, 'three'); assert.equal(game.currentPlayerId, 'two');
  game = forfeit(game, 'two'); assert.equal(game.status, 'FINISHED'); assert.deepEqual(game.winnerIds, ['four']);
  assert.throws(() => forfeit(game, 'four'));
});
test('deck-end comparison excludes knocked-out hands and preserves equal top ranks', () => {
  const game = fixture(); game.deck = []; game.hands.one = ['SIGNAL_FLARE', 'GHOST']; game.hands.two = ['GHOST']; game.hands.three = ['WATCHER']; game.eliminated = ['four'];
  const result = play(game, 'one', { cardId: 'SIGNAL_FLARE', targetId: 'three', guess: 'OATH' });
  assert.equal(result.status, 'FINISHED'); assert.equal(result.reason, 'DRAW'); assert.deepEqual(result.winnerIds, ['one', 'two']);
});
test('3,000 group rounds finish, respect turns and conserve the eighteen-card deck', () => {
  for (let round = 0; round < 3000; round += 1) {
    const players = ['one', 'two', 'three', 'four'].slice(0, 2 + round % 3);
    let game = deal(players, players[round % players.length]);
    while (game.status === 'ACTIVE') {
      const actor = game.currentPlayerId, hand = game.hands[actor], cardId = hand[Math.floor(Math.random() * hand.length)];
      const target = game.players.find(player => player !== actor && !game.eliminated.includes(player));
      game = play(game, actor, { cardId, ...(['SIGNAL_FLARE', 'WATCHER', 'PURIFY', 'ORBIT'].includes(cardId) ? { targetId: cardId === 'PURIFY' && round % 2 ? actor : target } : {}), ...(cardId === 'SIGNAL_FLARE' ? { guess: ['WATCHER', 'GHOST', 'PURIFY', 'ORBIT', 'OATH'][round % 5] } : {}) });
      const all = [...Object.values(game.hands).flat(), ...game.deck, ...game.aside, ...game.moves.flatMap(move => [move.cardId, ...(move.discardedCardId ? [move.discardedCardId] : [])])];
      assert.deepEqual(all.sort(), deck().sort()); assert.ok(game.turn <= 17 - players.length);
      if (game.status === 'ACTIVE') assert.ok(!game.eliminated.includes(game.currentPlayerId));
    }
    assert.ok(game.winnerIds.length >= 1); assert.ok(game.winnerIds.every(player => !game.eliminated.includes(player)));
  }
});
