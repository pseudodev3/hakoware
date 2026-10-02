import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCircleSeen, markCircleSeen, readCircleSeen } from '../src/lib/circleActivity.js';

const storage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
};
const item = (id, type = 'CHECKIN_REPLY') => ({ id, type, createdAt: new Date().toISOString(), text: 'They replied.' });

test('Opening one update leaves other contracts and older unread updates untouched across refresh', () => {
  const store = storage();
  const reply = item('reply');
  const other = item('other');
  const presence = { pulse: [reply, other], contracts: {
    a: { recentActivity: [reply] }, b: { recentActivity: [other] }
  } };
  const seen = markCircleSeen(store, 'one', {}, [reply]);
  const refreshed = applyCircleSeen(presence, readCircleSeen(store, 'one'));
  assert.deepEqual(refreshed.pulse, [other]);
  assert.deepEqual(refreshed.contracts.a.unseenActivity, []);
  assert.deepEqual(refreshed.contracts.b.unseenActivity, [other]);
  assert.deepEqual(readCircleSeen(store, 'two'), {}, 'Founder impersonation/account switching must not share acknowledgements');
  const newReply = item('new-reply');
  assert.deepEqual(applyCircleSeen({ pulse: [newReply], contracts: {} }, seen).pulse, [newReply]);
});

test('Acknowledging the shared first does not silently clear the partner check-in', () => {
  const store = storage();
  const payoff = item('first-mutual:a', 'FIRST_MUTUAL_CHECKIN');
  const checkin = item('checkin', 'CHECKIN');
  const seen = markCircleSeen(store, 'one', {}, [payoff]);
  const result = applyCircleSeen({ pulse: [checkin], contracts: { a: { firstMutualCheckin: payoff, recentActivity: [checkin] } } }, seen);
  assert.equal(result.contracts.a.firstMutualCheckin, null);
  assert.deepEqual(result.contracts.a.unseenActivity, [checkin]);
});

test('Corrupt/unavailable storage and expired acknowledgements do not break Home', () => {
  assert.deepEqual(readCircleSeen({ getItem: () => '{' }, 'one'), {});
  const failing = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
  assert.deepEqual(readCircleSeen(failing, 'one'), {});
  const reply = item('reply');
  assert.ok(markCircleSeen(failing, 'one', {}, [reply]).reply);
  const store = storage();
  const old = { ...reply, id: 'old', createdAt: new Date(Date.now() - 49 * 3600000).toISOString() };
  assert.equal(markCircleSeen(store, 'one', {}, [old]).old, undefined);
});
