const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Table = require('../models/GroupTable');
const DuelRoom = require('../models/DuelRoom');
const Friendship = require('../models/Friendship');
const Notification = require('../models/Notification');
const Transaction = require('../models/AuraTransaction');
const rules = require('../services/tableRules');
const rewards = require('../services/gameRewards');
const people = require('../services/people');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } }); let server;
  try {
    mongoose.set('autoIndex', false); await mongoose.connect(mongo.getUri());
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const users = await User.create(['One', 'Two', 'Three', 'Four', 'Five', 'Outside', 'Budget'].map((name, index) => ({ displayName: name, username: name.toLowerCase(), usernameNormalized: name.toLowerCase(), email: `${index}@example.test`, password: 'fixture-only', auraBalance: 200, inventory: ['ORBIT'] })));
    const [one, two, three, four, five, outside, budget] = users;
    const testUser = await User.create({ displayName: 'Test user', email: 'test@example.test', password: 'fixture-only', isTestAccount: true, testOwnerId: one._id });
    const app = express(); app.use(express.json()); app.use(require('../middleware/securityHeaders')); app.use(require('../middleware/requestGuard'));
    app.use('/api/duels', require('../routes/duels')); app.use('/api/people', require('../routes/people'));
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (user, path, body) => {
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
    };
    assert.equal((await request(null, '/duels/tables')).status, 401);
    assert.equal((await request(one, '/duels/tables', {})).status, 400);
    const creation = { clientId: randomUUID(), members: users.map(user => String(user._id)), winnerIds: [String(one._id)] };
    const created = await Promise.all(Array.from({ length: 8 }, () => request(one, '/duels/tables', creation)));
    assert.ok(created.every(value => value.status === 200), JSON.stringify(created));
    const code = created[0].data.id, path = `/duels/tables/${code}`;
    assert.ok(created.every(value => value.data.id === code)); assert.equal(await Table.countDocuments(), 1);
    assert.equal(created[0].data.players.length, 1); assert.equal(Table.schema.indexes().length, 0);
    assert.equal((await Table.findById(code).lean()).state, undefined);
    const invitation = await request(outside, path); assert.equal(invitation.status, 200); assert.deepEqual(Object.keys(invitation.data).sort(), ['canJoin', 'count', 'id', 'maxPlayers', 'status']);
    assert.match(invitation.cache, /no-store/); assert.equal((await request(testUser, path)).status, 404);
    assert.equal((await request(one, '/duels/tables/constructor')).status, 404);
    const join = { action: 'JOIN', clientId: randomUUID() };
    const joined = await Promise.all(Array.from({ length: 8 }, () => request(two, path + '/action', join)));
    assert.ok(joined.every(value => value.status === 200)); assert.equal((await Table.findById(code)).members.length, 2);
    assert.equal((await request(three, path + '/action', { action: 'JOIN', clientId: randomUUID() })).status, 200);
    const lastSeat = await Promise.all([four, five].map(user => request(user, path + '/action', { action: 'JOIN', clientId: randomUUID() })));
    assert.deepEqual(lastSeat.map(value => value.status).sort(), [200, 409]);
    const fourth = lastSeat[0].status === 200 ? four : five, notSeated = fourth === four ? five : four;
    const participants = [one, two, three, fourth], ids = participants.map(user => String(user._id));
    let view = (await request(one, path)).data;
    const action = async (user, kind, values = {}) => {
      const latest = (await request(user, path)).data;
      return request(user, path + '/action', { action: kind, clientId: randomUUID(), revision: latest.revision, matchId: latest.matchId, ...values });
    };
    assert.equal((await action(two, 'START')).status, 403);
    assert.equal((await action(one, 'START')).status, 409);
    for (const user of participants.slice(1)) assert.equal((await action(user, 'READY', { ready: true })).status, 200);
    view = (await request(one, path)).data;
    const start = { action: 'START', clientId: randomUUID(), revision: view.revision, hands: { [ids[0]]: ['OATH', 'OATH'] }, deck: Array(18).fill('OATH'), winnerIds: [ids[0]] };
    const starts = await Promise.all(Array.from({ length: 5 }, () => request(one, path + '/action', start)));
    assert.ok(starts.every(value => value.status === 200 && value.data.status === 'ACTIVE'));
    assert.ok(starts.every(value => value.data.matchId === starts[0].data.matchId));
    assert.equal((await request(notSeated, path)).status, 404); assert.equal((await request(testUser, path + '/action', { action: 'JOIN', clientId: randomUUID() })).status, 404);
    const active = await Table.findById(code).select('+state').lean();
    assert.deepEqual([...Object.values(active.state.current.hands).flat(), ...active.state.current.deck, ...active.state.current.aside].sort(), rules.deck().sort());
    const fixed = ['SIGNAL_FLARE', 'SIGNAL_FLARE', 'SIGNAL_FLARE', 'SIGNAL_FLARE', 'OATH', 'WATCHER', 'GHOST', 'GHOST', 'GHOST', 'ORBIT', 'ORBIT', 'PURIFY', 'PURIFY', 'PURIFY', 'WATCHER', 'WATCHER', 'SIGNAL_FLARE', 'SIGNAL_FLARE'];
    active.state.current = { ...active.state.current, ...rules.deal(ids, ids[0], fixed) };
    await Table.updateOne({ _id: code }, { $set: { state: active.state } });
    await User.updateOne({ _id: two._id }, { $set: { 'auraBank.outstanding': 9 } });
    assert.equal((await request(one, '/people/two/connect', { revision: 0, clientId: randomUUID() })).status, 403, 'a round must finish before connecting');
    const wrongTurn = await action(two, 'PLAY', { cardId: 'SIGNAL_FLARE', targetId: ids[0], guess: 'OATH' }); assert.equal(wrongTurn.status, 409);
    let privatePeek = false, conflictingChecked = false;
    while (true) {
      const room = await Table.findById(code).select('+state').lean(), game = room.state.current;
      if (game.status !== 'ACTIVE') break;
      const actor = participants.find(user => String(user._id) === game.currentPlayerId), actorId = String(actor._id);
      const actorView = (await request(actor, path)).data;
      for (const user of participants) {
        const payload = (await request(user, path)).data;
        for (const forbidden of ['state', 'deck', 'aside', 'hands', 'receipts', 'rewardQueue', 'noticeQueue']) assert.equal(forbidden in payload, false);
        assert.ok(payload.players.every(player => !('hand' in player)), 'no opponent hand is revealed during a round');
        if (game.peeks[actorId] && user !== actor) assert.equal(payload.peek?.targetId === game.peeks[actorId].targetId && payload.peek?.cardId === game.peeks[actorId].cardId && !game.peeks[String(user._id)], false);
      }
      const cardId = actorView.hand.find(card => card !== 'OATH') || 'OATH';
      const targetId = game.players.find(player => player !== actorId && !game.eliminated.includes(player));
      const guess = ['WATCHER', 'GHOST', 'PURIFY', 'ORBIT', 'OATH'].find(card => card !== game.hands[targetId][0]);
      const body = { action: 'PLAY', clientId: randomUUID(), revision: actorView.revision, matchId: actorView.matchId, cardId,
        ...(['SIGNAL_FLARE', 'WATCHER', 'PURIFY', 'ORBIT'].includes(cardId) ? { targetId } : {}), ...(cardId === 'SIGNAL_FLARE' ? { guess } : {}) };
      const responses = await Promise.all(Array.from({ length: 5 }, () => request(actor, path + '/action', body)));
      assert.ok(responses.every(value => value.status === 200), JSON.stringify(responses));
      assert.equal(responses[0].data.revision, actorView.revision + 1);
      if (cardId === 'WATCHER' && !responses[0].data.moves.at(-1).blocked) { assert.equal(responses[0].data.peek.targetId, targetId); privatePeek = true; }
      if (!conflictingChecked && responses[0].data.status === 'ACTIVE') {
        const next = responses[0].data.players.find(player => player.id === responses[0].data.currentPlayerId);
        const nextUser = participants.find(user => String(user._id) === next.id);
        assert.equal((await request(nextUser, path + '/action', { ...body, clientId: randomUUID() })).status, 409); conflictingChecked = true;
      }
    }
    assert.ok(privatePeek); view = (await request(one, path)).data; assert.equal(view.status, 'FINISHED');
    const game = (await Table.findById(code).select('+state').lean()).state.current;
    assert.ok(ids.every(player => game.moves.filter(move => move.actorId === player && move.cardId).length >= 2));
    await Promise.all(Array.from({ length: 12 }, (_, index) => request(participants[index % 4], path)));
    for (const user of participants) {
      const result = (await request(user, path)).data, stored = await User.findById(user._id).select('+auraBank +auraWalletReceipts');
      const expected = result.winner === 'YOU' ? 10 : 5, repaid = user === two ? Math.ceil(expected / 2) : 0;
      assert.equal(result.rewards.round.amount, expected); assert.equal(result.rewards.round.repaid, repaid);
      assert.equal(stored.auraBalance, 200 + expected - repaid); assert.equal(result.rewards.rounds, 1);
      assert.equal(stored.auraWalletReceipts.filter(receipt => receipt.type === 'GAME_REWARD').length, 1);
      assert.equal(await Transaction.countDocuments({ userId: user._id, type: 'GAME_REWARD' }), 1);
      assert.deepEqual(stored.inventory, ['ORBIT']); assert.ok(result.players.every(player => Array.isArray(player.hand)));
    }
    assert.equal(await Friendship.countDocuments(), 0, 'gameplay never silently creates a Duo');
    const connected = await request(one, '/people/two/connect', { revision: 0, clientId: randomUUID() }); assert.equal(connected.status, 200, JSON.stringify(connected));
    assert.equal(connected.data.connection.status, 'PENDING', 'chat still needs mutual consent');
    assert.equal((await request(one, `/people/connections/${connected.data.connection.id}/messages`)).status, 403);
    // The daily cap commits with the actual wallet update even across many rooms.
    const day = new Date().toISOString().slice(0, 10), queue = Array.from({ length: 15 }, (_, index) => ({ userId: String(budget._id), matchId: String(index).padStart(24, '0'), day, amount: 10, createdAt: new Date().toISOString() }));
    const journal = await DuelRoom.create({ state: { current: null }, rewardQueue: queue });
    await Promise.all(Array.from({ length: 5 }, () => rewards.flushRewards(DuelRoom, journal.toObject())));
    assert.equal((await User.findById(budget._id)).auraBalance, 230); assert.equal((await rewards.rewardView(String(budget._id))).rounds, 3);
    assert.equal(await Transaction.countDocuments({ userId: budget._id, type: 'GAME_REWARD' }), 3);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await DuelRoom.updateOne({ _id: journal._id }, { $push: { rewardQueue: { ...queue[0], matchId: '9'.repeat(24), day: yesterday } } });
    await rewards.reconcileGameRewards(); assert.equal((await User.findById(budget._id)).auraBalance, 240); assert.equal((await rewards.rewardView(String(budget._id))).rounds, 3, 'yesterday cannot reset today');
    // Ledger outage leaves one durable wallet receipt and repairs through the bank.
    const originalJournal = Transaction.updateOne;
    await DuelRoom.updateOne({ _id: journal._id }, { $push: { rewardQueue: { ...queue[0], userId: String(outside._id), matchId: 'a'.repeat(24) } } });
    Transaction.updateOne = () => { throw new Error('fixture ledger outage'); };
    try { await rewards.reconcileGameRewards(); } finally { Transaction.updateOne = originalJournal; }
    assert.equal((await User.findById(outside._id)).auraBalance, 210);
    await require('../services/auraBank').reconcileAuraWallet(outside._id);
    assert.equal(await Transaction.countDocuments({ userId: outside._id, type: 'GAME_REWARD' }), 1);
    // Explicit readiness is required again; only a host may reopen a round.
    assert.equal((await action(two, 'REMATCH')).status, 403); assert.equal((await action(one, 'REMATCH')).status, 200);
    view = (await request(one, path)).data; assert.equal(view.status, 'WAITING'); assert.equal(view.players.filter(player => player.ready).length, 1);
    assert.equal((await request(one, '/people/three/connect', { revision: 0, clientId: randomUUID() })).status, 200, 'opening a rematch does not erase a real completed encounter');
    const leaveView = (await request(fourth, path)).data, leave = { action: 'LEAVE', clientId: randomUUID(), revision: leaveView.revision, matchId: null };
    assert.equal((await request(fourth, path + '/action', leave)).data.status, 'LEFT'); assert.equal((await request(fourth, path + '/action', leave)).data.status, 'LEFT');
    assert.equal((await action(one, 'LEAVE')).data.status, 'LEFT'); view = (await request(two, path)).data; assert.equal(view.host, true);
    // A block closes waiting tables and prevents future joins in either direction.
    const info = await people.getPerson(String(one._id), 'two');
    await people.blockPerson(String(one._id), 'two', { clientId: randomUUID(), revision: info.connection.revision });
    const second = (await request(one, '/duels/tables', { clientId: randomUUID() })).data;
    assert.equal((await request(two, `/duels/tables/${second.id}/action`, { action: 'JOIN', clientId: randomUUID() })).status, 404);
    // A move held after its authorization read loses to a completed block.
    const raceCode = second.id, racePath = `/duels/tables/${raceCode}`;
    assert.equal((await request(three, racePath + '/action', { action: 'JOIN', clientId: randomUUID() })).status, 200);
    let raceView = (await request(three, racePath)).data;
    assert.equal((await request(three, racePath + '/action', { action: 'READY', ready: true, revision: raceView.revision, clientId: randomUUID() })).status, 200);
    raceView = (await request(one, racePath)).data;
    assert.equal((await request(one, racePath + '/action', { action: 'START', revision: raceView.revision, clientId: randomUUID() })).status, 200);
    const raceRoom = await Table.findById(raceCode).select('+state').lean();
    raceRoom.state.current = { ...raceRoom.state.current, ...rules.deal([String(one._id), String(three._id)], String(one._id)) };
    await Table.updateOne({ _id: raceCode }, { $set: { state: raceRoom.state } });
    raceView = (await request(one, racePath)).data;
    const cardId = raceView.hand.find(card => card !== 'OATH') || 'OATH';
    let release, entered;
    const held = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
    const originalUpdate = Table.updateOne;
    Table.updateOne = async function(query, update, ...rest) {
      if (query._id === raceCode && update.$set?.state?.current?.moves.length === 1) { entered(); await held; }
      return originalUpdate.call(this, query, update, ...rest);
    };
    try {
      const moving = request(one, racePath + '/action', { action: 'PLAY', revision: raceView.revision, matchId: raceView.matchId, clientId: randomUUID(), cardId,
        ...(['SIGNAL_FLARE', 'WATCHER', 'PURIFY', 'ORBIT'].includes(cardId) ? { targetId: String(three._id) } : {}), ...(cardId === 'SIGNAL_FLARE' ? { guess: 'OATH' } : {}) });
      await reached;
      const threeInfo = await people.getPerson(String(one._id), 'three');
      await people.blockPerson(String(one._id), 'three', { clientId: randomUUID(), revision: threeInfo.connection.revision });
      release(); assert.equal((await moving).status, 404);
    } finally { release(); Table.updateOne = originalUpdate; }
    assert.equal((await Table.findById(raceCode)).status, 'CANCELLED');
    assert.equal((await request(three, racePath)).status, 404);
    // No background recovery needs index creation to deliver an earned reward.
    assert.equal((await mongoose.connection.collection(Table.collection.name).indexes()).length, 1);
    console.log('Group tables: four-player games, private hands/peeks, readiness/host/seat races, durable retries, capped atomic rewards, bank repayment, midnight and ledger recovery, mutual connections, scope/block guards and primary-index-only MongoDB passed.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
