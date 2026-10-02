const assert = require('node:assert/strict');
const { firstMutualPayoff } = require('../services/duoActivation');

const now = Date.parse('2026-10-02T12:00:00Z');
const contract = {
  _id: 'duo', user1: 'one', user2: 'two',
  season: { number: 1, status: 'ACTIVE', startedAt: new Date(now - 72 * 3600000) }
};
const checkin = (userId, age, xp = 10, type = 'CHECKIN') => ({ userId, xp, type, createdAt: new Date(now - age * 3600000) });

assert.equal(firstMutualPayoff(contract, [], now), null, 'Season activation alone must never count as a check-in');
assert.equal(firstMutualPayoff(contract, [checkin('one', 3), checkin('one', 1)], now), null, 'Repeated actions by one person must not activate a duo');
assert.equal(firstMutualPayoff(contract, [checkin('one', 3), checkin('stranger', 1)], now), null, 'An unrelated actor cannot activate a duo');
assert.equal(firstMutualPayoff(contract, [checkin('one', 73), checkin('two', 1)], now), null, 'Old-season actions must not complete the first mutual check-in');
assert.equal(firstMutualPayoff(contract, [checkin('one', 3), checkin('two', 1, 0, 'POKE')], now), null, 'Social actions are not progression check-ins');
const payoff = firstMutualPayoff(contract, [checkin('two', 1, 15, 'VOICE_CHECKIN'), checkin('one', 20, 99), checkin('one', 60)], now);
assert.equal(payoff.xp, 25, 'Show the actual first text + voice XP, not later XP or a new reward');
assert.equal(payoff.createdAt.getTime(), now - 3600000, 'The second participant completes the shared first');
assert.equal(firstMutualPayoff(contract, [checkin('one', 60), checkin('two', 49)], now), null, 'Do not celebrate old duos retroactively');
assert.equal(firstMutualPayoff({ ...contract, season: { ...contract.season, number: 2 } }, [checkin('one', 3), checkin('two', 1)], now), null);
assert.equal(firstMutualPayoff({ ...contract, season: { ...contract.season, status: 'COMPLETE' } }, [checkin('one', 3), checkin('two', 1)], now), null);
assert.equal(firstMutualPayoff(contract, [checkin('one', 3), checkin('two', -1)], now), null, 'Do not reveal future events');
console.log('First mutual check-in checks passed');
