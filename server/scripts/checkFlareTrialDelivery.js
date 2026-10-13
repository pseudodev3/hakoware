const assert = require('node:assert/strict');
const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const WorldActivity = require('../models/WorldActivity');
const { reconcileFlareDelivery } = require('../services/flareDelivery');
const { worldFeed, publishWorldEvent, reconcileWorldActivity } = require('../services/worldActivity');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    const seed = await mongoose.createConnection(mongo.getUri(), { autoIndex: false }).asPromise();
    const users = ['Ari', 'Maya', 'Sol'].map(name => ({ _id: new mongoose.Types.ObjectId(), displayName: name, username: name.toLowerCase(), email: name+'@example.test', password: 'local-fixture', authVersion: 0, notificationPreferences: { email: false }, auraBalance: 50, inventory: name === 'Ari' ? ['SIGNAL_FLARE', 'SIGNAL_FLARE'] : [], createdAt: new Date(Date.now()-86400000) }));
    await seed.collection('users').insertMany(users);
    const contract = { _id: new mongoose.Types.ObjectId(), user1: users[0]._id, user2: users[1]._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE' };
    await seed.collection('friendships').insertOne(contract);
    // A used Flare saved before the upgrade must also finish its pending delivery.
    const receipt = { eventId: new mongoose.Types.ObjectId(), senderId: users[0]._id, targetId: users[1]._id, createdAt: new Date(Date.now()-60000), done: false };
    await seed.collection('friendships').updateOne({ _id: contract._id }, { $set: { flareReceipts: [receipt] } });
    // Keep the real disk guard failing for the entire test; no capacity recovery.
    await seed.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    await seed.close();
    await mongoose.connect(mongo.getUri());
    const models = [User, Friendship, ContractEvent, Notification, WorldActivity];
    const initialization = await Promise.allSettled(models.map(model => model.init()));
    assert.equal(initialization[4].status, 'rejected');
    assert.match(initialization[4].reason.message, /available disk space.*less than required minimum/);
    assert.deepEqual((await WorldActivity.collection.indexes()).map(index => index.name), ['_id_']);
    await Promise.all(Array.from({ length: 5 }, () => reconcileFlareDelivery(contract._id)));
    assert.equal(await WorldActivity.countDocuments({ sourceEventId: receipt.eventId }), 1, 'pending Flare publishes with only the existing primary index');
    assert.equal(await Notification.countDocuments({ contractEventId: receipt.eventId }), 1, 'recipient delivery deduplicates without a new notification index');
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard'));
    app.use('/api/aura', require('../routes/aura')); app.use('/api/world-activity', require('../routes/worldActivity'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (index, path, body) => {
      const response = await fetch(base+path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-auth-token': jwt.sign({ user: { id: String(users[index]._id), v: 0 } }, process.env.JWT_SECRET) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const results = await Promise.all(Array.from({ length: 2 }, () => request(0, '/aura/use-card', { cardId: 'SIGNAL_FLARE', targetFriendshipId: String(contract._id) })));
    assert.equal(results.filter(result => result.status === 200).length, 1);
    assert.equal((await User.findById(users[0]._id)).inventory.length, 1);
    await Promise.all([reconcileWorldActivity(), reconcileWorldActivity()]);
    const outsider = await request(2, '/world-activity');
    assert.equal(outsider.status, 200); assert.equal(outsider.data.events.length, 2); assert.equal(outsider.data.unreadCount, 2);
    assert.ok(outsider.data.events.every(event => event.type === 'SIGNAL_FLARE' && event.actor.username === 'ari'));
    assert.equal(JSON.stringify(outsider.data).includes('Maya'), false);
    assert.equal(await Notification.countDocuments({ toUserId: users[1]._id, type: 'SIGNAL_FLARE' }), 2);
    assert.equal(await Notification.countDocuments({ toUserId: users[2]._id }), 0, 'other accounts see the shared board, without private recipient details');
    await request(2, '/world-activity/read', { eventIds: outsider.data.events.map(event => event.id) });
    assert.equal((await worldFeed(users[2]._id)).unreadCount, 0);
    const legacyEvent = await ContractEvent.create({ friendshipId: contract._id, type: 'DUO_LEVEL_UP', metadata: { worldEligible: true, level: 3 } });
    const legacyRow = await WorldActivity.create({ sourceEventId: legacyEvent._id, scopeKey: 'live', type: 'DUO_LEVEL_UP', value: 3 });
    await Promise.all(Array.from({ length: 4 }, () => publishWorldEvent(legacyEvent)));
    assert.equal(await WorldActivity.countDocuments({ sourceEventId: legacyEvent._id }), 1);
    assert.equal((await WorldActivity.findOne({ sourceEventId: legacyEvent._id })).publicId, legacyRow.publicId, 'existing board IDs remain stable');
    await WorldActivity.create({ sourceEventId: new mongoose.Types.ObjectId(), scopeKey: 'live', type: 'DUO_LEVEL_UP', value: 9, createdAt: new Date(Date.now()-8*86400000) });
    await reconcileWorldActivity({ prune: true });
    assert.equal(await WorldActivity.countDocuments({ value: 9 }), 0, 'expired public rows are removed even when the TTL index cannot build');
    assert.deepEqual((await WorldActivity.collection.indexes()).map(index => index.name), ['_id_'], 'the test never builds or relaxes an index');
    console.log('Trial storage: pending and new Flares reach recipient and outside accounts, concurrent retries deduplicate using primary keys, unread badges work, legacy board IDs persist, and expired activity is removed without secondary indexes.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
