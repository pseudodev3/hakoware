const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const { bankView } = require('../services/auraBank');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await Promise.all([User, Friendship].map(model => model.createCollection()));
    await mongoose.connection.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard'));
    app.use('/api/friendships', require('../routes/friendships'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api/friendships`;
    const request = async (user, path, method, body) => {
      const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-auth-token': jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const pair = async (xp, seasonStatus = 'ACTIVE', status = 'ACTIVE', duoLevel = 1) => {
      const suffix = randomBytes(8).toString('hex');
      const people = await User.create(['Ari', 'Maya'].map(name => ({ displayName: name, username: name.toLowerCase() + suffix, email: name + suffix + '@example.test', password: 'local-only', auraBalance: 20, notificationPreferences: { email: false } })));
      const start = new Date(Date.now() - 86400000);
      const duo = await Friendship.create({ user1: people[0]._id, user2: people[1]._id, status, duoXP: xp, duoLevel, season: { number: 1, status: seasonStatus, startedAt: start, endsAt: new Date(Date.now() + 86400000) }, user1Perspective: { lastInteraction: start }, user2Perspective: { lastInteraction: start } });
      return { people, duo };
    };
    const assertCredit = async (people, limit) => {
      for (const person of people) {
        const stored = await User.findById(person._id).select('+auraBank +auraWalletReceipts').lean();
        assert.equal(stored.auraBank.creditLimit, limit);
        assert.equal(stored.auraBank.outstanding, 0);
        assert.deepEqual(stored.auraWalletReceipts, [], 'earning a tier must not grant a loan or spend Aura');
      }
    };
    for (const [xp, limit] of [[49, 50], [799, 100]]) {
      const { people, duo } = await pair(xp);
      assert.equal((await request(people[0], `/${duo._id}/checkin`, 'POST', { source: 'TEXT' })).status, 200);
      await assertCredit(people, limit); // Neither participant has opened the bank.
      assert.equal((await request(people[0], `/${duo._id}`, 'DELETE')).status, 200);
      for (const person of people) {
        const bank = await bankView(person._id);
        assert.equal(bank.maxLoan, limit, 'earned credit survives deletion without a bank visit');
        assert.equal(bank.eligible, false, 'a retained tier does not bypass mutual activation');
      }
    }
    for (const [xp, limit] of [[0, 50], [750, 100]]) {
      const { people, duo } = await pair(xp, 'COMPLETE');
      assert.equal((await request(people[0], `/${duo._id}/run-it-back`, 'POST', {})).status, 200);
      await assertCredit(people, limit);
      assert.equal((await request(people[1], `/${duo._id}`, 'DELETE')).status, 200);
      assert.equal((await bankView(people[1]._id)).maxLoan, limit);
    }
    const historical = await pair(800), outsider = await pair(0);
    assert.equal((await request(outsider.people[0], `/${historical.duo._id}`, 'DELETE')).status, 403);
    await assertCredit(historical.people, 25);
    const originalUpdate = User.updateMany;
    try {
      User.updateMany = () => Promise.reject(new Error('Injected credit persistence outage'));
      assert.equal((await request(historical.people[0], `/${historical.duo._id}`, 'DELETE')).status, 500);
    } finally { User.updateMany = originalUpdate; }
    assert.ok(await Friendship.exists({ _id: historical.duo._id }), 'do not delete earned XP when its credit cannot be preserved');
    assert.equal((await request(historical.people[0], `/${historical.duo._id}`, 'DELETE')).status, 200);
    await assertCredit(historical.people, 100);
    assert.equal((await bankView(historical.people[0]._id)).maxLoan, 100, 'pre-existing earned XP is preserved before deletion');
    const delayedCredit = await pair(799);
    try {
      User.updateMany = () => Promise.reject(new Error('Injected credit persistence outage'));
      assert.equal((await request(delayedCredit.people[0], `/${delayedCredit.duo._id}/checkin`, 'POST', { source: 'TEXT' })).status, 200, 'a committed check-in must still succeed if credit persistence needs recovery');
    } finally { User.updateMany = originalUpdate; }
    await assertCredit(delayedCredit.people, 25);
    assert.equal((await request(delayedCredit.people[0], `/${delayedCredit.duo._id}`, 'DELETE')).status, 200);
    await assertCredit(delayedCredit.people, 100, 'deletion recovers credit from the durable XP');
    for (const status of ['PENDING', 'ACTIVE']) {
      const unearned = await pair(status === 'PENDING' ? 800 : 0, 'ACTIVE', status, 99);
      assert.equal((await request(unearned.people[0], `/${unearned.duo._id}`, 'DELETE')).status, 200);
      await assertCredit(unearned.people, 25);
    }
    for (const model of [User, Friendship]) assert.deepEqual((await model.collection.indexes()).map(index => index.name), ['_id_']);
    console.log('Earned Duo credit: both participants, actual check-ins and season bonuses, deletion without a bank visit, historical XP, failed-save recovery, ownership and pending/derived-level guards passed with blocked indexes.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
