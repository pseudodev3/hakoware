const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const CardPurchase = require('../models/CardPurchase');
const AuraTransaction = require('../models/AuraTransaction');
const { CARD_CATALOG } = require('../services/cardCatalog');
const { reconcileCardPurchases } = require('../services/cardPurchases');
const { currentUserView } = require('../services/clientViews');

const run = async () => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, CardPurchase, AuraTransaction].map((model) => model.init()));
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const user = await User.create({ displayName: 'Purchase tester', email: 'purchase@example.test', password: 'fixture-only', auraBalance: 100 });
    const app = express();
    app.use(express.json());
    app.use('/api/aura', require('../routes/aura'));
    app.use('/api/cards', require('../routes/cards'));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    const token = jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET);
    const buy = async (body, authenticated = true) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/aura/buy-card`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { 'x-auth-token': token } : {}) }, body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    };
    const key = randomUUID();
    assert.equal((await buy({ cardId: 'SIGNAL_FLARE', clientId: key }, false)).status, 401);
    const results = await Promise.all(Array.from({ length: 6 }, () => buy({ cardId: 'SIGNAL_FLARE', clientId: key })));
    assert.ok(results.every((result) => result.status === 200), JSON.stringify(results));
    const after = await User.findById(user._id);
    assert.equal(after.auraBalance, 55);
    assert.deepEqual(after.inventory, ['SIGNAL_FLARE']);
    assert.equal(await CardPurchase.countDocuments({ userId: user._id }), 1);
    assert.equal(await AuraTransaction.countDocuments({ userId: user._id, type: 'MARKETPLACE_PURCHASE' }), 1);
    assert.equal((await buy({ cardId: 'PURIFY', clientId: randomUUID() })).status, 400);
    assert.equal((await buy({ cardId: 'ORBIT', clientId: key })).status, 409, 'a key cannot silently buy a different card, even after retirement');
    assert.equal((await buy({ cardId: 'UNKNOWN', clientId: randomUUID() })).status, 400);
    assert.equal((await buy({ cardId: 'SIGNAL_FLARE', clientId: 'bad' })).status, 400);
    assert.equal((await User.findById(user._id)).auraBalance, 55);

    // Fail between committed delivery and its journal. Returning success describes
    // the actual outcome; retry and the worker repair it without a second debit.
    const originalUpdate = AuraTransaction.updateOne;
    AuraTransaction.updateOne = async () => { throw new Error('fixture ledger outage'); };
    const interrupted = { cardId: 'SIGNAL_FLARE', clientId: randomUUID() };
    try {
      assert.equal((await buy(interrupted)).status, 200);
      const pending = await User.findById(user._id).select('+cardPurchaseReceipts');
      assert.equal(pending.auraBalance, 10);
      assert.equal(pending.inventory.filter((id) => id === 'SIGNAL_FLARE').length, 2);
      assert.equal(pending.cardPurchaseReceipts.find((r) => r.clientId === interrupted.clientId).journaled, false);
    } finally { AuraTransaction.updateOne = originalUpdate; }
    await Promise.all([reconcileCardPurchases(), reconcileCardPurchases()]);
    const recovered = await User.findById(user._id).select('+cardPurchaseReceipts');
    assert.equal(recovered.cardPurchaseReceipts.find((r) => r.clientId === interrupted.clientId).journaled, true);
    assert.equal((await buy(interrupted)).status, 200);
    assert.equal((await User.findById(user._id)).auraBalance, 10);
    assert.equal(await AuraTransaction.countDocuments({ userId: user._id, type: 'MARKETPLACE_PURCHASE' }), 2);
    assert.equal('cardPurchaseReceipts' in currentUserView(recovered), false, 'private receipts never enter account payloads');
    assert.equal((await User.findById(user._id)).cardPurchaseReceipts, undefined, 'receipts are excluded by default');

    // A retired card delivered before deployment still has a durable private receipt.
    // A lost response and an unfinished journal must not turn retirement into a charge
    // reversal, failure response, extra debit, or another delivered copy.
    const retiredKey = randomUUID();
    await User.updateOne({ _id: user._id }, {
      $push: { inventory: 'GHOST', cardPurchaseReceipts: { clientId: retiredKey, cardId: 'GHOST', cost: 20, createdAt: new Date(), journaled: false } },
      $addToSet: { cardDiscoveries: 'GHOST' },
    });
    AuraTransaction.updateOne = async () => { throw new Error('fixture retired ledger outage'); };
    try {
      assert.equal((await buy({ cardId: 'GHOST', clientId: retiredKey })).status, 200);
      const pending = await User.findById(user._id).select('+cardPurchaseReceipts');
      assert.equal(pending.auraBalance, 10);
      assert.equal(pending.inventory.filter((id) => id === 'GHOST').length, 1);
      assert.equal(pending.cardPurchaseReceipts.find((r) => r.clientId === retiredKey).journaled, false);
    } finally { AuraTransaction.updateOne = originalUpdate; }
    await Promise.all([reconcileCardPurchases(), buy({ cardId: 'GHOST', clientId: retiredKey })]);
    const repaired = await User.findById(user._id).select('+cardPurchaseReceipts');
    assert.equal(repaired.cardPurchaseReceipts.find((r) => r.clientId === retiredKey).journaled, true);
    assert.equal(await AuraTransaction.countDocuments({ idempotencyKey: `card-purchase:${user._id}:${retiredKey}` }), 1);
    assert.equal(await CardPurchase.countDocuments({ userId: user._id, clientId: retiredKey }), 1);
    assert.equal((await buy({ cardId: 'ORBIT', clientId: retiredKey })).status, 409);
    assert.equal((await User.findById(user._id)).auraBalance, 10);

    // A legacy transaction receipt for a now-retired card is also authoritative.
    const legacyKey = randomUUID();
    await CardPurchase.create({ userId: user._id, clientId: legacyKey, cardId: 'ORBIT', cost: 20 });
    await User.updateOne({ _id: user._id }, { $push: { inventory: 'ORBIT' }, $addToSet: { cardDiscoveries: 'ORBIT' } });
    assert.equal((await buy({ cardId: 'ORBIT', clientId: legacyKey })).status, 200);
    assert.equal((await User.findById(user._id)).auraBalance, 10);
    assert.equal((await User.findById(user._id)).inventory.filter((id) => id === 'ORBIT').length, 1);
    assert.equal(await AuraTransaction.countDocuments({ userId: user._id, type: 'MARKETPLACE_PURCHASE' }), 3);
    assert.equal((await buy({ cardId: 'GHOST', clientId: legacyKey })).status, 409);

    // New purchases of every retired collectible fail without touching the account,
    // even if the caller omits a retry key or submits requests concurrently.
    const retired = Object.values(CARD_CATALOG).filter((card) => !card.purchasable);
    assert.equal(retired.length, 8);
    const beforeRetired = await User.findById(user._id).select('+cardPurchaseReceipts').lean();
    const purchasesBeforeRetired = await CardPurchase.countDocuments({ userId: user._id });
    const ledgerBeforeRetired = await AuraTransaction.countDocuments({ userId: user._id });
    const denied = await Promise.all(retired.flatMap((card) => [buy({ cardId: card.id, clientId: randomUUID() }), buy({ cardId: card.id })]));
    assert.ok(denied.every((result) => result.status === 410 && /no longer sold/.test(result.data.msg)), JSON.stringify(denied));
    assert.deepEqual(await User.findById(user._id).select('+cardPurchaseReceipts').lean(), beforeRetired);
    assert.equal(await CardPurchase.countDocuments({ userId: user._id }), purchasesBeforeRetired);
    assert.equal(await AuraTransaction.countDocuments({ userId: user._id }), ledgerBeforeRetired);
    assert.equal((await buy({ cardId: 'GHOST', clientId: randomUUID() }, false)).status, 401);

    // Distinct requests must not overspend the last 45 Aura.
    await User.updateOne({ _id: user._id }, { $set: { auraBalance: 45 } });
    const lastCopies = await Promise.all([buy({ cardId: 'SIGNAL_FLARE', clientId: randomUUID() }), buy({ cardId: 'SIGNAL_FLARE', clientId: randomUUID() })]);
    assert.deepEqual(lastCopies.map((result) => result.status).sort(), [200, 400]);
    assert.equal((await User.findById(user._id)).auraBalance, 0);
    assert.equal((await buy({ cardId: 'SIGNAL_FLARE', clientId: key })).status, 200, 'retry works with no remaining Aura');
    assert.equal((await buy({ cardId: 'GHOST', clientId: retiredKey })).status, 200, 'retired retry works with no remaining Aura');
    assert.equal((await User.findById(user._id)).auraBalance, 0);
    // Replaying a purchase after its card was used or traded must not grant another copy.
    await User.updateOne({ _id: user._id }, { $set: { inventory: [] } });
    await buy({ cardId: 'SIGNAL_FLARE', clientId: key });
    await buy({ cardId: 'GHOST', clientId: retiredKey });
    await buy({ cardId: 'ORBIT', clientId: legacyKey });
    assert.deepEqual((await User.findById(user._id)).inventory, []);

    // All active catalog tools remain purchasable, including requests without a key.
    await User.updateOne({ _id: user._id }, { $set: { auraBalance: 5000 } });
    const catalog = Object.values(CARD_CATALOG).filter((card) => card.purchasable);
    assert.equal(catalog.length, 4);
    const catalogResults = await Promise.all(catalog.map((card) => buy({ cardId: card.id, clientId: randomUUID() })));
    assert.ok(catalogResults.every((result) => result.status === 200));
    assert.equal((await User.findById(user._id)).auraBalance, 5000 - catalog.reduce((sum, card) => sum + card.cost, 0));
    assert.deepEqual([...(await User.findById(user._id)).inventory].sort(), catalog.map((card) => card.id).sort());
    assert.equal((await buy({ cardId: 'SIGNAL_FLARE' })).status, 200);

    const beforeTrade = await User.findById(user._id);
    const tradeResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/cards/trades`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ clientId: randomUUID(), offeredCardId: 'GHOST', requestedCardId: 'ORBIT', friendshipId: new mongoose.Types.ObjectId() }),
    });
    assert.equal(tradeResponse.status, 503, 'multi-account trades stay safely unavailable on standalone MongoDB');
    assert.match((await tradeResponse.json()).msg, /temporarily unavailable/);
    assert.deepEqual((await User.findById(user._id)).inventory, beforeTrade.inventory);
    console.log('Standalone MongoDB purchases: active tools, concurrent retries/overspending, ledger recovery, retired receipt replay, blocked collectible sales, privacy and safe trade failure passed.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
