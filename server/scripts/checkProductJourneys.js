const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User'), Friendship = require('../models/Friendship'), Event = require('../models/ContractEvent'), GrowthEvent = require('../models/GrowthEvent');
const metrics = require('../services/productMetrics');
const DAY = 86400000, now = new Date('2026-10-13T12:00:00Z'), key = date => date.toISOString().slice(0, 10);
async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } }); let server; const original = User.updateOne;
  try {
    await mongoose.connect(mongo.getUri(), { autoIndex: false }); await Promise.all([User, Friendship, Event, GrowthEvent].map(model => model.createCollection()));
    await mongoose.connection.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    await assert.rejects(GrowthEvent.collection.createIndex({ source: 1 }), /available disk space.*less than required minimum/);
    const [ari, maya, sol, test] = await User.create(['Ari', 'Maya', 'Sol', 'Test'].map(name => ({ displayName: name, email: name + '@example.test', password: 'fixture', isTestAccount: name === 'Test' })));
    assert.equal((await metrics.productSnapshot(now)).retention.day1.rate, null, 'an empty cohort is not a zero-percent return rate');
    const first = new Date(now.getTime() - 8 * DAY);
    await Promise.all(Array.from({ length: 5 }, () => metrics.recordVisit(ari._id, first)));
    await metrics.recordVisit(ari._id, new Date(first.getTime() + DAY)); await metrics.recordVisit(ari._id, new Date(first.getTime() + 7 * DAY)); await metrics.recordVisit(ari._id, now);
    await metrics.recordVisit(maya._id, first); await metrics.recordVisit(sol._id, now); await metrics.recordVisit(test._id, first);
    const stored = await User.findById(ari._id).select('+productActivity'); assert.equal(stored.productActivity.activeDays.length, 4); assert.equal(key(stored.productActivity.firstSeenAt), key(first));
    let snapshot = await metrics.productSnapshot(now); assert.deepEqual(snapshot.retention.day1, { eligible: 2, returned: 1, rate: 50 }); assert.deepEqual(snapshot.retention.day7, { eligible: 2, returned: 1, rate: 50 });
    assert.equal((await User.findById(test._id).select('+productActivity')).productActivity.firstSeenAt, undefined);
    await Promise.all(Array.from({ length: 5 }, () => metrics.recordShopEvent(ari._id, 'SHOP_PREVIEW', 'nocturne', now)));
    await metrics.recordShopEvent(ari._id, 'SHOP_VIEW', null, now); await metrics.recordShopEvent(test._id, 'SHOP_PREVIEW', 'prism', now);
    assert.equal(await GrowthEvent.countDocuments({ type: 'SHOP_PREVIEW' }), 1);
    await assert.rejects(metrics.recordShopEvent(ari._id, 'COSMETIC_PAID', 'nocturne', now), error => error.status === 400);
    await assert.rejects(metrics.recordShopEvent(ari._id, 'SHOP_PREVIEW', 'unknown', now), error => error.status === 400);
    const duo = await Friendship.create({ user1: ari._id, user2: maya._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE', season: { number: 1, status: 'ACTIVE', startedAt: first } });
    await Event.create({ friendshipId: duo._id, userId: ari._id, type: 'CHECKIN', createdAt: first }); await Event.create({ friendshipId: duo._id, userId: sol._id, type: 'CHECKIN', createdAt: now });
    await metrics.recordMutualActivation(duo, now); assert.equal((await User.findById(ari._id).select('+productActivity')).productActivity.firstMutualAt, undefined);
    await Event.create({ friendshipId: duo._id, userId: maya._id, type: 'VOICE_CHECKIN', createdAt: new Date(first.getTime() + DAY) }); await metrics.recordMutualActivation(duo, now);
    assert.equal(key((await User.findById(ari._id).select('+productActivity')).productActivity.firstMutualAt), key(new Date(first.getTime() + DAY)));
    await Friendship.deleteOne({ _id: duo._id }); await metrics.recordMutualActivation(duo, now); assert.equal((await metrics.productSnapshot(now)).activation.usersWithFirstMutual, 2, 'real activation survives an ended Duo');
    // A delayed earlier visit never moves lastSeen backwards; only a bounded set of days is retained.
    await metrics.recordVisit(ari._id, first); const latest = await User.findById(ari._id).select('+productActivity'); assert.equal(latest.productActivity.lastSeenAt.toISOString(), now.toISOString());
    for (let offset = 0; offset < 40; offset++) await metrics.recordVisit(sol._id, new Date(first.getTime() + offset * DAY));
    assert.ok((await User.findById(sol._id).select('+productActivity')).productActivity.activeDays.length <= 35);
    User.updateOne = () => Promise.reject(new Error('Injected measurement outage')); assert.equal(await metrics.recordVisit(ari._id, now), null); User.updateOne = original;
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.FOUNDER_EMAILS = ari.email;
    const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard')); app.use('/api/growth', require('../routes/growth'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const request = async (user, path, body) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/api/growth${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; };
    assert.equal((await request(null, '/metrics')).status, 401); assert.equal((await request(maya, '/metrics')).status, 403);
    assert.equal((await request(ari, '/shop', { type: 'COSMETIC_PAID', packId: 'nocturne' })).status, 400);
    assert.equal((await request(ari, '/shop', { type: 'SHOP_VIEW', userId: String(maya._id) })).status, 400);
    const liveDuo = await Friendship.create({ user1: ari._id, user2: sol._id, user1DisplayName: 'Ari', user2DisplayName: 'Sol', status: 'ACTIVE' });
    await Event.create({ friendshipId: liveDuo._id, userId: ari._id, type: 'CHECKIN' }); assert.equal((await request(ari, '/metrics')).data.duos.activated, 0);
    await Event.create({ friendshipId: liveDuo._id, userId: sol._id, type: 'VOICE_CHECKIN' }); assert.equal((await request(ari, '/metrics')).data.duos.activated, 1);
    console.log('Product journeys: private bounded daily visits, concurrent deduplication, completed-day cohorts, honest empty rates, mutual participant verification, retained activation, founder-only access, no client payment claims, test-account exclusion and measurement outage isolation passed with indexes blocked.');
  } finally { User.updateOne = original; if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
