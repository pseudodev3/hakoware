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

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    const legacy = await mongoose.createConnection(mongo.getUri(), { autoIndex: false }).asPromise();
    await legacy.collection('notifications').createIndex({ toUserId: 1, friendshipId: 1 }, { name: 'toUserId_1_friendshipId_1' });
    await legacy.close();
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, SparkPost, SparkReply, SparkReaction].map(model => model.init()));
    const oldIndexFailure = await Notification.init().then(() => null, error => error);
    assert.ok(oldIndexFailure, 'the fixture must reproduce a legacy notification index conflict');
    const user = await User.create({ displayName: 'Ari', username: 'ari', email: 'ari@example.test', password: 'local-fixture' });
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const token = jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET);
    const app = express(); app.use(express.json()); app.use('/api/sparks', require('../routes/sparks'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const url = `http://127.0.0.1:${server.address().port}/api/sparks`;
    const request = async (method = 'GET', body) => {
      const response = await fetch(url, { method, headers: { 'x-auth-token': token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const feed = await request();
    assert.equal(feed.status, 200, 'legacy notification indexes must not block reading Sparks');
    assert.deepEqual(feed.data.posts, []);
    const post = await request('POST', { text: 'A Spark on an existing database.', clientId: randomUUID() });
    assert.equal(post.status, 200, 'Spark writes initialize their own indexes without rebuilding legacy notification indexes');
    assert.equal((await request()).data.posts[0].text, post.data.post.text);
    const indexes = await Notification.collection.indexes();
    assert.ok(indexes.some(index => index.partialFilterExpression?.type === 'SPARK_REPLY' && index.unique));
    assert.ok(indexes.some(index => index.name === 'toUserId_1_friendshipId_1' && !index.unique), 'the hotfix preserves the existing unrelated index');
    console.log('Existing-database Sparks: legacy notification index conflicts do not block reads or posts; new Spark indexes are initialized without altering legacy indexes.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
