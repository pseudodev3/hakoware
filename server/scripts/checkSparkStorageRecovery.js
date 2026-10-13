const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const SparkPost = require('../models/SparkPost');
const SparkReply = require('../models/SparkReply');
const SparkReaction = require('../models/SparkReaction');
const Notification = require('../models/Notification');
const WorldActivity = require('../models/WorldActivity');
const { recordEvent } = require('../services/contractGame');
const { reconcileWorldActivity, worldFeed } = require('../services/worldActivity');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    const seed = await mongoose.createConnection(mongo.getUri(), { autoIndex: false }).asPromise();
    const users = ['Ari', 'Maya'].map(name => ({ _id: new mongoose.Types.ObjectId(), displayName: name, username: name.toLowerCase(), email: name+'@example.test', password: 'local-fixture', authVersion: 0, createdAt: new Date() }));
    await seed.collection('users').insertMany(users);
    const contractId = (await seed.collection('friendships').insertOne({ user1: users[0]._id, user2: users[1]._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE' })).insertedId;
    const minimum = (await seed.db.admin().command({ getParameter: 1, indexBuildMinAvailableDiskSpaceMB: 1 })).indexBuildMinAvailableDiskSpaceMB;
    // Trigger MongoDB's actual production failure without filling the test disk.
    await seed.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    await seed.close();
    await mongoose.connect(mongo.getUri());
    const initialization = await Promise.allSettled([User, Friendship, SparkPost, SparkReply, SparkReaction, Notification, WorldActivity].map(model => model.init()));
    assert.equal(initialization[2].status, 'rejected');
    assert.match(initialization[2].reason.message, /available disk space.*less than required minimum/);
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const app = express(); app.use(express.json()); app.use('/api/sparks', require('../routes/sparks'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api/sparks`;
    const request = async (index = 0, method = 'GET', path = '', body) => {
      const response = await fetch(base+path, { method, headers: { 'x-auth-token': jwt.sign({ user: { id: String(users[index]._id), v: 0 } }, process.env.JWT_SECRET), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await request()).status, 200, 'low storage cannot block existing feed reads');
    const draft = { text: 'One Spark after storage recovery.', clientId: randomUUID() };
    const unavailable = await request(0, 'POST', '', draft);
    assert.equal(unavailable.status, 503); assert.equal(unavailable.data.code, 'SPARK_STORAGE_UNAVAILABLE');
    assert.equal(await SparkPost.countDocuments(), 0, 'writes stay protected until unique constraints are ready');
    await recordEvent(contractId, 'DUO_LEVEL_UP', { metadata: { level: 3 } });
    assert.equal((await worldFeed(users[0]._id)).events.length, 1, 'the board publishes using the primary key while secondary indexes cannot build');
    await mongoose.connection.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: minimum });
    // init() remains rejected, but the route must rebuild and recover in this process.
    await assert.rejects(SparkPost.init(), /available disk space/);
    await assert.rejects(WorldActivity.init(), /available disk space/);
    await reconcileWorldActivity();
    assert.equal((await worldFeed(users[0]._id)).events.length, 1, 'recovery does not duplicate a milestone published during low storage');
    const posted = await Promise.all(Array.from({ length: 5 }, () => request(0, 'POST', '', draft)));
    assert.ok(posted.every(result => result.status === 200), JSON.stringify(posted));
    assert.equal(await SparkPost.countDocuments(), 1);
    const postId = posted[0].data.post.id;
    const reply = { text: 'Back in the conversation.', clientId: randomUUID() };
    const replies = await Promise.all(Array.from({ length: 4 }, () => request(1, 'POST', `/${postId}/replies`, reply)));
    assert.ok(replies.every(result => result.status === 200)); assert.equal(await SparkReply.countDocuments(), 1);
    assert.equal((await request(1, 'PUT', `/${postId}/reaction`, { reaction: '✨' })).status, 200);
    assert.equal(await Notification.countDocuments({ type: 'SPARK_REPLY' }), 1);
    assert.equal(await Notification.countDocuments({ type: 'SPARK_REACTION' }), 1);
    assert.equal((await request(0, 'DELETE', `/${postId}`)).status, 200);
    console.log('Real MongoDB disk-threshold failure: reads remain available, unsafe writes stop, Spark indexes and queued world activity recover without restarting, concurrent post/reply retries deduplicate, reactions and deletion pass.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
