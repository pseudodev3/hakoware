const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Connection = require('../models/SocialConnection');
const Message = require('../models/SocialMessage');
const Report = require('../models/CommunityReport');
const Friendship = require('../models/Friendship');
const DuelRoom = require('../models/DuelRoom');
const Notification = require('../models/Notification');
const { pairId } = require('../services/people');
const { deal } = require('../services/duelRules');

async function main() {
  // Readiness must not depend on new secondary index builds on trial storage.
  mongoose.set('autoIndex', false);
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    const owner = new mongoose.Types.ObjectId();
    const makeUser = (name, extra = {}) => User.create({ displayName: name, username: name.toLowerCase(), usernameNormalized: name.toLowerCase(), email: `${name}@example.test`, password: 'fixture', auraBalance: 200, inventory: ['ORBIT'], ...extra });
    const [one, two, outside, hidden, test, test2, otherTest] = await Promise.all([
      makeUser('Alpha'), makeUser('Bravo'), makeUser('Outside'), makeUser('Hidden'),
      makeUser('Testone', { isTestAccount: true, testOwnerId: owner }), makeUser('Testtwo', { isTestAccount: true, testOwnerId: owner }), makeUser('Testother', { isTestAccount: true, testOwnerId: new mongoose.Types.ObjectId() }),
    ]);
    process.env.FOUNDER_EMAILS = one.email;
    const app = express(); app.use(express.json()); app.use(require('../middleware/securityHeaders')); app.use(require('../middleware/requestGuard'));
    app.use('/api/people', require('../routes/people')); app.use('/api/duels', require('../routes/duels')); app.use('/api/notifications', require('../routes/notifications'));
    server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (user, path, body, method = body ? 'POST' : 'GET') => {
      const token = user ? jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) : null;
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
    };
    assert.equal((await request(null, '/people/discover')).status, 401);
    const retired = await request(one, '/people/discover');
    assert.equal(retired.status, 410); assert.match(retired.cache, /no-store/);
    assert.equal((await request(one, '/people/profile')).status, 410);
    assert.equal((await request(one, '/people/profile', { enabled: true }, 'PUT')).status, 410);
    for (const target of ['testone', 'hidden', 'bravo']) assert.equal((await request(one, '/people/' + target)).status, 404, 'no profile directory remains');
    assert.equal((await request(test, '/people/testother')).status, 404);
    const balances = await User.find({ _id: { $in: [one._id, two._id] } }).select('auraBalance inventory').lean();
    assert.equal((await request(one, '/people/bravo/duel', {})).status, 404, 'unknown people cannot receive unsolicited duel invites');
    assert.equal((await request(one, '/duels/open-table/enter', { clientId: randomUUID() })).data.status, 'WAITING');
    const joined = await request(two, '/duels/open-table/enter', { clientId: randomUUID() }); assert.equal(joined.data.status, 'MATCHED');
    const key = joined.data.duelId; assert.equal(key, pairId(one, two)); assert.equal(await Friendship.countDocuments(), 0);
    const duelPath = `/duels/${key}`;
    const publicJson = JSON.stringify((await request(one, '/people/bravo')).data.person);
    for (const secret of ['bio', 'interests', 'intent', 'email', 'password', 'auraBalance', '_id', 'testOwnerId', 'receipts', 'blockedBy']) assert.ok(!publicJson.includes(`"${secret}"`));
    assert.equal((await request(one, duelPath)).data.casual, true);
    assert.equal((await request(outside, duelPath)).status, 404);
    assert.equal((await request(one, `/people/connections/${key}/messages`)).status, 403);
    const sent = await request(one, duelPath); assert.equal(sent.data.status, 'ACTIVE'); assert.equal(sent.data.contractKey, null);
    assert.equal((await request(one, '/people/bravo/connect', { revision: 0, clientId: randomUUID() })).status, 403, 'finish playing before inviting a connection');
    assert.equal((await request(two, `/people/connections/${key}/messages`)).status, 403, 'taking a seat does not accept chat');
    const room = await DuelRoom.findById(key).select('+state').lean();
    room.state.current = { ...room.state.current, ...deal([String(one._id), String(two._id)], String(one._id), ['OATH', 'WATCHER', 'SIGNAL_FLARE', 'WATCHER', 'GHOST', 'GHOST', 'SIGNAL_FLARE', 'ORBIT', 'PURIFY', 'SIGNAL_FLARE', 'PURIFY', 'SIGNAL_FLARE']) };
    await DuelRoom.updateOne({ _id: key }, { $set: { state: room.state } });
    const finished = await request(one, duelPath + '/play', { revision: sent.data.revision, matchId: sent.data.matchId, cardId: 'OATH', clientId: randomUUID() }); assert.equal(finished.data.status, 'FINISHED');
    const connect = { revision: 0, clientId: randomUUID() };
    const concurrent = await Promise.all([request(one, '/people/bravo/connect', connect), request(one, '/people/bravo/connect', connect)]);
    assert.ok(concurrent.every(value => value.status === 200));
    assert.equal(await Notification.countDocuments({ type: 'CONNECTION_INVITE' }), 1);
    assert.equal((await request(one, `/people/connections/${key}/action`, { action: 'ACCEPT', revision: 1, clientId: randomUUID() })).status, 409);
    assert.equal((await request(outside, `/people/connections/${key}/action`, { action: 'ACCEPT', revision: 1, clientId: randomUUID() })).status, 404);
    assert.equal((await request(two, `/people/connections/${key}/action`, { action: 'ACCEPT', revision: 1, clientId: randomUUID() })).data.connection.status, 'CONNECTED');
    assert.equal((await request(one, `/people/connections/${key}/action`, { action: 'REQUEST', revision: 2, clientId: randomUUID() })).status, 400, 'request limits cannot be bypassed via the generic action route');
    assert.equal((await request(one, `/people/connections/${key}/action`, { action: 'MESSAGE', text: 'x'.repeat(1001), revision: 2, clientId: randomUUID() })).status, 400);
    const message = { action: 'MESSAGE', text: '<script>text stays text</script>', revision: 2, clientId: randomUUID() };
    const delivery = Message.updateOne; let failOnce = true;
    Message.updateOne = function (...args) { if (failOnce) { failOnce = false; throw new Error('simulated delivery outage'); } return delivery.apply(this, args); };
    assert.equal((await request(one, `/people/connections/${key}/action`, message)).status, 500);
    Message.updateOne = delivery;
    assert.equal((await request(one, `/people/connections/${key}/action`, message)).status, 200);
    assert.equal((await request(one, `/people/connections/${key}/action`, { ...message, text: 'changed' })).status, 409);
    assert.equal(await Message.countDocuments({ connectionId: key }), 1);
    let chat = await request(two, `/people/connections/${key}/messages`); assert.equal(chat.data.messages[0].fromMe, false); assert.equal(chat.data.messages[0].text, message.text);
    assert.equal((await request(outside, `/people/connections/${key}/messages`)).status, 404);
    // Pagination retains all messages without a bounded embedded history.
    await Message.insertMany(Array.from({ length: 35 }, (_, index) => ({ connectionId: key, senderId: String(one._id), sequence: index + 2, text: `Earlier ${index}`, createdAt: new Date() })));
    await Connection.updateOne({ _id: key }, { $set: { sequence: 36 } });
    chat = await request(one, `/people/connections/${key}/messages`); assert.equal(chat.data.messages.length, 30); assert.ok(chat.data.next);
    const earlier = await request(one, `/people/connections/${key}/messages?before=${chat.data.next}`); assert.equal(earlier.data.messages.length, 6);
    assert.ok(!JSON.stringify(chat.data).includes('senderId'));
    assert.equal((await request(two, '/people/alpha/report', { reason: 'HARASSMENT', note: 'A fixture report.' })).status, 200);
    assert.equal((await request(two, '/people/reports')).status, 403); assert.equal((await request(one, '/people/reports')).data.length, 1);
    const report = await Report.findOne(); assert.equal((await request(one, `/people/reports/${report._id}/review`, {})).status, 200);
    assert.equal((await request(one, '/people/reports')).data.length, 0);
    const block = { action: 'BLOCK', revision: 3, clientId: randomUUID() };
    assert.equal((await request(one, `/people/connections/${key}/action`, block)).status, 200);
    assert.equal((await request(one, `/people/connections/${key}/action`, block)).status, 200, 'a lost block response can be replayed after contact closes');
    assert.equal((await request(two, `/people/connections/${key}/messages`)).status, 404);
    assert.equal((await request(two, duelPath)).status, 404);
    assert.equal((await request(two, '/people/alpha/duel', {})).status, 404);
    assert.equal((await request(one, '/people/blocked')).data.connections.length, 1);
    assert.equal((await request(one, `/people/connections/${key}/action`, { action: 'UNBLOCK', revision: 4, clientId: randomUUID() })).data.connection.status, 'NONE');
    assert.equal((await request(two, `/people/connections/${key}/messages`)).status, 403, 'unblocking never restores chat consent');
    const latest = (await request(one, duelPath)).data;
    assert.equal((await request(one, duelPath + '/invite', { revision: latest.revision, previousMatchId: latest.matchId, clientId: randomUUID() })).status, 200, 'previously played opponents can rematch without Discover');
    // A block competes with a first room write and prevents a round opening afterward.
    const raceKey = pairId(outside, one);
    await Connection.create({ _id: raceKey, participants: [outside._id, one._id], status: 'CONNECTED' });
    const roomWrite = DuelRoom.updateOne; let releaseInvite, inviteReached;
    const inviteGate = new Promise(resolve => { releaseInvite = resolve; });
    const reachedInvite = new Promise(resolve => { inviteReached = resolve; });
    DuelRoom.updateOne = async function (...args) { if (String(args[0]._id) === raceKey && args[1].$setOnInsert?.revision === 0) { inviteReached(); await inviteGate; } return roomWrite.apply(this, args); };
    const heldInvite = request(outside, `/duels/${raceKey}/invite`, { revision: 0, previousMatchId: null, clientId: randomUUID() });
    await reachedInvite;
    assert.equal((await request(one, `/people/connections/${raceKey}/action`, { action: 'BLOCK', revision: 0, clientId: randomUUID() })).status, 200);
    releaseInvite(); assert.equal((await heldInvite).status, 409); DuelRoom.updateOne = roomWrite;
    assert.equal((await DuelRoom.findById(raceKey).select('+state').lean()).state.current, null);
    // The same consent revision serializes chat against a concurrent block.
    const chatKey = pairId(test, test2);
    await Connection.create({ _id: chatKey, participants: [test._id, test2._id], status: 'CONNECTED' });
    const connectionWrite = Connection.updateOne; let releaseMessage, messageReached;
    const messageGate = new Promise(resolve => { releaseMessage = resolve; });
    const reachedMessage = new Promise(resolve => { messageReached = resolve; });
    Connection.updateOne = async function (...args) { if (String(args[0]._id) === chatKey && args[1].$push?.outbox?.$each?.[0]?.kind === 'message') { messageReached(); await messageGate; } return connectionWrite.apply(this, args); };
    const heldMessage = request(test, `/people/connections/${chatKey}/action`, { action: 'MESSAGE', revision: 0, text: 'Must not arrive after block', clientId: randomUUID() });
    await reachedMessage;
    assert.equal((await request(test2, `/people/connections/${chatKey}/action`, { action: 'BLOCK', revision: 0, clientId: randomUUID() })).status, 200);
    releaseMessage(); assert.equal((await heldMessage).status, 409); Connection.updateOne = connectionWrite;
    assert.equal(await Message.countDocuments({ connectionId: chatKey }), 0);
    assert.equal((await request(test, `/people/connections/${chatKey}/messages`)).status, 404);
    assert.equal(await Friendship.countDocuments(), 0); assert.deepEqual(await User.find({ _id: { $in: [one._id, two._id] } }).select('auraBalance inventory').lean(), balances);
    assert.equal((await mongoose.connection.db.collection('socialconnections').indexes()).length, 1, 'only the primary key exists in this no-index-build test');
    console.log('PASS: retired profile browsing, scope/privacy, play-first connections, consent, casual duels, unchanged economy, durable chat retries, moderation and block/unblock on standalone Mongo with secondary indexes disabled.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
