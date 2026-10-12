const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const SparkPost = require('../models/SparkPost');
const SparkReply = require('../models/SparkReply');
const SparkReaction = require('../models/SparkReaction');
const Notification = require('../models/Notification');
const Friendship = require('../models/Friendship');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    const legacy = await mongoose.createConnection(mongo.getUri(), { autoIndex: false }).asPromise();
    await legacy.collection('notifications').createIndex({ toUserId: 1, friendshipId: 1 }, { name: 'toUserId_1_friendshipId_1' });
    await legacy.close();
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, Friendship, SparkPost, SparkReply, SparkReaction].map(model => model.init()));
    const oldIndexFailure = await Notification.init().then(() => null, error => error);
    assert.ok(oldIndexFailure, 'the fixture must reproduce a legacy notification index conflict');
    const user = await User.create({ displayName: 'Ari', username: 'ari', email: 'ari@example.test', password: 'local-fixture' });
    const peer = await User.create({ displayName: 'Maya', username: 'maya', email: 'maya@example.test', password: 'local-fixture' });
    await Friendship.create({ user1: user._id, user2: peer._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE' });
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const token = jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET);
    const app = express(); app.use(express.json()); app.use('/api/sparks', require('../routes/sparks'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const url = `http://127.0.0.1:${server.address().port}/api/sparks`;
    const request = async (method = 'GET', body, path = '', account = user) => {
      const response = await fetch(url + path, { method, headers: { 'x-auth-token': account === user ? token : jwt.sign({ user: { id: String(account._id), v: 0 } }, process.env.JWT_SECRET), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const feed = await request();
    assert.equal(feed.status, 200, 'legacy notification indexes must not block reading Sparks');
    assert.deepEqual(feed.data.posts, []);
    const createIndexes = Notification.collection.createIndexes;
    Notification.collection.createIndexes = function(specs, ...args) { if (specs.some(spec => spec.partialFilterExpression?.type === 'SPARK_REPLY')) return Promise.reject(new Error('Injected reply index outage')); return createIndexes.call(this, specs, ...args); };
    const post = await request('POST', { text: 'A Spark on an existing database.', clientId: randomUUID() });
    assert.equal(post.status, 200, 'Spark writes initialize their own indexes without rebuilding legacy notification indexes');
    assert.equal((await request()).data.posts[0].text, post.data.post.text);
    assert.equal((await request('PUT', { reaction: '❤️' }, `/${post.data.post.id}/reaction`, peer)).status, 200, 'posting and reactions do not depend on reply notification indexes');
    const reply = { text: 'A real reply.', clientId: randomUUID() };
    assert.equal((await request('POST', reply, `/${post.data.post.id}/replies`, peer)).status, 503);
    Notification.collection.createIndexes = createIndexes;
    assert.equal((await request('POST', reply, `/${post.data.post.id}/replies`, peer)).status, 200, 'a failed notification constraint is retried after recovery');
    const indexes = await Notification.collection.indexes();
    assert.ok(indexes.some(index => index.partialFilterExpression?.type === 'SPARK_REPLY' && index.unique));
    assert.ok(indexes.some(index => index.name === 'toUserId_1_friendshipId_1' && !index.unique), 'the hotfix preserves the existing unrelated index');
    console.log('Existing-database Sparks: legacy notification indexes are preserved; operation-specific constraints isolate posts/reactions from reply outages and retry after recovery.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
