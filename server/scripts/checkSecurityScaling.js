const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const { loadContractsForUser } = require('../services/contractQueries');
const { debtLeaderboard } = require('../services/debtLeaderboard');
const { calculateDebtState, DAY } = require('../services/debtState');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri()); await Promise.all([User.init(), Friendship.init()]);
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const originalPassword = 'original-fixture-password';
    const owner = await User.create({ displayName: 'Owner', username: 'owner', email: 'owner@example.test', password: await bcrypt.hash(originalPassword, 10), notificationPreferences: { email: false } });
    const token = jwt.sign({ user: { id: String(owner._id), v: 0 } }, process.env.JWT_SECRET);
    let sendReset = async () => {};
    require('../services/emailService').sendResetPasswordEmail = (...args) => sendReset(...args);
    const app = express(); app.use(require('../middleware/securityHeaders')); app.use(express.json()); app.use(require('../middleware/requestGuard'));
    app.use('/api/auth', require('../routes/auth')); app.use('/api/users', require('../routes/users'));
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, body, authToken = null, method = body ? 'POST' : 'GET') => {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(authToken ? { 'x-auth-token': authToken } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, headers: response.headers, data: await response.json() };
    };
    const issueReset = async (expiresAt = new Date(Date.now() + DAY)) => {
      const raw = randomBytes(20).toString('hex');
      await User.updateOne({ _id: owner._id }, { $set: { resetPasswordToken: createHash('sha256').update(raw).digest('hex'), resetPasswordExpire: expiresAt } });
      return raw;
    };
    const reset = await issueReset();
    const passwords = ['first-concurrent-password', 'second-concurrent-password'];
    const results = await Promise.all(passwords.map(password => request('/auth/reset-password', { token: reset, password })));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 400], 'only one concurrent reset may commit');
    const saved = await User.findById(owner._id); const winner = results.findIndex(result => result.status === 200);
    assert.equal(saved.authVersion, 1); assert.equal(saved.resetPasswordToken, undefined); assert.equal(saved.resetPasswordExpire, undefined);
    assert.equal(await bcrypt.compare(passwords[winner], saved.password), true);
    assert.equal(await bcrypt.compare(passwords[1 - winner], saved.password), false);
    assert.equal((await request('/auth/reset-password', { token: reset, password: 'replayed-password' })).status, 400);
    assert.equal((await request('/auth/user', null, token)).status, 401, 'reset must revoke the previous session');
    const login = await request('/auth/login', { identifier: owner.email, password: passwords[winner] }); assert.equal(login.status, 200);
    const account = await request('/auth/user', null, login.data.token); assert.equal(account.status, 200);
    assert.equal(account.headers.get('cache-control'), 'no-store'); assert.equal(account.headers.get('x-content-type-options'), 'nosniff');
    for (const algorithm of ['HS384', 'HS512']) {
      const unexpected = jwt.sign({ user: { id: String(owner._id), v: 1 } }, process.env.JWT_SECRET, { algorithm });
      assert.equal((await request('/auth/user', null, unexpected)).status, 401, `${algorithm} tokens are not issued by Hakoware`);
    }
    for (const password of ['a'.repeat(73), 'é'.repeat(37), { password: 'not-a-string' }]) {
      const result = await request('/auth/signup', { username: 'newplayer', email: 'newplayer@example.test', password });
      assert.equal(result.status, 400); assert.equal(await User.exists({ username: 'newplayer' }), null);
    }
    assert.equal((await request('/auth/reset-password', { token: await issueReset(new Date(Date.now() - 1)), password: 'expired-password' })).status, 400);
    assert.equal((await request('/auth/reset-password', { token: await issueReset(), password: 'é'.repeat(37) })).status, 400);
    const expiring = await issueReset(), originalHash = bcrypt.hash;
    let reachedHash; const hashing = new Promise(resolve => { reachedHash = resolve; }); let finishHash;
    bcrypt.hash = async value => { reachedHash(); await new Promise(resolve => { finishHash = resolve; }); return originalHash(value, 10); };
    try {
      const pending = request('/auth/reset-password', { token: expiring, password: 'expires-during-hash' }); await hashing;
      await User.updateOne({ _id: owner._id }, { $set: { resetPasswordExpire: new Date(Date.now() - 1) } }); finishHash();
      assert.equal((await pending).status, 400, 'expiry is checked again when the password commits');
      assert.equal((await User.findById(owner._id)).authVersion, 1);
    } finally { bcrypt.hash = originalHash; }
    const boundaryPassword = 'é'.repeat(36);
    assert.equal((await request('/auth/reset-password', { token: await issueReset(), password: boundaryPassword })).status, 200);
    assert.equal(await bcrypt.compare(boundaryPassword, (await User.findById(owner._id)).password), true);
    let emailStarted, failFirst; const firstEmail = new Promise(resolve => { emailStarted = resolve; }); let latestDigest;
    sendReset = async (_email, url) => {
      const raw = new URLSearchParams(new URL(url).hash.slice(1)).get('token');
      if (!failFirst) { emailStarted(); await new Promise((_resolve, reject) => { failFirst = reject; }); }
      else latestDigest = createHash('sha256').update(raw).digest('hex');
    };
    const oldEmailRequest = request('/auth/forgot-password', { email: owner.email }); await firstEmail;
    const newerEmailRequest = await request('/auth/forgot-password', { email: owner.email }); assert.equal(newerEmailRequest.status, 200);
    failFirst(new Error('Simulated old email failure')); assert.equal((await oldEmailRequest).status, 200);
    assert.equal((await User.findById(owner._id)).resetPasswordToken, latestDigest, 'an old email failure must not clear a newer reset link');
    console.log('Security: concurrent/replayed/expired reset tokens, UTF-8 bcrypt boundaries, atomic session revocation, JWT algorithms and private headers passed.');

    const now = new Date(); const people = await User.create(Array.from({ length: 64 }, (_, index) => ({ displayName: `Player ${index}`, username: `player${index}`, email: `player${index}@example.test`, password: 'isolated-fixture-only', notificationPreferences: { email: false }, privacySettings: { optOutPublicBankruptcy: index === 63 } })));
    const make = (person, index, status = 'ACTIVE') => ({ user1: owner._id, user2: person._id, status, templateId: 'DONT_GHOST', duoXP: 0, duoLevel: 1, duoTitle: 'New Contract', season: { number: 1, status: 'ACTIVE', startedAt: now, endsAt: new Date(now.getTime() + 30 * DAY) }, user1Perspective: { limit: 3, baseDebt: 0, lastInteraction: now }, user2Perspective: { limit: 3, baseDebt: index, lastInteraction: new Date(now.getTime() - (index % 5) * DAY) } });
    const live = await Friendship.create(people.map((person, index) => make(person, index)));
    const extra = await User.create(['Pending', 'Blocked'].map(name => ({ displayName: name, email: `${name.toLowerCase()}@example.test`, password: 'fixture-only', notificationPreferences: { email: false } })));
    await Friendship.create(make(extra[0], 900, 'PENDING'));
    await Friendship.create(make(extra[1], 1000, 'BLOCKED'));
    const queries = []; mongoose.set('debug', (collection, method) => { queries.push({ collection, method }); });
    let contracts; try { contracts = await loadContractsForUser(String(owner._id)); } finally { mongoose.set('debug', false); }
    assert.equal(contracts.active.length, 64); assert.equal(contracts.pendingSent.length, 1);
    assert.equal(queries.filter(query => query.collection === User.collection.name && query.method === 'find').length, 2, 'partner lookup stays at two queries as the Circle grows');
    assert.ok(contracts.active.every(contract => contract.user2.username && !('email' in contract.user2) && !('password' in contract.user2)));
    const expected = live.map((contract, index) => ({ person: people[index], debt: calculateDebtState(contract.user2Perspective, now) })).filter(row => row.debt.isBankrupt && !row.person.privacySettings.optOutPublicBankruptcy).sort((a, b) => b.debt.totalDebt - a.debt.totalDebt || String(a.person._id).localeCompare(String(b.person._id))).slice(0, 50);
    const board = await debtLeaderboard(owner, now);
    assert.equal(board.length, 50); assert.deepEqual(board.map(row => [row.username, row.totalDebt]), expected.map(row => [row.person.username, row.debt.totalDebt]));
    assert.ok(board.every(row => !('email' in row) && !('password' in row) && !people.some(person => String(person._id) === row._id)));
    assert.ok(!board.some(row => row.username === 'player63'));
    await User.updateOne({ _id: people[62]._id }, { $set: { 'privacySettings.optOutPublicBankruptcy': true } });
    assert.ok(!(await debtLeaderboard(owner, now)).some(row => row.username === 'player62'), 'opt-out applies on the next request without a stale public cache');
    const testPerson = await User.create({ displayName: 'Test player', username: 'testplayer', email: 'testplayer@example.test', password: 'fixture-only', isTestAccount: true, testOwnerId: owner._id });
    const testContract = { ...make(testPerson, 2000), user1: testPerson._id, user2: testPerson._id, isTestData: true, testOwnerId: owner._id };
    await Friendship.create(testContract);
    assert.ok(!(await debtLeaderboard(owner, now)).some(row => row.username === 'testplayer'));
    const testBoard = await debtLeaderboard(testPerson, now); assert.equal(testBoard.length, 1); assert.equal(testBoard[0].username, 'testplayer');
    console.log('Scaling: 64-Duo batch population, active/pending scope, exact debt arithmetic, top-50 bounds, live privacy and test-account isolation passed.');

    const flare = require('../services/flareDelivery'); const originalRecovery = flare.reconcileFlareDelivery; let runs = 0, release;
    const blocked = new Promise(resolve => { release = resolve; }); flare.reconcileFlareDelivery = async () => { runs += 1; await blocked; };
    const { reconcileWorldActivity } = require('../services/worldActivity');
    try { const requests = Array.from({ length: 20 }, () => reconcileWorldActivity()); release(); await Promise.all(requests); assert.equal(runs, 1); }
    finally { flare.reconcileFlareDelivery = originalRecovery; }
    await reconcileWorldActivity({ prune: true });
    console.log('Scaling: 20 concurrent activity requests share one recovery sweep; subsequent recovery and pruning remain available.');
  } finally { mongoose.set('debug', false); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
