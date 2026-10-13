const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User'), Friendship = require('../models/Friendship'), CardTrade = require('../models/CardTrade');
const Notification = require('../models/Notification'), ContractEvent = require('../models/ContractEvent');
const { createOffer, respondToOffer, reconcileTrade, settleExpiredTrades } = require('../services/cardTradeEscrow');
const { collectionSnapshot } = require('../services/cardTrading');
const { takeCard } = require('../services/cardInventory');
const { currentUserView } = require('../services/clientViews');
const { CARD_CATALOG } = require('../services/cardCatalog');
const inventory = async user => (await User.findById(user._id)).inventory;
const pair = async (oneCards = ['PURIFY'], twoCards = ['ORBIT']) => {
  const suffix = randomBytes(4).toString('hex');
  const people = await User.create(['Ari', 'Maya'].map((name, index) => ({ displayName: name, username: name.toLowerCase() + '_' + suffix, email: name + suffix + '@example.test', password: 'local-only', inventory: index ? twoCards : oneCards, auraBalance: 40, notificationPreferences: { email: false } })));
  const contract = await Friendship.create({ user1: people[0]._id, user2: people[1]._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE', season: { number: 1, status: 'ACTIVE', startedAt: new Date(Date.now() - 86400000) }, user1Perspective: { lastInteraction: new Date() }, user2Perspective: { lastInteraction: new Date() } });
  return { one: people[0], two: people[1], contract, body: { friendshipId: String(contract._id), offeredCardId: 'PURIFY', requestedCardId: 'ORBIT', clientId: randomUUID() } };
};
const total = async people => {
  const users = await User.find({ _id: { $in: people.map(user => user._id) } }).select('+cardTradeReceipts').lean();
  const counts = {};
  for (const user of users) for (const card of [...user.inventory, ...user.cardTradeReceipts.filter(receipt => receipt.state === 'HELD').map(receipt => receipt.cardId)]) counts[card] = (counts[card] || 0) + 1;
  return counts;
};
async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } }); let server;
  try {
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await Promise.all([User, Friendship, CardTrade, Notification, ContractEvent].map(model => model.createCollection()));
    await mongoose.connection.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    await assert.rejects(CardTrade.collection.createIndex({ senderId: 1, clientId: 1 }, { unique: true }), /available disk space.*less than required minimum/);
    assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, undefined, 'this is standalone MongoDB');
    const first = await pair();
    const offers = await Promise.all(Array.from({ length: 6 }, () => createOffer(first.one._id, first.body)));
    assert.ok(offers.every(trade => String(trade._id) === String(offers[0]._id))); assert.deepEqual(await inventory(first.one), []);
    await assert.rejects(createOffer(first.one._id, { ...first.body, requestedCardId: 'ECHO' }), /another offer/);
    const accepts = await Promise.all(Array.from({ length: 6 }, () => respondToOffer(first.two._id, offers[0]._id, 'ACCEPT')));
    assert.ok(accepts.every(trade => trade.status === 'ACCEPTED')); assert.deepEqual(await inventory(first.one), ['ORBIT']); assert.deepEqual(await inventory(first.two), ['PURIFY']);
    assert.equal(await ContractEvent.countDocuments({ friendshipId: first.contract._id, type: 'CARD_TRADE_ACCEPTED' }), 1);
    assert.equal(await Notification.countDocuments({ cardTradeId: offers[0]._id, title: 'Card trade accepted' }), 1);
    assert.equal((await User.findById(first.one._id)).auraBalance, 40);

    for (let round = 0; round < 8; round++) {
      const fixture = await pair(), before = await total([fixture.one, fixture.two]);
      const trade = await createOffer(fixture.one._id, fixture.body);
      await Promise.allSettled([respondToOffer(fixture.two._id, trade._id, 'ACCEPT'), respondToOffer(fixture.one._id, trade._id, 'CANCEL'), respondToOffer(fixture.two._id, trade._id, 'DECLINE')]);
      await Promise.all(Array.from({ length: 3 }, () => reconcileTrade(trade._id)));
      assert.ok(['ACCEPTED', 'CANCELLED', 'DECLINED'].includes((await CardTrade.findById(trade._id)).status));
      assert.deepEqual(await total([fixture.one, fixture.two]), before, 'competing answers preserve both card copies');
    }
    const missing = await pair(['PURIFY'], []), missingTrade = await createOffer(missing.one._id, missing.body);
    await assert.rejects(respondToOffer(missing.two._id, missingTrade._id, 'ACCEPT'), /no longer have/);
    assert.equal((await CardTrade.findById(missingTrade._id)).status, 'PENDING');
    await User.updateOne({ _id: missing.two._id }, { $push: { inventory: 'ORBIT' } });
    assert.equal((await respondToOffer(missing.two._id, missingTrade._id, 'ACCEPT')).status, 'ACCEPTED');

    const preparing = await pair(), originalTradeUpdate = CardTrade.updateOne;
    CardTrade.updateOne = function(filter, update, ...rest) { if (update.$set?.phase === 'OPEN') return Promise.reject(new Error('Interrupted offer publication')); return originalTradeUpdate.call(this, filter, update, ...rest); };
    await assert.rejects(createOffer(preparing.one._id, preparing.body), /Interrupted/); CardTrade.updateOne = originalTradeUpdate;
    await settleExpiredTrades(preparing.one._id);
    const recovered = await createOffer(preparing.one._id, preparing.body); assert.equal(recovered.status, 'PENDING'); assert.deepEqual(await inventory(preparing.one), []);

    CardTrade.updateOne = function(filter, update, ...rest) { if (update.$set?.phase === 'ACCEPTING') return Promise.reject(new Error('Interrupted acceptance decision')); return originalTradeUpdate.call(this, filter, update, ...rest); };
    await assert.rejects(respondToOffer(preparing.two._id, recovered._id, 'ACCEPT'), /Interrupted/); CardTrade.updateOne = originalTradeUpdate;
    await settleExpiredTrades(preparing.two._id); assert.equal((await CardTrade.findById(recovered._id)).status, 'ACCEPTED');
    assert.deepEqual(await inventory(preparing.one), ['ORBIT']); assert.deepEqual(await inventory(preparing.two), ['PURIFY']);

    const interrupted = await pair(), interruptedTrade = await createOffer(interrupted.one._id, interrupted.body), originalUserUpdate = User.updateOne;
    User.updateOne = function(filter, update, ...rest) { if (String(filter._id) === String(interrupted.two._id) && filter.cardTradeReceipts?.$elemMatch) return Promise.reject(new Error('Interrupted second delivery')); return originalUserUpdate.call(this, filter, update, ...rest); };
    await assert.rejects(respondToOffer(interrupted.two._id, interruptedTrade._id, 'ACCEPT'), /Interrupted/); User.updateOne = originalUserUpdate;
    assert.deepEqual(await inventory(interrupted.one), ['ORBIT']); assert.deepEqual(await inventory(interrupted.two), []);
    await Promise.all(Array.from({ length: 4 }, () => reconcileTrade(interruptedTrade._id)));
    assert.deepEqual(await inventory(interrupted.one), ['ORBIT']); assert.deepEqual(await inventory(interrupted.two), ['PURIFY']);

    const refund = await pair(), refundTrade = await createOffer(refund.one._id, refund.body);
    User.updateOne = function(filter, ...rest) { if (String(filter._id) === String(refund.two._id)) return Promise.reject(new Error('Interrupted refund tombstone')); return originalUserUpdate.call(this, filter, ...rest); };
    await assert.rejects(respondToOffer(refund.one._id, refundTrade._id, 'CANCEL'), /Interrupted/); User.updateOne = originalUserUpdate;
    await Promise.all([reconcileTrade(refundTrade._id), reconcileTrade(refundTrade._id)]);
    assert.deepEqual(await inventory(refund.one), ['PURIFY']); assert.deepEqual(await inventory(refund.two), ['ORBIT']);

    const late = await pair(), lateTrade = await createOffer(late.one._id, late.body), originalFind = User.findOneAndUpdate;
    let startLate, releaseLate;
    const entered = new Promise(resolve => { startLate = resolve; }), gate = new Promise(resolve => { releaseLate = resolve; });
    User.findOneAndUpdate = function(filter, update, options) {
      if (String(filter._id) === String(late.two._id) && filter.inventory === 'ORBIT') return { select: selection => (async () => { startLate(); await gate; return originalFind.call(User, filter, update, options).select(selection); })() };
      return originalFind.call(this, filter, update, options);
    };
    const delayed = respondToOffer(late.two._id, lateTrade._id, 'ACCEPT');
    await entered; await respondToOffer(late.one._id, lateTrade._id, 'CANCEL'); releaseLate();
    await assert.rejects(delayed, /cancelled/); User.findOneAndUpdate = originalFind;
    assert.deepEqual(await inventory(late.one), ['PURIFY']); assert.deepEqual(await inventory(late.two), ['ORBIT'], 'completed cancellation tombstones prevent a late recipient reservation');

    const delivery = await pair(), originalNotificationUpdate = Notification.updateOne, originalEventUpdate = ContractEvent.updateOne;
    Notification.updateOne = () => Promise.reject(new Error('Injected notice outage'));
    const deliveredTrade = await createOffer(delivery.one._id, delivery.body);
    ContractEvent.updateOne = () => Promise.reject(new Error('Injected history outage'));
    assert.equal((await respondToOffer(delivery.two._id, deliveredTrade._id, 'ACCEPT')).status, 'ACCEPTED');
    Notification.updateOne = originalNotificationUpdate; ContractEvent.updateOne = originalEventUpdate;
    await Promise.all([reconcileTrade(deliveredTrade._id), reconcileTrade(deliveredTrade._id)]);
    assert.equal(await ContractEvent.countDocuments({ friendshipId: delivery.contract._id, type: 'CARD_TRADE_ACCEPTED' }), 1);
    assert.equal(await Notification.countDocuments({ cardTradeId: deliveredTrade._id, title: 'Card trade accepted' }), 1);

    const counter = await pair(['PURIFY'], ['ORBIT', 'ECHO']), counterTotal = await total([counter.one, counter.two]);
    const parent = await createOffer(counter.one._id, counter.body);
    const counterOffers = await Promise.allSettled(['ORBIT', 'ECHO'].map(card => createOffer(counter.two._id, { friendshipId: String(counter.contract._id), offeredCardId: card, requestedCardId: 'PURIFY', clientId: randomUUID(), counterOf: String(parent._id) })));
    assert.equal(counterOffers.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await CardTrade.findById(parent._id)).status, 'COUNTERED');
    assert.deepEqual(await total([counter.one, counter.two]), counterTotal);
    const replacement = counterOffers.find(result => result.status === 'fulfilled').value;
    await respondToOffer(counter.two._id, replacement._id, 'CANCEL'); assert.deepEqual(await total([counter.one, counter.two]), counterTotal);

    const legacy = await pair(); await takeCard(legacy.one._id, 'PURIFY');
    const old = await CardTrade.create({ senderId: legacy.one._id, recipientId: legacy.two._id, friendshipId: legacy.contract._id, offeredCardId: 'PURIFY', requestedCardId: 'ORBIT', clientId: randomUUID(), expiresAt: new Date(Date.now() + 86400000) });
    await respondToOffer(legacy.two._id, old._id, 'ACCEPT'); assert.deepEqual(await inventory(legacy.one), ['ORBIT']); assert.deepEqual(await inventory(legacy.two), ['PURIFY']);
    const stale = await pair(), staleTrade = await createOffer(stale.one._id, stale.body);
    await CardTrade.updateOne({ _id: staleTrade._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    await Promise.all([settleExpiredTrades(stale.one._id), settleExpiredTrades(stale.one._id)]); assert.equal((await CardTrade.findById(staleTrade._id)).status, 'EXPIRED'); assert.deepEqual(await inventory(stale.one), ['PURIFY']);
    const ended = await pair(), endedTrade = await createOffer(ended.one._id, ended.body);
    await Friendship.updateOne({ _id: ended.contract._id }, { $set: { status: 'BLOCKED' } }); await settleExpiredTrades(ended.one._id);
    assert.equal((await CardTrade.findById(endedTrade._id)).status, 'CANCELLED'); assert.deepEqual(await inventory(ended.one), ['PURIFY']);

    const blockedJob = await pair(), nextJob = await pair();
    await takeCard(blockedJob.one._id, 'PURIFY'); await takeCard(nextJob.one._id, 'PURIFY');
    const stalled = await CardTrade.create({ _id: new mongoose.Types.ObjectId('000000000000000000000001'), senderId: blockedJob.one._id, recipientId: blockedJob.two._id, friendshipId: blockedJob.contract._id, offeredCardId: 'PURIFY', requestedCardId: 'ORBIT', clientId: randomUUID(), expiresAt: new Date(Date.now() - 1) });
    const following = await CardTrade.create({ _id: new mongoose.Types.ObjectId('000000000000000000000002'), senderId: nextJob.one._id, recipientId: nextJob.two._id, friendshipId: nextJob.contract._id, offeredCardId: 'PURIFY', requestedCardId: 'ORBIT', clientId: randomUUID(), expiresAt: new Date(Date.now() - 1) });
    User.updateOne = function(filter, ...rest) { if (String(filter._id) === String(blockedJob.one._id)) return Promise.reject(new Error('Injected isolated worker failure')); return originalUserUpdate.call(this, filter, ...rest); };
    await settleExpiredTrades(); User.updateOne = originalUserUpdate;
    assert.equal((await CardTrade.findById(following._id)).status, 'EXPIRED', 'one failed recovery cannot block other players');
    assert.deepEqual(await inventory(nextJob.one), ['PURIFY']); await reconcileTrade(stalled._id); assert.deepEqual(await inventory(blockedJob.one), ['PURIFY']);

    const cap = await pair(Array(12).fill('PURIFY'), []);
    const caps = await Promise.allSettled(Object.keys(CARD_CATALOG).filter(card => card !== 'PURIFY').map(card => createOffer(cap.one._id, { ...cap.body, requestedCardId: card, clientId: randomUUID() })));
    assert.equal(caps.filter(result => result.status === 'fulfilled').length, 10); assert.equal((await inventory(cap.one)).length, 2);
    for (const result of caps.filter(result => result.status === 'fulfilled')) await respondToOffer(cap.one._id, result.value._id, 'CANCEL');
    assert.equal((await inventory(cap.one)).length, 12);
    const duplicatePair = await pair(['PURIFY', 'PURIFY'], []);
    const duplicates = await Promise.allSettled(Array.from({ length: 4 }, () => createOffer(duplicatePair.one._id, { ...duplicatePair.body, clientId: randomUUID() })));
    assert.equal(duplicates.filter(result => result.status === 'fulfilled').length, 1, 'one open identical offer without secondary unique indexes');

    process.env.JWT_SECRET = randomBytes(32).toString('hex'); const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard')); app.use('/api/cards', require('../routes/cards'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); const base = `http://127.0.0.1:${server.address().port}/api/cards`;
    const request = async (user, path, body) => { const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; };
    assert.equal((await request(null, '')).status, 401);
    assert.equal((await request(first.one, `/trades/${replacement._id}/respond`, { action: 'ACCEPT' })).status, 404);
    await Friendship.updateOne({ _id: cap.contract._id }, { $set: { status: 'PENDING' } }); assert.equal((await request(cap.one, '/trades', { ...cap.body, clientId: randomUUID() })).status, 404);
    const privateUser = await User.findById(first.one._id).select('+cardTradeReceipts').lean(); assert.equal('cardTradeReceipts' in currentUserView(privateUser), false);
    const snapshot = await collectionSnapshot(first.one._id); const payload = JSON.stringify(snapshot); assert.equal(payload.includes('cardTradeReceipts'), false); assert.equal(payload.includes('settlementActorId'), false); assert.equal(payload.includes(String(first.two._id)), false);
    for (const model of [CardTrade, Notification, ContractEvent]) assert.deepEqual((await model.collection.indexes()).map(index => index.name), ['_id_']);
    console.log('Standalone/trial card exchange: primary-key retries, concurrent accept/cancel/decline, reservation and delivery recovery, refunds/tombstones, activity outages, counter races, legacy escrow, expiry, ended Duos, ten-offer cap, duplicate pairs, authentication and private payloads passed with disk guard blocked throughout.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
