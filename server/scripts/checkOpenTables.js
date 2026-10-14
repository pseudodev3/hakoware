const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Queue = require('../models/OpenTableQueue');
const Room = require('../models/DuelRoom');
const Connection = require('../models/SocialConnection');
const Friendship = require('../models/Friendship');
const Notification = require('../models/Notification');
const people = require('../services/people');

async function main() {
  mongoose.set('autoIndex', false);
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } }); let server;
  try {
    await mongoose.connect(mongo.getUri());
    const makeUser = (name, extra = {}) => User.create({ displayName: name, username: name, usernameNormalized: name, email: `${name}@example.test`, password: 'fixture-only', auraBalance: 123, inventory: ['ORBIT'], ...extra });
    const players = await Promise.all(Array.from({ length: 8 }, (_, i) => makeUser(`player${i}`)));
    const owner = new mongoose.Types.ObjectId();
    const lab = await makeUser('labone', { isTestAccount: true, testOwnerId: owner });
    const labTwo = await makeUser('labtwo', { isTestAccount: true, testOwnerId: owner });
    const otherLab = await makeUser('otherlab', { isTestAccount: true, testOwnerId: new mongoose.Types.ObjectId() });
    const before = await User.find().select('_id auraBalance inventory').sort({ _id: 1 }).lean();
    const app = express(); app.use(express.json()); app.use(require('../middleware/securityHeaders')); app.use(require('../middleware/requestGuard'));
    app.use('/api/duels', require('../routes/duels')); app.use('/api/people', require('../routes/people'));
    server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (user, path, body) => {
      const token = user ? jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) : null;
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const enter = (user, clientId = randomUUID()) => request(user, '/duels/open-table/enter', { clientId });
    const status = user => request(user, '/duels/open-table');
    const leave = (user, ticketId) => request(user, '/duels/open-table/leave', { ticketId });
    const reset = () => Promise.all([Queue, Room, Connection, Notification].map(model => model.deleteMany({})));
    assert.equal((await status(null)).status, 401);
    assert.deepEqual((await status(players[0])).data, { status: 'IDLE' });
    assert.equal(await Queue.countDocuments(), 0, 'opening Arena never opts anyone in');
    assert.equal((await enter(players[0], 'bad')).status, 400);
    assert.equal((await enter(players[0], ['a'.repeat(20)])).status, 400);
    const ticket = randomUUID();
    const duplicates = await Promise.all(Array.from({ length: 5 }, () => enter(players[0], ticket)));
    assert.ok(duplicates.every(result => result.status === 200 && result.data.ticketId === ticket));
    assert.equal((await Queue.findById('players').select('+seats').lean()).seats.length, 1);
    const joined = await enter(players[1]); assert.equal(joined.data.status, 'MATCHED');
    const key = joined.data.duelId;
    assert.equal((await status(players[0])).data.duelId, key);
    assert.equal((await leave(players[0], ticket)).data.status, 'MATCHED', 'cancellation cannot undo a committed pairing');
    const view = (await request(players[0], '/duels/' + key)).data;
    assert.equal(view.status, 'ACTIVE'); assert.equal(view.casual, true); assert.equal(view.contractKey, null);
    assert.equal((await request(players[2], '/duels/' + key)).status, 404);
    for (const secret of ['email', 'password', 'auraBalance', 'bio', 'interests', 'players', 'seats', 'match', 'deck', 'aside', 'peeks']) assert.ok(!Object.hasOwn(view.partner, secret));
    assert.equal((await request(players[1], '/people/connections/' + key + '/messages')).status, 403);
    assert.equal(await Notification.countDocuments({ duelId: key }), 2);
    assert.equal((await enter(players[0])).data.duelId, key, 'one open-table round per person');
    assert.equal(await Room.countDocuments(), 1); assert.equal(await Friendship.countDocuments(), 0);
    assert.equal((await Queue.findById('players').lean()).seats, undefined);
    const agedQueue = await Queue.findById('players').select('+seats').lean();
    for (const seat of agedQueue.seats) { seat.expiresAt = new Date(Date.now() - 1000).toISOString(); seat.match.createdAt = new Date(Date.now() - 8 * 86400000).toISOString(); }
    await Queue.updateOne({ _id: 'players' }, { $set: { seats: agedQueue.seats } });
    assert.equal((await enter(players[0])).data.duelId, key, 'an asynchronous active game remains the single open table after the original journal lease');
    for (const seat of agedQueue.seats) seat.expiresAt = new Date(Date.now() + 86400000).toISOString();
    await Queue.updateOne({ _id: 'players' }, { $set: { seats: agedQueue.seats } });
    const movedOn = await Room.findById(key).select('+state').lean();
    const newerRound = String(new mongoose.Types.ObjectId());
    movedOn.state.current.id = newerRound; movedOn.state.current.status = 'FINISHED'; movedOn.state.current.createdAt = new Date(Date.now() + 1000).toISOString();
    await Room.updateOne({ _id: key }, { $set: { state: movedOn.state } });
    assert.equal((await status(players[0])).data.status, 'IDLE');
    assert.equal((await Room.findById(key).select('+state').lean()).state.current.id, newerRound, 'a stale pairing journal never reopens an earlier round');
    await reset();

    const waiting = await enter(players[2]);
    let queue = await Queue.findById('players').select('+seats').lean();
    queue.seats[0].expiresAt = new Date(Date.now() - 1000).toISOString();
    await Queue.updateOne({ _id: 'players' }, { $set: { seats: queue.seats } });
    assert.equal((await status(players[2])).data.status, 'IDLE', 'inactive seats expire');
    const next = await enter(players[2]);
    await leave(players[2], waiting.data.ticketId);
    assert.equal((await status(players[2])).data.ticketId, next.data.ticketId, 'a stale tab cannot cancel a newer seat');
    const heartbeat = await request(players[2], '/duels/open-table?ticket=' + next.data.ticketId);
    assert.equal(heartbeat.data.status, 'WAITING');
    queue = await Queue.findById('players').select('+seats').lean();
    assert.ok(new Date(queue.seats[0].expiresAt) <= new Date(queue.seats[0].deadline));
    await leave(players[2], next.data.ticketId); assert.equal((await status(players[2])).data.status, 'IDLE');
    await reset();

    await enter(lab); await enter(otherLab); await enter(players[0]);
    assert.equal((await status(lab)).data.status, 'WAITING');
    assert.equal((await status(otherLab)).data.status, 'WAITING');
    assert.equal((await enter(labTwo)).data.status, 'MATCHED');
    assert.equal((await status(players[0])).data.status, 'WAITING', 'live accounts and founder fixtures never match');
    await reset();
    const blockedKey = people.pairId(players[0], players[1]);
    await Connection.create({ _id: blockedKey, participants: [players[0]._id, players[1]._id], blockedBy: [String(players[1]._id)] });
    await enter(players[0]); assert.equal((await enter(players[1])).data.status, 'WAITING');
    const third = await enter(players[2]); assert.equal(third.data.status, 'MATCHED');
    assert.equal((await status(players[1])).data.status, 'WAITING', 'blocks in either direction exclude pairing');
    await reset();

    // Cancel wins a race against a join whose queue snapshot is already loaded.
    const host = await enter(players[3]);
    const write = Queue.updateOne; let reached, release;
    const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { reached = resolve; });
    let held = false;
    Queue.updateOne = async function (...args) { if (!held && args[1].$set?.seats?.some(seat => seat.phase === 'PAIRED')) { held = true; reached(); await gate; } return write.apply(this, args); };
    const guest = enter(players[4]); await ready;
    assert.equal((await leave(players[3], host.data.ticketId)).data.status, 'IDLE');
    release(); assert.equal((await guest).data.status, 'WAITING'); Queue.updateOne = write;
    assert.equal(await Room.countDocuments(), 0, 'cancellation prevents a stale pairing');
    await reset();

    // Lost initialization is recoverable from the committed pairing journal.
    await enter(players[5]);
    const roomWrite = Room.updateOne; let failOnce = true;
    Room.updateOne = function (...args) { if (failOnce && args[1].$setOnInsert?.revision === 0) { failOnce = false; throw new Error('simulated room initialization outage'); } return roomWrite.apply(this, args); };
    const retry = randomUUID(); assert.equal((await enter(players[6], retry)).status, 500); Room.updateOne = roomWrite;
    const recovered = await enter(players[6], retry); assert.equal(recovered.data.status, 'MATCHED');
    assert.equal((await enter(players[6], retry)).data.duelId, recovered.data.duelId); assert.equal(await Room.countDocuments(), 1);
    await reset();

    // Block wins against a dealt round held just before its state commit.
    await enter(players[6]);
    let blockReached, releaseRound;
    const roundGate = new Promise(resolve => { releaseRound = resolve; }), roundReady = new Promise(resolve => { blockReached = resolve; });
    let heldRound = false;
    Room.updateOne = async function (...args) { if (!heldRound && args[1].$set?.state?.current?.openTable) { heldRound = true; blockReached(); await roundGate; } return roomWrite.apply(this, args); };
    const pendingMatch = enter(players[7]); await roundReady;
    const pair = people.pairId(players[6], players[7]);
    assert.equal((await request(players[6], '/people/connections/' + pair + '/action', { action: 'BLOCK', revision: 0, clientId: randomUUID() })).status, 200);
    releaseRound(); assert.equal((await pendingMatch).data.status, 'IDLE'); Room.updateOne = roomWrite;
    assert.equal((await Room.findById(pair).select('+state').lean()).state.current, null);
    assert.equal(await Notification.countDocuments({ duelId: pair }), 0);
    await reset();

    const race = await Promise.all(players.slice(0, 6).map(player => enter(player)));
    assert.ok(race.every(result => result.status === 200));
    queue = await Queue.findById('players').select('+seats').lean();
    assert.equal(new Set(queue.seats.map(seat => seat.userId)).size, 6, 'concurrent joins never duplicate a player');
    const paired = queue.seats.filter(seat => seat.phase === 'PAIRED');
    assert.equal(paired.length, 6); assert.equal(new Set(paired.map(seat => seat.match.id)).size, 3);
    for (const player of players.slice(0, 6)) assert.equal((await status(player)).data.status, 'MATCHED');
    assert.equal(await Room.countDocuments(), 3);
    assert.deepEqual(await User.find().select('_id auraBalance inventory').sort({ _id: 1 }).lean(), before);
    assert.equal(await Friendship.countDocuments(), 0);
    assert.equal((await mongoose.connection.db.collection('opentablequeues').indexes()).length, 1);
    await reset();
    await Queue.create({ _id: 'players', seats: Array.from({ length: 400 }, () => ({ userId: String(new mongoose.Types.ObjectId()), ticketId: randomUUID(), phase: 'WAITING', expiresAt: new Date(Date.now() + 90000).toISOString() })) });
    assert.equal((await enter(players[0])).status, 503, 'the queue has an explicit storage bound');
    assert.equal((await Queue.findById('players').select('+seats').lean()).seats.length, 400);
    console.log('PASS: voluntary play, scoped atomic pairing, privacy, cancellation/expiry, stable retries, initialization recovery, block races, unchanged Aura/inventory/Duos and primary-index-only storage.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
