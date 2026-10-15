const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const DuelRoom = require('../models/DuelRoom');
const Notification = require('../models/Notification');
const { deal, deck } = require('../services/duelRules');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri()); await Promise.all([User, Friendship, DuelRoom, Notification].map(model => model.init()));
    assert.equal(DuelRoom.schema.indexes().length, 0, 'no secondary index is needed for round correctness');
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const [one, two, outside, testUser] = await User.create(['One', 'Two', 'Outside', 'Test'].map(name => ({ displayName: name, email: `${name}@example.test`, password: 'fixture-only', auraBalance: 250, inventory: ['ORBIT', 'PURIFY'], ...(name === 'Test' ? { isTestAccount: true, testOwnerId: new mongoose.Types.ObjectId() } : {}) })));
    const friendship = await Friendship.create({ user1: one._id, user2: two._id, status: 'ACTIVE', templateId: 'DONT_GHOST', duoXP: 120 });
    const boundary = await Friendship.create({ user1: one._id, user2: testUser._id, status: 'ACTIVE', templateId: 'DONT_GHOST' });
    const app = express(); app.use(express.json()); app.use(require('../middleware/securityHeaders')); app.use(require('../middleware/requestGuard'));
    app.use('/api/duels', require('../routes/duels')); app.use('/api/notifications', require('../routes/notifications'));
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (user, path, body) => {
      const token = user ? jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) : null;
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
    };
    const roomPath = `/duels/${friendship._id}`;
    const before = await User.find({ _id: { $in: [one._id, two._id] } }).select('auraBalance inventory').sort({ _id: 1 }).lean();
    const contractBefore = await Friendship.findById(friendship._id).lean();
    assert.equal((await request(null, '/duels')).status, 401);
    assert.equal((await request(outside, roomPath)).status, 404);
    assert.equal((await request(one, '/duels/not-an-id')).status, 404);
    assert.equal((await request(one, `/duels/${boundary._id}`)).status, 404);
    assert.equal((await request(one, '/duels')).data.partners.length, 1);
    const invitation = { clientId: randomUUID(), revision: 0, previousMatchId: null };
    const inviteResults = await Promise.all(Array.from({ length: 8 }, () => request(one, roomPath + '/invite', invitation)));
    assert.ok(inviteResults.every(result => result.status === 200 && result.data.status === 'INVITED'));
    assert.ok(inviteResults.every(result => result.data.matchId === inviteResults[0].data.matchId));
    assert.equal(await DuelRoom.countDocuments(), 1); assert.equal(await Notification.countDocuments({ type: 'DUEL_INVITE' }), 1);
    let view = (await request(two, roomPath)).data;
    assert.deepEqual(view.hand, []); assert.equal(view.remaining, 0);
    assert.equal((await DuelRoom.findById(friendship._id).lean()).state, undefined, 'ordinary model reads exclude private state');
    assert.equal((await request(outside, roomPath + '/respond', { action: 'ACCEPT', clientId: randomUUID(), revision: view.revision, matchId: view.matchId })).status, 404);
    assert.equal((await request(one, roomPath + '/respond', { action: 'ACCEPT', clientId: randomUUID(), revision: view.revision, matchId: view.matchId })).status, 403);
    assert.equal((await request(two, roomPath + '/respond', { action: 'CANCEL', clientId: randomUUID(), revision: view.revision, matchId: view.matchId })).status, 403);
    assert.equal((await request(one, roomPath + '/invite', { clientId: randomUUID(), revision: view.revision, previousMatchId: view.matchId })).status, 409);
    const accept = { action: 'ACCEPT', clientId: randomUUID(), revision: view.revision, matchId: view.matchId, deck: Array(12).fill('OATH'), hands: { [String(two._id)]: ['OATH', 'OATH'] }, winnerId: String(two._id) };
    const accepted = await Promise.all(Array.from({ length: 8 }, () => request(two, roomPath + '/respond', accept)));
    assert.ok(accepted.every(result => result.status === 200));
    assert.ok(accepted.every(result => JSON.stringify(result.data.hand) === JSON.stringify(accepted[0].data.hand)));
    assert.equal(accepted[0].data.revision, 2); assert.equal(accepted[0].data.myTurn, true);
    const activeRoom = await DuelRoom.findById(friendship._id).select('+state').lean();
    assert.equal(activeRoom.state.current.deck.length, 7);
    assert.deepEqual([...activeRoom.state.current.deck, ...activeRoom.state.current.aside, ...Object.values(activeRoom.state.current.hands).flat()].sort(), deck().sort(), 'client-supplied hands, winners and deck do not control a game');
    assert.equal((await request(one, roomPath + '/respond', { ...accept, action: 'INVITE' })).status, 400);
    assert.equal((await request(two, roomPath + '/respond', { ...accept, action: 'DECLINE' })).status, 409, 'a reused key cannot change its action');
    // A known deck makes private peek/result assertions reproducible.
    const fixed = ['WATCHER', 'OATH', 'SIGNAL_FLARE', 'WATCHER', 'GHOST', 'GHOST', 'SIGNAL_FLARE', 'ORBIT', 'PURIFY', 'SIGNAL_FLARE', 'PURIFY', 'SIGNAL_FLARE'];
    activeRoom.state.current = { ...activeRoom.state.current, ...deal([String(one._id), String(two._id)], String(one._id), fixed) };
    await DuelRoom.updateOne({ _id: friendship._id }, { $set: { state: activeRoom.state } });
    let oneView = await request(one, roomPath); assert.match(oneView.cache, /no-store/);
    const snapshot = { revision: oneView.data.revision, matchId: oneView.data.matchId };
    assert.equal((await request(two, roomPath + '/play', { ...snapshot, clientId: randomUUID(), cardId: 'OATH' })).status, 409);
    const move = { ...snapshot, clientId: randomUUID(), cardId: 'WATCHER' };
    const moveResults = await Promise.all(Array.from({ length: 8 }, () => request(one, roomPath + '/play', move)));
    assert.ok(moveResults.every(result => result.status === 200));
    assert.equal(moveResults[0].data.revision, 3); assert.equal(moveResults[0].data.moves.length, 1);
    assert.equal(moveResults[0].data.peek.cardId, 'OATH');
    const otherView = (await request(two, roomPath)).data; assert.equal(otherView.peek, null);
    for (const payload of [otherView, moveResults[0].data, (await request(one, '/duels')).data.rooms[0]]) {
      for (const key of ['deck', 'aside', 'hands', 'players', 'state', 'receipts', 'noticeQueue', 'inviterId', 'starterId']) assert.equal(key in payload, false, `private ${key} escaped`);
    }
    assert.equal('cardId' in otherView.moves[0] && otherView.moves[0].cardId === 'WATCHER', true);
    assert.equal((await request(one, roomPath + '/seen', snapshot)).status, 200);
    assert.equal((await Notification.findOne({ toUserId: two._id, type: 'DUEL_TURN', duelRevision: 3 })).read, false, 'an older view cannot clear the next turn');
    assert.equal((await request(two, roomPath + '/seen', { matchId: view.matchId, revision: 999 })).status, 400);
    const conflicting = await Promise.all(Array.from({ length: 2 }, () => request(two, roomPath + '/play', { cardId: 'GHOST', clientId: randomUUID(), revision: otherView.revision, matchId: otherView.matchId })));
    assert.deepEqual(conflicting.map(result => result.status).sort(), [200, 409], 'different keys cannot both commit the same turn');
    let current = conflicting.find(result => result.status === 200).data;
    assert.equal(current.revision, 4); assert.equal(current.moves.length, 2);
    await request(one, roomPath + '/seen', snapshot);
    assert.equal((await Notification.findOne({ toUserId: one._id, type: 'DUEL_TURN', duelRevision: 4 })).read, false, 'the same player’s stale view cannot clear their newer turn');
    for (const [actor, input] of [[one, { cardId: 'SIGNAL_FLARE', guess: 'OATH' }], [two, { cardId: 'ORBIT' }], [one, { cardId: 'PURIFY', target: 'OPPONENT' }], [two, { cardId: 'PURIFY', target: 'OPPONENT' }]]) {
      const result = await request(actor, roomPath + '/play', { ...input, clientId: randomUUID(), matchId: current.matchId, revision: current.revision });
      assert.equal(result.status, 200, JSON.stringify(result.data)); current = result.data;
    }
    assert.equal(current.status, 'FINISHED'); assert.equal(current.result.winner, 'YOU'); assert.deepEqual(current.result.partner, []); assert.equal(current.score.you, 1);
    const finalRevision = current.revision;
    assert.equal((await request(two, roomPath + '/play', { cardId: 'OATH', clientId: randomUUID(), matchId: current.matchId, revision: finalRevision })).status, 409);
    const rematch = { clientId: randomUUID(), revision: finalRevision, previousMatchId: current.matchId };
    const rematchResult = await request(two, roomPath + '/invite', rematch); assert.equal(rematchResult.status, 200);
    const secondAccept = await request(one, roomPath + '/respond', { action: 'ACCEPT', clientId: randomUUID(), revision: rematchResult.data.revision, matchId: rematchResult.data.matchId });
    assert.equal(secondAccept.status, 200); assert.equal(secondAccept.data.myTurn, true, 'starters alternate from the first accepted round');
    // The fixture starter above intentionally differed from the first invite's starter.
    assert.equal((await DuelRoom.findById(friendship._id).select('+state').lean()).state.current.starterId, String(one._id));
    const left = await request(two, roomPath + '/respond', { action: 'ABANDON', clientId: randomUUID(), revision: secondAccept.data.revision, matchId: secondAccept.data.matchId });
    assert.equal(left.status, 200); assert.equal(left.data.status, 'ABANDONED'); assert.equal(left.data.score.you, 1); assert.equal(left.data.result, null);
    const third = await request(one, roomPath + '/invite', { clientId: randomUUID(), revision: left.data.revision, previousMatchId: left.data.matchId });
    assert.equal(third.status, 200);
    const room = await DuelRoom.findById(friendship._id).select('+state').lean(); room.state.current.expiresAt = new Date(Date.now() - 1).toISOString();
    await DuelRoom.updateOne({ _id: room._id }, { $set: { state: room.state } });
    const expired = (await request(two, roomPath)).data; assert.equal(expired.status, 'EXPIRED'); assert.equal(expired.score.you, 1);
    const originalNotice = Notification.updateOne;
    Notification.updateOne = () => { throw new Error('fixture notification outage'); };
    let recovery;
    try { recovery = await request(two, roomPath + '/invite', { clientId: randomUUID(), revision: expired.revision, previousMatchId: expired.matchId }); }
    finally { Notification.updateOne = originalNotice; }
    assert.equal(recovery.status, 200); assert.equal(recovery.data.status, 'INVITED');
    await request(one, roomPath); await request(one, roomPath);
    assert.equal(await Notification.countDocuments({ duelMatchId: recovery.data.matchId, type: 'DUEL_INVITE' }), 1);
    const declines = { action: 'DECLINE', clientId: randomUUID(), revision: recovery.data.revision, matchId: recovery.data.matchId };
    const declined = await request(one, roomPath + '/respond', declines);
    assert.equal(declined.data.status, 'DECLINED');
    const cancellable = await request(two, roomPath + '/invite', { clientId: randomUUID(), revision: declined.data.revision, previousMatchId: declined.data.matchId });
    assert.equal(cancellable.status, 200);
    const cancelled = await request(two, roomPath + '/respond', { action: 'CANCEL', clientId: randomUUID(), revision: cancellable.data.revision, matchId: cancellable.data.matchId });
    assert.equal(cancelled.status, 200); assert.equal(cancelled.data.status, 'CANCELLED'); assert.deepEqual(cancelled.data.hand, []);
    const contest = await request(two, roomPath + '/invite', { clientId: randomUUID(), revision: cancelled.data.revision, previousMatchId: cancelled.data.matchId });
    const common = { revision: contest.data.revision, matchId: contest.data.matchId };
    const decisions = await Promise.all([
      request(one, roomPath + '/respond', { ...common, clientId: randomUUID(), action: 'ACCEPT' }),
      request(two, roomPath + '/respond', { ...common, clientId: randomUUID(), action: 'CANCEL' }),
    ]);
    assert.deepEqual(decisions.map(result => result.status).sort(), [200, 409], 'accept and cancel have one durable winner');
    await Notification.deleteMany({ duelId: String(friendship._id) });
    await request(one, roomPath); assert.equal(await Notification.countDocuments({ duelId: String(friendship._id) }), 0, 'delivered/dismissed activity stays dismissed');
    const wallets = await User.find({ _id: { $in: [one._id, two._id] } }).select('auraBalance inventory').sort({ _id: 1 }).lean();
    for (const wallet of wallets) {
      const original = before.find(value => String(value._id) === String(wallet._id));
      assert.deepEqual(wallet.inventory, original.inventory);
      assert.equal(wallet.auraBalance - original.auraBalance, String(wallet._id) === String(two._id) ? 10 : 5, 'one capped completion reward and winner bonus; no entry cost');
    }
    assert.deepEqual(await Friendship.findById(friendship._id).lean(), contractBefore, 'duels do not touch contract progression or debt');
    assert.deepEqual((await request(outside, '/duels')).data.rooms, []);
    await Friendship.updateOne({ _id: friendship._id }, { $set: { status: 'BLOCKED' } });
    assert.equal((await request(one, roomPath)).status, 404); assert.equal((await request(two, '/duels')).data.rooms.length, 0);
    const notifications = (await request(one, '/notifications')).data;
    assert.ok(notifications.every(item => !('state' in item) && !('hands' in item)));
    console.log('Standalone duels: private hands/peeks, real six-turn game, exact completion/win rewards, invitations/rematches, concurrent retries, role/scope guards, expiry/abandonment, activity recovery/exact acknowledgement and unchanged inventory/contracts passed.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
