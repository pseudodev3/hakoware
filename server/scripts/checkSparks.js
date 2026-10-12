const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('crypto');
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
const AfterHoursActivity = require('../models/AfterHoursActivity');
const { notificationView } = require('../services/clientViews');
const { contextFor, feedFor } = require('../services/sparks');

// Exercise the HTTP authorization and retry boundaries; storage uses an isolated
// object map here. The local browser workflow separately checks the real bucket.
const storage = new Map();
const bucket = require('../services/bucketStorage');
bucket.putObject = async (key, bytes, mime) => { storage.set(key, { bytes, mime }); };
bucket.getObject = async key => { const item = storage.get(key); if (!item) throw Object.assign(new Error('Object missing'), { status: 404 }); return new Response(item.bytes, { headers: { 'content-type': item.mime } }); };
bucket.deleteObject = async key => { storage.delete(key); };
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7foAAAAASUVORK5CYII=', 'base64');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, Friendship, SparkPost, SparkReply, SparkReaction, Notification, AfterHoursActivity].map(model => model.init()));
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const [ari, maya, sol, jules, testUser] = await User.create(['Ari', 'Maya', 'Sol', 'Jules', 'Test'].map(name => ({ displayName: name, username: name.toLowerCase(), email: `${name.toLowerCase()}@example.test`, password: 'local-fixture', auraBalance: 100, ...(name === 'Test' ? { isTestAccount: true, testOwnerId: new mongoose.Types.ObjectId() } : {}) })));
    const connect = (one, two, status = 'ACTIVE') => Friendship.create({ user1: one._id, user2: two._id, user1DisplayName: one.displayName, user2DisplayName: two.displayName, status, templateId: 'DONT_GHOST', user1Perspective: { limit: 3 }, user2Perspective: { limit: 3 } });
    const duo = await connect(ari, maya);
    await connect(ari, sol, 'PENDING'); await connect(maya, jules); await connect(ari, testUser);
    const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard')); app.use('/api/sparks', require('../routes/sparks')); app.use('/api/notifications', require('../routes/notifications'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api/sparks`;
    const request = async (user, path = '', method = 'GET', body = null, image = null) => {
      const headers = user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) } : {};
      let data;
      if (image) { data = new FormData(); for (const [key, value] of Object.entries(body || {})) data.append(key, value); data.append('photo', new Blob([image], { type: 'image/png' }), 'moment.png'); }
      else if (body) { headers['content-type'] = 'application/json'; data = JSON.stringify(body); }
      const response = await fetch(base + path, { method, headers, ...(data ? { body: data } : {}) });
      const type = response.headers.get('content-type') || '';
      return { status: response.status, data: type.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer()), headers: response.headers };
    };
    assert.equal((await request(null)).status, 401);
    const payload = { text: 'A quiet coffee and an unexpectedly good day.', clientId: randomUUID() };
    const created = await request(ari, '', 'POST', payload, photo);
    assert.equal(created.status, 200); assert.ok(created.data.post.imageUrl);
    const postId = created.data.post.id;
    const repeats = await Promise.all(Array.from({ length: 4 }, () => request(ari, '', 'POST', payload, photo)));
    assert.ok(repeats.every(result => result.status === 200 && result.data.post.id === postId));
    assert.equal(await SparkPost.countDocuments({ authorId: ari._id }), 1);
    assert.equal(storage.size, 1, 'concurrent upload retries must not leave extra objects');
    const hidden = await request(sol, '', 'POST', { text: 'Pending friends cannot see this.', clientId: randomUUID() });
    await request(jules, '', 'POST', { text: 'Friends of friends are not the circle.', clientId: randomUUID() });
    await request(testUser, '', 'POST', { text: 'Isolated Founder Lab scope.', clientId: randomUUID() });
    const visible = await request(ari);
    assert.deepEqual(visible.data.posts.map(post => post.id), [postId]);
    assert.equal(visible.data.circleSize, 1, 'test accounts cannot cross the live scope even with a malformed contract');
    assert.equal((await request(maya)).data.posts.length, 2);
    for (const outsider of [sol, jules, testUser]) {
      assert.equal((await request(outsider, '/' + postId)).status, 404);
      assert.equal((await request(outsider, `/${postId}/image`)).status, 404);
      assert.equal((await request(outsider, `/${postId}/reaction`, 'PUT', { reaction: '❤️' })).status, 404);
      assert.equal((await request(outsider, `/${postId}/replies`, 'POST', { text: 'Intrusion', clientId: randomUUID() })).status, 404);
    }
    assert.equal((await request(null, `/${postId}/image`)).status, 401);
    const image = await request(maya, `/${postId}/image`);
    assert.equal(image.status, 200); assert.deepEqual(image.data, photo);
    assert.equal(image.headers.get('cache-control'), 'private, no-store');
    for (const privateField of ['photoStorageKey', 'scopeKey', 'authorId', 'clientId', 'email', 'password']) assert.equal(JSON.stringify(created.data).includes(privateField), false);
    await Promise.all(Array.from({ length: 4 }, () => request(maya, `/${postId}/reaction`, 'PUT', { reaction: '❤️' })));
    assert.equal(await SparkReaction.countDocuments(), 1);
    assert.equal(await Notification.countDocuments({ type: 'SPARK_REACTION', toUserId: ari._id }), 1);
    assert.equal((await request(maya, `/${postId}/reaction`, 'PUT', { reaction: '👀' })).data.post.viewerReaction, '👀');
    assert.equal((await request(maya, `/${postId}/reaction`, 'PUT', { reaction: null })).data.post.viewerReaction, null);
    assert.equal((await request(maya, `/${postId}/reaction`, 'PUT', { reaction: 'bad' })).status, 400);
    assert.equal((await User.findById(maya._id)).auraBalance, 100, 'reactions do not mint or spend Aura');
    const replyPayload = { text: 'Save me a seat next time.', clientId: randomUUID() };
    const replies = await Promise.all(Array.from({ length: 5 }, () => request(maya, `/${postId}/replies`, 'POST', replyPayload)));
    assert.ok(replies.every(result => result.status === 200 && result.data.reply.id === replies[0].data.reply.id), JSON.stringify(replies.map(result => ({ status: result.status, error: result.data.msg }))));
    assert.equal(await SparkReply.countDocuments(), 1);
    assert.equal(await Notification.countDocuments({ type: 'SPARK_REPLY', toUserId: ari._id }), 1);
    const notification = notificationView(await Notification.findOne({ type: 'SPARK_REPLY' }));
    assert.equal(notification.sparkPostId, postId); assert.equal(notification.sparkReplyId, replies[0].data.reply.id);
    const notificationResponse = await fetch(base.replace('/sparks', '/notifications'), { headers: { 'x-auth-token': jwt.sign({ user: { id: String(ari._id), v: 0 } }, process.env.JWT_SECRET) } });
    const deliveredNotification = (await notificationResponse.json()).find(item => item.type === 'SPARK_REPLY');
    assert.equal(deliveredNotification.sparkPostId, postId); assert.equal(deliveredNotification.sparkReplyId, replies[0].data.reply.id, 'the Activity API must preserve the exact reply destination');
    const parent = await SparkPost.findOne({ publicId: postId });
    await SparkReply.insertMany(Array.from({ length: 22 }, (_, index) => ({ postId: parent._id, authorId: maya._id, clientId: randomUUID(), text: `Reply ${index}`, createdAt: new Date(Date.now() + index + 1) })));
    const thread = await request(ari, `/${postId}?reply=${replies[0].data.reply.id}`);
    assert.equal(thread.data.replies.length, 20); assert.equal(thread.data.focusReply.text, replyPayload.text); assert.equal(thread.data.hasMore, true);
    const earlier = await request(ari, `/${postId}?before=${thread.data.nextCursor}`);
    assert.equal(earlier.data.replies.length, 3); assert.equal(earlier.data.hasMore, false);
    assert.equal(new Set([...thread.data.replies, ...earlier.data.replies].map(reply => reply.id)).size, 23);
    assert.equal((await request(ari, `/${hidden.data.post.id}?reply=${replies[0].data.reply.id}`)).status, 404);
    assert.equal((await request(ari, '?before=bad')).status, 400);
    assert.equal((await request(ari, '?limit=999')).status, 400);
    assert.equal((await request(ari, '', 'POST', { text: 'x'.repeat(281), clientId: randomUUID() })).status, 400);
    assert.equal((await request(ari, '', 'POST', { text: 'fake photo', clientId: randomUUID() }, Buffer.from('not a real picture'))).status, 400);
    assert.equal((await request(maya, '', 'POST', { text: '', clientId: randomUUID() })).status, 400);
    const legacy = await AfterHoursActivity.create({ scopeKey: 'live', roundKey: 'old', type: 'CONFESSION', actorId: maya._id, promptId: 'old', promptText: 'old', anonymous: true, text: 'A previous anonymous thought.' });
    const archive = await request(ari, `/legacy/${legacy.publicId}`);
    assert.equal(archive.status, 200); assert.equal(archive.data.post.author.username, null); assert.equal(archive.data.post.author.displayName, 'Anonymous');
    assert.equal((await request(testUser, `/legacy/${legacy.publicId}`)).data.post, null);
    await Friendship.deleteOne({ _id: duo._id });
    assert.equal((await request(maya, '/' + postId)).status, 404);
    assert.equal((await request(maya, `/${postId}/image`)).status, 404, 'removing a friendship revokes private photo access');
    await connect(ari, maya);
    assert.equal((await request(maya, '/' + postId, 'DELETE')).status, 404);
    assert.equal((await request(ari, '/' + postId, 'DELETE')).status, 200);
    assert.equal(storage.size, 0); assert.equal(await SparkReply.countDocuments(), 0); assert.equal(await SparkReaction.countDocuments(), 0);
    assert.equal(await Notification.countDocuments({ sparkPostId: postId }), 0);
    assert.equal((await request(ari, '/' + postId)).status, 404);
    // Stable feed pagination also handles rows created at the same instant.
    const at = new Date();
    await SparkPost.insertMany(Array.from({ length: 18 }, (_, index) => ({ scopeKey: 'live', authorId: ari._id, clientId: randomUUID(), text: `Moment ${index}`, createdAt: at })));
    const context = await contextFor(ari._id); const page = await feedFor(context); const next = await feedFor(context, { before: page.nextCursor });
    assert.equal(page.posts.length, 12); assert.equal(next.posts.length, 6); assert.equal(new Set([...page.posts, ...next.posts].map(post => post.id)).size, 18);
    console.log('Sparks: private circle/scope and photo access, revocation, upload/reply/reaction retry recovery, exact links, bounded pagination, anonymous legacy links, unchanged Aura, and owner cleanup passed.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
