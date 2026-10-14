const test = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, deck, shuffle, deal, play } = require('../services/duelRules');
const players = ['one', 'two'];
const fixed = ['WATCHER', 'OATH', 'SIGNAL_FLARE', 'WATCHER', 'GHOST', 'GHOST', 'SIGNAL_FLARE', 'ORBIT', 'PURIFY', 'SIGNAL_FLARE', 'PURIFY', 'SIGNAL_FLARE'];
const fixture = (own, other, drawn = 'GHOST') => ({ ...deal(players, 'one'), hands: { one: [own, drawn], two: [other] }, protected: [], peeks: {}, deck: ['WATCHER', 'GHOST'], aside: ['PURIFY', 'ORBIT'], moves: [] });

test('twelve-card deck, unbiased shuffle inputs and first automatic draw', () => {
  assert.equal(deck().length, 12);
  assert.equal(deck().filter(value => value === 'SIGNAL_FLARE').length, 4);
  const shuffled = shuffle(deck()); assert.deepEqual([...shuffled].sort(), deck().sort());
  const game = deal(players, 'one', fixed);
  assert.deepEqual(game.hands, { one: ['WATCHER', 'GHOST'], two: ['OATH'] });
  assert.equal(game.deck.length, 7); assert.equal(game.aside.length, 2); assert.equal(game.turn, 1);
});
test('the documented six-turn round resolves through a forced Oath discard', () => {
  let game = deal(players, 'one', fixed);
  for (const [actor, input] of [
    ['one', { cardId: 'WATCHER' }], ['two', { cardId: 'GHOST' }],
    ['one', { cardId: 'SIGNAL_FLARE', guess: 'OATH' }], ['two', { cardId: 'ORBIT' }],
    ['one', { cardId: 'PURIFY', target: 'OPPONENT' }], ['two', { cardId: 'PURIFY', target: 'OPPONENT' }],
  ]) game = play(game, actor, input);
  assert.equal(game.status, 'FINISHED'); assert.equal(game.winnerId, 'two');
  assert.equal(game.reason, 'OATH_DISCARDED'); assert.deepEqual(game.hands.one, []);
  assert.equal(game.moves[2].blocked, true); assert.equal(game.moves[5].discardedCardId, 'OATH');
});
test('changing the choice at turn three changes the outcome', () => {
  let game = deal(players, 'one', fixed);
  game = play(game, 'one', { cardId: 'WATCHER' }); game = play(game, 'two', { cardId: 'GHOST' });
  game = play(game, 'one', { cardId: 'GHOST' }); game = play(game, 'two', { cardId: 'ORBIT' });
  assert.equal(game.moves[3].blocked, true);
  game = play(game, 'one', { cardId: 'PURIFY', target: 'OPPONENT' });
  assert.equal(game.winnerId, 'one');
});
test('Flare validates guesses, misses safely and wins on a correct guess', () => {
  const game = fixture('SIGNAL_FLARE', 'OATH');
  for (const guess of ['SIGNAL_FLARE', 'constructor', 'NO_SIGNAL', null, ['OATH']]) assert.throws(() => play(game, 'one', { cardId: 'SIGNAL_FLARE', guess }));
  assert.throws(() => play(game, 'one', { cardId: ['SIGNAL_FLARE'], guess: 'OATH' }));
  assert.equal(play(game, 'one', { cardId: 'SIGNAL_FLARE', guess: 'OATH' }).winnerId, 'one');
  assert.equal(play(game, 'one', { cardId: 'SIGNAL_FLARE', guess: 'WATCHER' }).status, 'ACTIVE');
});
test('Ghost blocks each opponent-targeted card, but not self-redraw', () => {
  for (const cardId of ['SIGNAL_FLARE', 'WATCHER', 'PURIFY', 'ORBIT']) {
    const game = fixture(cardId, 'OATH'); game.protected = ['two'];
    const result = play(game, 'one', { cardId, ...(cardId === 'SIGNAL_FLARE' ? { guess: 'OATH' } : {}), ...(cardId === 'PURIFY' ? { target: 'OPPONENT' } : {}) });
    assert.equal(result.moves[0].blocked, true); assert.equal(result.status, 'ACTIVE'); assert.deepEqual(result.hands.two, ['OATH', 'WATCHER']);
    assert.equal(result.protected.includes('two'), false, 'protection ends before their next draw');
    assert.equal(result.peeks.one, undefined);
  }
  const self = fixture('PURIFY', 'OATH'); self.protected = ['two'];
  assert.equal(play(self, 'one', { cardId: 'PURIFY', target: 'SELF' }).moves[0].outcome, 'REDRAW');
});
test('Watcher records a private dated memory and changing a held card invalidates it', () => {
  let game = play(fixture('WATCHER', 'PURIFY', 'GHOST'), 'one', { cardId: 'WATCHER' });
  assert.equal(game.peeks.one.cardId, 'PURIFY'); assert.equal(game.peeks.one.stale, false);
  assert.equal('peek' in game.moves[0], false); assert.equal('observedCardId' in game.moves[0], false);
  game = play(game, 'two', { cardId: 'PURIFY', target: 'SELF' });
  assert.equal(game.peeks.one.stale, true);
});
test('Slate uses a set-aside card at the end and self-discarding Oath loses', () => {
  const game = fixture('PURIFY', 'WATCHER'); game.deck = [];
  const result = play(game, 'one', { cardId: 'PURIFY', target: 'OPPONENT' });
  assert.equal(result.status, 'FINISHED'); assert.deepEqual(result.hands.two, ['PURIFY']); assert.equal(result.aside.length, 1);
  assert.equal(play(fixture('PURIFY', 'WATCHER', 'OATH'), 'one', { cardId: 'PURIFY', target: 'SELF' }).winnerId, 'two');
});
test('Orbit swaps the remaining cards; playing Oath loses', () => {
  const swap = play(fixture('ORBIT', 'OATH'), 'one', { cardId: 'ORBIT' });
  assert.deepEqual(swap.hands.one, ['OATH']); assert.deepEqual(swap.hands.two, ['GHOST', 'WATCHER']);
  assert.equal(play(fixture('OATH', 'WATCHER'), 'one', { cardId: 'OATH' }).winnerId, 'two');
});
test('last-card comparison ignores protection and equal ranks draw', () => {
  const game = fixture('WATCHER', 'GHOST'); game.deck = []; game.protected = ['two'];
  assert.equal(play(game, 'one', { cardId: 'WATCHER' }).reason, 'DRAW');
  game.hands.one = ['WATCHER', 'OATH'];
  assert.equal(play(game, 'one', { cardId: 'WATCHER' }).winnerId, 'one');
});
test('invalid turns, targets and unowned cards preserve the source game', () => {
  const game = fixture('PURIFY', 'WATCHER'); const original = structuredClone(game);
  for (const [actor, input] of [['two', { cardId: 'WATCHER' }], ['one', { cardId: 'ORBIT' }], ['one', { cardId: 'PURIFY', target: 'stranger' }], ['one', { cardId: 'GHOST', guess: 'OATH' }]]) assert.throws(() => play(game, actor, input));
  assert.deepEqual(game, original);
});
test('2,000 shuffled legal rounds finish within eight turns and conserve all twelve cards', () => {
  for (let round = 0; round < 2000; round += 1) {
    let game = deal(players, round % 2 ? 'one' : 'two');
    while (game.status === 'ACTIVE') {
      const actor = game.currentPlayerId, hand = game.hands[actor];
      const cardId = hand[Math.floor(Math.random() * hand.length)];
      game = play(game, actor, { cardId, ...(cardId === 'SIGNAL_FLARE' ? { guess: ['WATCHER', 'GHOST', 'PURIFY', 'ORBIT', 'OATH'][round % 5] } : {}), ...(cardId === 'PURIFY' ? { target: round % 2 ? 'SELF' : 'OPPONENT' } : {}) });
      const cards = [...Object.values(game.hands).flat(), ...game.deck, ...game.aside, ...game.moves.flatMap(move => [move.cardId, ...(move.discardedCardId ? [move.discardedCardId] : [])])];
      assert.deepEqual(cards.sort(), deck().sort()); assert.ok(game.turn <= 8);
    }
    assert.ok(['GUESS', 'HIGH_CARD', 'DRAW', 'OATH_DISCARDED'].includes(game.reason));
    assert.ok(game.winnerId === null || players.includes(game.winnerId));
  }
});
