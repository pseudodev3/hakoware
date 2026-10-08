const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuraTransaction = require('../models/AuraTransaction');
const AfterHoursActivity = require('../models/AfterHoursActivity');
const AfterHoursPresence = require('../models/AfterHoursPresence');
const AfterHoursReaction = require('../models/AfterHoursReaction');
const AfterHoursSpark = require('../models/AfterHoursSpark');
const AfterHoursVote = require('../models/AfterHoursVote');
const { FEED_MS, SOCIAL_FEED_MS, REPLY_PAGE_SIZE, scopeFor } = require('../services/afterHours');

const HOUR = 3600000;
assert.equal(FEED_MS, 3 * HOUR, 'challenges and contract conversion retain their existing window');
assert.equal(SOCIAL_FEED_MS, 48 * HOUR);
assert.equal(REPLY_PAGE_SIZE, 20);
const privateKeys = new Set(['_id', 'actorId', 'targetUserId', 'parentActivityId', 'scopeKey', 'uniqueKey', 'afterHoursReplyId', 'email', 'password', 'testOwnerId', 'usernameNormalized', 'replyNotificationDelivered', 'replyNotificationLease']);
const assertPublic = (value) => {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(privateKeys.has(key), false, 'public room/reply payload leaked ' + key);
    assertPublic(child);
  }
};

const run = async () => {
  // Keep expired fixtures present so the API must enforce expiry before TTL cleanup.
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' }, instance: { args: ['--setParameter', 'ttlMonitorEnabled=false'] } });
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, Notification, AuraTransaction, AfterHoursActivity, AfterHoursPresence, AfterHoursReaction, AfterHoursSpark, AfterHoursVote].map((Model) => Model.init()));
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const testOwner = new mongoose.Types.ObjectId();
    const [one, two, three, testOne, testTwo, foreignTest] = await User.create(['Ari', 'Maya', 'Sol', 'Test Ari', 'Test Maya', 'Other Test'].map((name, index) => ({
      displayName: name, username: ['ari', 'maya', 'sol', 'test_ari', 'test_maya', 'other_test'][index],
      email: `social-${index}@example.test`, password: 'fixture-only', auraBalance: 100,
      ...(index >= 3 ? { isTestAccount: true, testOwnerId: index < 5 ? testOwner : new mongoose.Types.ObjectId() } : {})
    })));
    const now = Date.now();
    const app = express();
    app.use(express.json());
    app.use(require('../middleware/requestGuard'));
    app.use('/api/after-hours', require('../routes/afterHours'));
    app.use('/api/notifications', require('../routes/notifications'));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (actor, path, body = null) => {
      const token = actor ? jwt.sign({ user: { id: String(actor._id), v: 0 } }, process.env.JWT_SECRET) : null;
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: {
        'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {})
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const seed = (actor, extra = {}) => AfterHoursActivity.create({
      scopeKey: scopeFor(actor), roundKey: 'fixture-round', type: 'QUESTION', actorId: actor._id,
      promptId: 'social-question', promptText: 'Ask After Hours', text: 'Anybody still around?', createdAt: new Date(now - 24 * HOUR), ...extra
    });
    const postPath = (post) => '/after-hours/feed/' + post.publicId;
    const replyBody = (text) => ({ text, clientId: randomUUID() });
    const walletState = () => User.find({ _id: { $in: [one._id, two._id, three._id] } }).select('auraBalance inventory').sort({ _id: 1 }).lean();
    const wallets = await walletState();

    assert.equal((await request(null, '/after-hours')).status, 401);
    const created = await request(one, '/after-hours/post', { type: 'QUESTION', text: 'How did the rest of your day go?' });
    assert.equal(created.status, 200);
    const parent = await AfterHoursActivity.findOne({ publicId: created.data.feed.find((item) => item.text === 'How did the rest of your day go?').id });
    await AfterHoursActivity.updateOne({ _id: parent._id }, { $set: { createdAt: new Date(now - 24 * HOUR) } });
    const nextDay = await request(two, '/after-hours');
    assert.ok(nextDay.data.feed.some((item) => item.id === parent.publicId), 'next-day posts stay in the room');
    assert.equal((await request(null, postPath(parent) + '/reply', replyBody('hello'))).status, 401);
    assert.equal((await request(null, postPath(parent) + '/replies')).status, 401);
    const first = await request(two, postPath(parent) + '/reply', replyBody('Made it back. How about you?'));
    const second = await request(two, postPath(parent) + '/reply', replyBody('And did you finish that thing?'));
    const ownerBody = replyBody('I did. Glad you came back.');
    const owner = await request(one, postPath(parent) + '/reply', ownerBody);
    assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(owner.status, 200);
    assert.notEqual(first.data.replyId, second.data.replyId);
    assert.equal(owner.data.feed.find((item) => item.id === parent.publicId).canReply, true);
    assert.equal(await Notification.countDocuments({ toUserId: one._id, type: 'AFTER_HOURS_REPLY' }), 2, 'own public replies do not notify yourself');

    const ownerReply = await AfterHoursActivity.findOne({ publicId: owner.data.replyId });
    assert.equal(String(ownerReply.targetUserId), String(two._id), 'public owner reply targets the most recent other participant');
    const reciprocal = await Notification.findOne({ afterHoursReplyId: ownerReply._id });
    assert.equal(String(reciprocal.toUserId), String(two._id));
    assert.match(reciprocal.message, /conversation/);
    assert.equal(reciprocal.afterHoursActivityId, ownerReply.publicId);
    await Notification.updateOne({ _id: reciprocal._id }, { $set: { read: true } });
    assert.equal((await request(one, postPath(parent) + '/reply', ownerBody)).status, 200);
    assert.equal((await Notification.findById(reciprocal._id)).read, true);
    const removed = await fetch(base + '/notifications/' + reciprocal._id, { method: 'DELETE', headers: { 'x-auth-token': jwt.sign({ user: { id: String(two._id), v: 0 } }, process.env.JWT_SECRET) } });
    assert.equal(removed.status, 200);
    assert.equal((await request(one, postPath(parent) + '/reply', ownerBody)).status, 200);
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: ownerReply._id }), 0, 'a normal later retry cannot resurrect dismissed Activity');
    assert.equal((await AfterHoursActivity.findById(ownerReply._id)).replyNotificationDelivered, undefined, 'delivery bookkeeping is private by default');

    const newParticipant = await request(three, postPath(parent) + '/reply', replyBody('Another person joined the conversation.'));
    assert.equal(newParticipant.status, 200);
    assert.equal((await request(one, postPath(parent) + '/reply', ownerBody)).status, 200);
    assert.equal(String((await AfterHoursActivity.findById(ownerReply._id)).targetUserId), String(two._id), 'retry keeps its originally persisted recipient');
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: ownerReply._id }), 0);
    const freshOwnerReply = await request(one, postPath(parent) + '/reply', replyBody('Welcome back, both of you.'));
    assert.equal(freshOwnerReply.status, 200);
    const newestOwner = await AfterHoursActivity.findOne({ publicId: freshOwnerReply.data.replyId });
    assert.equal(String(newestOwner.targetUserId), String(three._id), 'new owner reply targets the latest other participant');
    assert.equal(String((await Notification.findOne({ afterHoursReplyId: newestOwner._id })).toUserId), String(three._id));

    const concurrentBody = replyBody('Same reply, uncertain connection.');
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => request(two, postPath(parent) + '/reply', concurrentBody)));
    assert.ok(concurrent.every((result) => result.status === 200), JSON.stringify(concurrent));
    assert.equal(new Set(concurrent.map((result) => result.data.replyId)).size, 1);
    const concurrentReply = await AfterHoursActivity.findOne({ publicId: concurrent[0].data.replyId });
    assert.equal(await AfterHoursActivity.countDocuments({ uniqueKey: concurrentReply.uniqueKey }), 1);
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: concurrentReply._id }), 1);
    assert.equal(concurrent[0].data.focus.replyId, concurrentReply.publicId);
    assert.ok(concurrent[0].data.feed.find((item) => item.id === parent.publicId).replies.some((item) => item.id === concurrentReply.publicId));
    await Notification.updateOne({ afterHoursReplyId: concurrentReply._id }, { $set: { read: true } });
    assert.equal((await request(two, postPath(parent) + '/reply', concurrentBody)).status, 200);
    assert.equal((await Notification.findOne({ afterHoursReplyId: concurrentReply._id })).read, true, 'retry never recreates or unread-resets activity');
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: concurrentReply._id }), 1);
    assert.equal((await request(two, postPath(parent) + '/reply', { ...concurrentBody, text: 'A changed message' })).status, 409);
    const otherPost = await seed(one, { text: 'Another conversation.' });
    const soloOwner = await request(one, postPath(otherPost) + '/reply', replyBody('No other participant yet.'));
    assert.equal(soloOwner.status, 200);
    const soloReply = await AfterHoursActivity.findOne({ publicId: soloOwner.data.replyId });
    assert.equal(soloReply.targetUserId, null);
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: soloReply._id }), 0);
    assert.equal((await request(two, postPath(otherPost) + '/reply', concurrentBody)).status, 409, 'actor retry key cannot silently move to a different parent');
    for (const body of [{ text: 'hello', clientId: 'short' }, { text: 'hello', clientId: '' }, replyBody(' '), replyBody('x'.repeat(101))]) {
      assert.equal((await request(two, postPath(parent) + '/reply', body)).status, 400);
    }
    assert.equal((await request(three, '/after-hours/feed/' + concurrentReply.publicId + '/reply', replyBody('Cannot branch.'))).status, 404);

    // Recover a failed in-app notification after the reply has already persisted.
    const notificationUpdate = Notification.updateOne;
    const interruptedBody = replyBody('Delivery survived the notification outage.');
    try {
      Notification.updateOne = async () => { throw new Error('fixture notification outage'); };
      assert.equal((await request(two, postPath(parent) + '/reply', interruptedBody)).status, 500);
    } finally { Notification.updateOne = notificationUpdate; }
    const durable = await AfterHoursActivity.findOne({ text: interruptedBody.text });
    assert.ok(durable);
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: durable._id }), 0);
    const repaired = await request(two, postPath(parent) + '/reply', interruptedBody);
    assert.equal(repaired.status, 200); assert.equal(repaired.data.replyId, durable.publicId);
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: durable._id }), 1);

    // A retry arriving during a failing lease must not return success until it has
    // recovered notification delivery, rather than silently abandoning the signal.
    const racingBody = replyBody('Retry during notification failure.');
    let firstNotification = true;
    let entered;
    const notificationEntered = new Promise((resolve) => { entered = resolve; });
    try {
      Notification.updateOne = async (...args) => {
        if (firstNotification) {
          firstNotification = false; entered();
          await new Promise((resolve) => setTimeout(resolve, 75));
          throw new Error('fixture concurrent notification outage');
        }
        return notificationUpdate.apply(Notification, args);
      };
      const original = request(three, postPath(parent) + '/reply', racingBody);
      await notificationEntered;
      const retry = request(three, postPath(parent) + '/reply', racingBody);
      const outcomes = await Promise.all([original, retry]);
      assert.deepEqual(outcomes.map((item) => item.status).sort(), [200, 500]);
      const saved = await AfterHoursActivity.findOne({ text: racingBody.text });
      assert.equal(await AfterHoursActivity.countDocuments({ uniqueKey: saved.uniqueKey }), 1);
      assert.equal(await Notification.countDocuments({ afterHoursReplyId: saved._id }), 1);
    } finally { Notification.updateOne = notificationUpdate; }

    // A snapshot failure also leaves one durable reply and one activity item on retry.
    const presenceUpdate = AfterHoursPresence.findOneAndUpdate;
    const uncertainBody = replyBody('The response was lost after sending.');
    try {
      AfterHoursPresence.findOneAndUpdate = async () => { throw new Error('fixture response outage'); };
      assert.equal((await request(two, postPath(parent) + '/reply', uncertainBody)).status, 500);
    } finally { AfterHoursPresence.findOneAndUpdate = presenceUpdate; }
    const confirmed = await request(two, postPath(parent) + '/reply', uncertainBody);
    assert.equal(confirmed.status, 200);
    const uncertain = await AfterHoursActivity.findOne({ publicId: confirmed.data.replyId });
    assert.equal(await AfterHoursActivity.countDocuments({ uniqueKey: uncertain.uniqueKey }), 1);
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: uncertain._id }), 1);
    // A process can disappear with a claim held. A later retry can recover an
    // expired lease while keeping the original reply and recipient unchanged.
    const abandonedBody = replyBody('Recover the abandoned delivery lease.');
    const abandoned = await seed(two, { type: 'REPLY', targetUserId: one._id, parentActivityId: parent._id,
      text: abandonedBody.text, uniqueKey: `reply:live:${two._id}:${abandonedBody.clientId}`,
      replyNotificationLease: { token: randomUUID(), until: new Date(now - 1000) }, createdAt: new Date(now) });
    const leaseRecovery = await request(two, postPath(parent) + '/reply', abandonedBody);
    assert.equal(leaseRecovery.status, 200); assert.equal(leaseRecovery.data.replyId, abandoned.publicId);
    assert.equal(await Notification.countDocuments({ afterHoursReplyId: abandoned._id }), 1);
    const delivered = await AfterHoursActivity.findById(abandoned._id).select('+replyNotificationDelivered +replyNotificationLease');
    assert.equal(delivered.replyNotificationDelivered, true); assert.equal(delivered.replyNotificationLease, undefined);

    // Cached clients can still send a fresh legacy request without a key.
    assert.equal((await request(two, postPath(parent) + '/reply', { text: 'Legacy client can continue.' })).status, 200);
    assert.equal((await request(two, postPath(parent) + '/reply', { text: 'Legacy client follows up.' })).status, 200);
    assert.deepEqual(await walletState(), wallets, 'plain posting/replying never changes Aura or inventory');
    assert.equal(await AuraTransaction.countDocuments(), 0, 'there is no social-action reward faucet');

    const confession = await seed(one, { type: 'CONFESSION', anonymous: true, text: 'A harmless confession.' });
    assert.equal((await request(one, postPath(confession) + '/reply', replyBody('Would reveal the owner.'))).status, 400);
    const confessionReply = await request(three, postPath(confession) + '/reply', replyBody('Your secret is safe.'));
    assert.equal(confessionReply.status, 200);
    const anonymousPost = confessionReply.data.feed.find((item) => item.id === confession.publicId);
    assert.deepEqual(anonymousPost.actor, { displayName: 'Anonymous', username: null, avatar: null, anonymous: true });
    assert.equal(anonymousPost.canReply, true);
    const ownAnonymous = await request(one, '/after-hours?activity=' + confession.publicId);
    assert.equal(ownAnonymous.data.feed.find((item) => item.id === confession.publicId).canReply, false);
    const notifications = (await request(one, '/notifications')).data;
    assert.ok(notifications.some((item) => item.afterHoursActivityId === concurrentReply.publicId), 'new reply activity opens the exact reply');
    assert.ok(notifications.every((item) => !('afterHoursReplyId' in item)), 'private dedupe references never enter Activity payloads');

    // The existing one-Aura Sparks and votes/reactions still work on next-day content.
    const hotTake = await seed(one, { type: 'HOT_TAKE', text: 'An old take people can still judge.' });
    assert.equal((await request(three, postPath(hotTake) + '/vote', { vote: 'REAL' })).status, 200);
    assert.equal((await request(three, postPath(parent) + '/react', { reaction: '🤝' })).status, 200);
    assert.equal((await request(three, postPath(parent) + '/spark', {})).status, 200);
    assert.equal((await User.findById(three._id)).auraBalance, 99);
    assert.equal((await User.findById(one._id)).auraBalance, 101);
    assert.equal((await request(three, '/after-hours/feed/' + concurrentReply.publicId + '/spark', {})).status, 200);
    assert.equal((await User.findById(three._id)).auraBalance, 98);
    assert.equal((await User.findById(two._id)).auraBalance, 101);
    assert.equal((await request(three, '/after-hours/feed/' + concurrentReply.publicId + '/react', { reaction: '👀' })).status, 200);
    assert.equal((await request(three, postPath(confession) + '/spark', {})).status, 200);
    const anonymousLedger = await AuraTransaction.findOne({ userId: three._id, 'metadata.afterHoursActivityId': confession.publicId });
    assert.match(anonymousLedger.description, /anonymous/);
    assert.equal(anonymousLedger.description.includes(one.displayName), false);
    assert.equal(await AfterHoursSpark.countDocuments(), 3);
    assert.equal(await AuraTransaction.countDocuments(), 6, 'existing Spark transfer accounting remains exactly two entries per Spark');

    const expired = await seed(one, { type: 'HOT_TAKE', createdAt: new Date(now - 49 * HOUR) });
    const orphan = await seed(two, { type: 'REPLY', parentActivityId: expired._id, targetUserId: one._id, createdAt: new Date(now - HOUR) });
    assert.equal((await request(three, postPath(expired) + '/reply', replyBody('Too late.'))).status, 404);
    assert.equal((await request(three, postPath(expired) + '/replies')).status, 404);
    assert.equal((await request(three, postPath(expired) + '/vote', { vote: 'REAL' })).status, 404);
    for (const target of [expired, orphan]) {
      assert.equal((await request(three, postPath(target) + '/react', { reaction: '👀' })).status, 404);
      assert.equal((await request(three, postPath(target) + '/spark', {})).status, 404);
      assert.equal((await request(three, '/after-hours?activity=' + target.publicId)).data.focus.status, 'unavailable');
    }
    assert.ok(await AfterHoursActivity.exists({ _id: expired._id }), 'API expiry does not depend on TTL deletion');
    const challenge = await seed(one, { type: 'CHALLENGE', createdAt: new Date(now - 4 * HOUR) });
    assert.equal((await request(three, postPath(challenge) + '/join', { text: 'Challenge window stays short.' })).status, 404);
    assert.equal((await request(three, postPath(challenge) + '/react', { reaction: '👀' })).status, 404);

    // Test scopes remain separate even when users know a foreign public activity ID.
    const testPost = await seed(testOne);
    const scopedReply = await request(testTwo, postPath(testPost) + '/reply', replyBody('Same owner scope.'));
    assert.equal(scopedReply.status, 200);
    for (const actor of [one, foreignTest]) {
      assert.equal((await request(actor, postPath(testPost) + '/reply', replyBody('Foreign scope.'))).status, 404);
      assert.equal((await request(actor, postPath(testPost) + '/replies')).status, 404);
      assert.equal((await request(actor, postPath(testPost) + '/react', { reaction: '👀' })).status, 404);
      assert.equal((await request(actor, postPath(testPost) + '/spark', {})).status, 404);
      const focused = await request(actor, '/after-hours?activity=' + testPost.publicId);
      assert.equal(focused.data.focus.status, 'unavailable');
      assert.equal(focused.data.feed.some((item) => item.id === testPost.publicId), false);
    }
    assert.equal((await request(testOne, postPath(parent) + '/reply', replyBody('Cannot enter live scope.'))).status, 404);
    const testSnapshot = await request(testOne, '/after-hours');
    assert.ok(testSnapshot.data.feed.every((item) => item.actor.anonymous || item.actor.username?.startsWith('test_')));
    assertPublic(testSnapshot.data);

    // Tie timestamps deliberately: public-ID cursor ordering must neither repeat nor skip.
    const thread = await seed(one, { text: 'A longer conversation.' });
    const tiedAt = new Date(now - HOUR);
    const threadReplies = await AfterHoursActivity.create(Array.from({ length: 45 }, (_, index) => ({
      publicId: 'a'.repeat(22) + index.toString(16).padStart(2, '0'),
      scopeKey: 'live', roundKey: thread.roundKey, type: 'REPLY', actorId: index % 2 ? one._id : two._id,
      parentActivityId: thread._id, targetUserId: one._id, promptId: 'social-reply', promptText: thread.promptText,
      text: 'Thread reply ' + index, createdAt: tiedAt
    })));
    const preview = (await request(three, '/after-hours')).data.feed.find((item) => item.id === thread.publicId);
    assert.equal(preview.replyCount, 45); assert.equal(preview.replies.length, 20); assert.equal(preview.repliesHasMore, true);
    assert.deepEqual(preview.replies.map((item) => item.id), threadReplies.slice(25).map((item) => item.publicId));
    let cursor = null;
    const pages = [];
    do {
      const page = await request(three, postPath(thread) + '/replies' + (cursor ? '?before=' + encodeURIComponent(cursor) : ''));
      assert.equal(page.status, 200); assertPublic(page.data); assert.equal(page.data.replyCount, 45);
      assert.ok(page.data.replies.length <= 20);
      assert.deepEqual(page.data.replies.map((item) => item.id), [...page.data.replies.map((item) => item.id)].sort());
      pages.push(page.data.replies.map((item) => item.id));
      cursor = page.data.nextCursor;
      assert.equal(page.data.hasMore, Boolean(cursor));
    } while (cursor);
    assert.deepEqual(pages.map((page) => page.length), [20, 20, 5]);
    assert.equal(new Set(pages.flat()).size, 45);
    assert.deepEqual(pages.flat().sort(), threadReplies.map((item) => item.publicId).sort());
    const older = await request(three, postPath(thread) + '/replies?before=' + encodeURIComponent(preview.repliesNextCursor));
    assert.deepEqual(older.data.replies.map((item) => item.id), threadReplies.slice(5, 25).map((item) => item.publicId));
    assert.equal((await request(three, postPath(thread) + '/replies?before=not-a-cursor')).status, 400);
    assert.equal((await request(three, postPath(otherPost) + '/replies?before=' + encodeURIComponent(preview.repliesNextCursor))).status, 400, 'cursor cannot move to another parent');
    const cursorData = JSON.parse(Buffer.from(preview.repliesNextCursor, 'base64url').toString());
    assert.equal(JSON.stringify(cursorData).includes(String(thread._id)), false, 'cursor never exposes a raw Mongo ID');

    // An old crowded thread cannot hide another parent's replies.
    const quiet = await seed(one, { text: 'A quieter conversation.' });
    const quietReply = await seed(two, { type: 'REPLY', parentActivityId: quiet._id, targetUserId: one._id, text: 'Still included.', createdAt: tiedAt });
    const siblings = (await request(three, '/after-hours')).data;
    assert.equal(siblings.feed.find((item) => item.id === quiet.publicId).replies[0].id, quietReply.publicId);
    // Background answers are invisible and cannot consume the social feed budget.
    await AfterHoursActivity.create(Array.from({ length: 110 }, () => ({ scopeKey: 'live', roundKey: 'fixture-round', type: 'ANSWER', actorId: two._id, promptId: 'fixture', promptText: 'Background answer', choice: 'Side', createdAt: new Date(now) })));
    assert.ok((await request(three, '/after-hours')).data.feed.some((item) => item.id === thread.publicId));
    await AfterHoursActivity.create(Array.from({ length: 95 }, (_, index) => ({ scopeKey: 'live', roundKey: 'fixture-round', type: 'SHOUT', actorId: two._id, promptId: 'social-shout', promptText: 'Room shout', text: 'Recent post ' + index, createdAt: new Date(now - index * 1000) })));
    const normal = await request(three, '/after-hours');
    assert.equal(normal.data.feed.length, 90); assert.equal(normal.data.feed.some((item) => item.id === thread.publicId), false);
    const focused = await request(three, '/after-hours?activity=' + threadReplies[0].publicId);
    assert.equal(focused.data.focus.status, 'available'); assert.equal(focused.data.focus.postId, thread.publicId);
    assert.equal(focused.data.focus.replyId, threadReplies[0].publicId);
    const focusedPost = focused.data.feed.find((item) => item.id === thread.publicId);
    assert.equal(focusedPost.replies.length, 21); assert.equal(focusedPost.replyCount, 45);
    assert.ok(focusedPost.replies.some((item) => item.id === threadReplies[0].publicId));
    assert.equal(focusedPost.repliesNextCursor, preview.repliesNextCursor, 'old focus does not skip unshown intermediate replies');
    assert.ok(focused.data.feed.length <= 91); assertPublic(focused.data);
    for (const actor of [one, two, three]) assert.equal(JSON.stringify(focused.data).includes(String(actor._id)), false);
    assert.equal((await request(three, '/after-hours?activity=' + randomBytes(12).toString('hex'))).data.focus.status, 'unavailable');
    const focusedOwnerReply = await request(one, postPath(thread) + '/reply', replyBody('Following up on the older thread.'));
    assert.equal(focusedOwnerReply.status, 200);
    assert.ok(focusedOwnerReply.data.feed.find((item) => item.id === thread.publicId).replies.some((item) => item.id === focusedOwnerReply.data.replyId));
    // Empty scopes still return an explicit unavailable status and allow room-event focus.
    const emptyFocus = await request(foreignTest, '/after-hours?activity=' + randomBytes(12).toString('hex'));
    assert.deepEqual(emptyFocus.data.feed, []); assert.equal(emptyFocus.data.focus.status, 'unavailable');
    assert.equal((await request(foreignTest, '/after-hours?activity=room-event')).data.focus.status, 'available');
    assert.equal(await AfterHoursSpark.countDocuments(), 3);
    assert.equal(await AuraTransaction.countDocuments(), 6);
    console.log('After Hours social: next-day replies, owner/anonymous rules, idempotent races/notification recovery, scope/privacy, live-parent expiry, existing Sparks, bounded chronological pagination and exact focus passed.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
