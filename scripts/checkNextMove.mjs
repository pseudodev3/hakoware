/* eslint-env node */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextMove } from '../src/lib/nextMove.js';

const now = Date.parse('2026-10-12T12:00:00Z');
const hour = 3600000;
const start = now - hour;
const contract = (overrides = {}) => ({
  _id: 'duo', status: 'ACTIVE', user1: { _id: 'one' }, user2: { _id: 'two', username: 'friend' },
  season: { status: 'ACTIVE', number: 1, startedAt: new Date(start).toISOString() },
  user1Perspective: { lastInteraction: new Date(start).toISOString(), limit: 3 },
  user2Perspective: { lastInteraction: new Date(start).toISOString(), limit: 3 },
  ...overrides,
});
const move = (data, user = 'one', social = {}, at = now) => getNextMove([data], user, social, at);

test('acceptance baselines do not count as first check-ins', () => {
  const result = move(contract());
  assert.equal(result.kind, 'first');
  assert.equal(result.ownDone, false);
  assert.equal(result.partnerDone, false);
});
test('first-move guidance survives XP from only one participant', () => {
  const data = contract({ duoXP: 10, user1Perspective: { lastInteraction: new Date(now - 1000).toISOString() } });
  assert.equal(move(data).kind, 'first');
  assert.equal(move(data).ownDone, true);
  assert.equal(move(data).partnerDone, false);
  assert.equal(move(data, 'two').ownDone, false);
  assert.equal(move(data, 'two').partnerDone, true);
});
test('both participants completing their first move replaces onboarding with the actual next window', () => {
  const last = now - 10 * 60 * 1000;
  const data = contract({ user1Perspective: { lastInteraction: last }, user2Perspective: { lastInteraction: last } });
  const result = move(data);
  assert.equal(result.kind, 'later');
  assert.equal(result.at, last + 20 * hour);
  assert.equal(move(data, 'one', {}, last + 20 * hour).kind, 'ready');
});
test('a return message links to the exact unread event ahead of routine timing', () => {
  const data = contract({ season: { status: 'ACTIVE', number: 2, startedAt: start } });
  const result = move(data, 'one', { duo: { unseenActivity: [{ type: 'CHECKIN', id: 'old' }, { type: 'MESSAGE', id: 'reply-42' }] } });
  assert.equal(result.kind, 'reply'); assert.equal(result.eventId, 'reply-42');
});
test('a completed season offers its recap, not a new check-in', () => {
  assert.equal(move(contract({ season: { status: 'COMPLETE', number: 1, startedAt: start } })).kind, 'recap');
});
test('open moments are actionable without inventing rewards or urgency', () => {
  const data = contract({ season: { status: 'ACTIVE', number: 2, startedAt: start } });
  assert.equal(move(data, 'one', { duo: { moment: { status: 'OPEN' } } }).kind, 'moment');
});
test('pending contracts, missing dates, future seasons and active anomalies do not invent check-in availability', () => {
  assert.equal(move(contract({ status: 'PENDING' })), null);
  assert.equal(move(contract({ season: { status: 'ACTIVE', number: 2 }, user1Perspective: {} })), null);
  assert.equal(move(contract({ season: { status: 'ACTIVE', number: 1, startedAt: now + hour } })), null);
  assert.equal(move(contract({ chaos: { activeEvent: { name: 'Voice Tax' } } })), null);
});
test('a future interaction timestamp cannot mark either first move complete', () => {
  const data = contract({ user1Perspective: { lastInteraction: now + hour }, user2Perspective: { lastInteraction: now + hour } });
  assert.equal(move(data).ownDone, false);
  assert.equal(move(data).partnerDone, false);
});
test('A message already offered by the Home lead leaves the next unread friend reachable', () => {
  const first = contract({ season:{ status:'ACTIVE', number:2, startedAt:start } });
  const second = { ...first, _id:'second' };
  const result = getNextMove([first, second], 'one', { duo:{ unseenActivity:[{ type:'MESSAGE', id:'lead-message' }] }, second:{ unseenActivity:[{ type:'MESSAGE', id:'second-message' }] } }, now, 'duo');
  assert.equal(result.kind, 'reply'); assert.equal(result.eventId, 'second-message');
});
test('A handled recap does not repeat, and another completed season remains discoverable', () => {
  const first = contract({ season:{ status:'COMPLETE' } });
  assert.equal(getNextMove([first], 'one', {}, now, 'duo'), null);
  const result = getNextMove([first, { ...first, _id:'second' }], 'one', {}, now, 'duo');
  assert.equal(result.kind, 'recap'); assert.equal(result.contract._id, 'second');
});
test('Handling the lead never removes its first-check-in guide or eligible check-in window', () => {
  assert.equal(getNextMove([contract()], 'one', {}, now, 'duo').kind, 'first');
  const due = contract({ season:{ status:'ACTIVE', number:2, startedAt:now - 2 * 24 * hour }, user1Perspective:{ lastInteraction:now - 21 * hour } });
  assert.equal(getNextMove([due], 'one', {}, now, 'duo').kind, 'ready');
});
