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
    assert.equal((await buy({ cardId: 'GHOST', clientId: key }, false)).status, 401);
    const results = await Promise.all(Array.from({ length: 6 }, () => buy({ cardId: 'GHOST', clientId: key })));
    assert.ok(results.every((result) => result.status === 200), JSON.stringify(results));
    const after = await User.findById(user._id);
    assert.equal(after.auraBalance, 80);
    assert.deepEqual(after.inventory, ['GHOST']);
    assert.equal(await CardPurchase.countDocuments({ userId: user._id }), 1);
    assert.equal(await AuraTransaction.countDocuments({ userId: user._id, type: 'MARKETPLACE_PURCHASE' }), 1);
    assert.equal((await buy({ cardId: 'PURIFY', clientId: randomUUID() })).status, 400);
    assert.equal((await buy({ cardId: 'ORBIT', clientId: key })).status, 409, 'a key cannot silently buy a different card');
    assert.equal((await buy({ cardId: 'UNKNOWN', clientId: randomUUID() })).status, 400);
    assert.equal((await buy({ cardId: 'GHOST', clientId: 'bad' })).status, 400);
    assert.equal((await User.findById(user._id)).auraBalance, 80);

    // Fail between committed delivery and its journal. Returning success describes
    // the actual outcome; retry and the worker repair it without a second debit.
    const originalUpdate = AuraTransaction.updateOne;
    AuraTransaction.updateOne = async () => { throw new Error('fixture ledger outage'); };
    const interrupted = { cardId: 'ECHO', clientId: randomUUID() };
    try {
      assert.equal((await buy(interrupted)).status, 200);
      const pending = await User.findById(user._id).select('+cardPurchaseReceipts');
      assert.equal(pending.auraBalance, 55);
      assert.equal(pending.inventory.filter((id) => id === 'ECHO').length, 1);
      assert.equal(pending.cardPurchaseReceipts.find((r) => r.clientId === interrupted.clientId).journaled, false);
    } finally { AuraTransaction.updateOne = originalUpdate; }
    await Promise.all([reconcileCardPurchases(), reconcileCardPurchases()]);
    const recovered = await User.findById(user._id).select('+cardPurchaseReceipts');
    assert.equal(recovered.cardPurchaseReceipts.find((r) => r.clientId === interrupted.clientId).journaled, true);
    assert.equal((await buy(interrupted)).status, 200);
    assert.equal((await User.findById(user._id)).auraBalance, 55);
    assert.equal(await AuraTransaction.countDocuments({ userId: user._id, type: 'MARKETPLACE_PURCHASE' }), 2);
    assert.equal('cardPurchaseReceipts' in currentUserView(recovered), false, 'private receipts never enter account payloads');
    assert.equal((await User.findById(user._id)).cardPurchaseReceipts, undefined, 'receipts are excluded by default');

    // An old transaction receipt is still authoritative after this deploy.
    const legacyKey = randomUUID();
    await CardPurchase.create({ userId: user._id, clientId: legacyKey, cardId: 'ORBIT', cost: 20 });
    assert.equal((await buy({ cardId: 'ORBIT', clientId: legacyKey })).status, 200);
    assert.equal((await User.findById(user._id)).auraBalance, 55);
    assert.equal(await AuraTransaction.countDocuments({ userId: user._id, type: 'MARKETPLACE_PURCHASE' }), 2);

    // Distinct requests must not overspend the last 20 Aura.
    await User.updateOne({ _id: user._id }, { $set: { auraBalance: 20 } });
    const lastCopies = await Promise.all([buy({ cardId: 'GHOST', clientId: randomUUID() }), buy({ cardId: 'GHOST', clientId: randomUUID() })]);
    assert.deepEqual(lastCopies.map((result) => result.status).sort(), [200, 400]);
    assert.equal((await User.findById(user._id)).auraBalance, 0);
    assert.equal((await buy({ cardId: 'GHOST', clientId: key })).status, 200, 'retry works with no remaining Aura');
    assert.equal((await User.findById(user._id)).auraBalance, 0);
    // Replaying a purchase after its card was used must not grant another copy.
    await User.updateOne({ _id: user._id }, { $set: { inventory: [] } });
    await buy({ cardId: 'GHOST', clientId: key });
    assert.deepEqual((await User.findById(user._id)).inventory, []);

    // All catalog items, including legacy tool purchases without a retry key.
    await User.updateOne({ _id: user._id }, { $set: { auraBalance: 5000 } });
    const catalog = Object.values(CARD_CATALOG);
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
    console.log('Standalone MongoDB purchases: all cards, concurrent retries/overspending, ledger recovery, old receipts, privacy and safe trade failure passed.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
