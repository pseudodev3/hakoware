const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User'), Friendship = require('../models/Friendship'), Order = require('../models/CosmeticOrder');
const Notification = require('../models/Notification'), GrowthEvent = require('../models/GrowthEvent');
const provider = require('../services/nowpaymentsCheckout'), service = require('../services/cosmeticOrders');
const { shopSnapshot, catalog } = require('../services/cosmetics');
const { atLeast, minorAmount } = require('../services/checkoutHelpers');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  const originalRequest = provider.request, originalNotice = Notification.updateOne, originalFetch = global.fetch;
  const invoices = new Map(), payments = new Map(); let created = 0, reads = 0, lost = false, reject = false, malformed = false, replayDuringCreation = null;
  try {
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await Promise.all([User, Friendship, Order, Notification, GrowthEvent].map(model => model.createCollection()));
    await mongoose.connection.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    await assert.rejects(Order.collection.createIndex({ buyerId: 1 }), /available disk space.*less than required minimum/);
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.NOWPAYMENTS_IPN_SECRET = randomBytes(32).toString('hex'); process.env.NOWPAYMENTS_API_KEY = 'local_nowpayments_fixture';
    process.env.NOWPAYMENTS_SANDBOX = 'false'; process.env.COSMETIC_PAYMENT_PROVIDER = 'nowpayments'; process.env.COSMETIC_SALES_ENABLED = 'true'; process.env.FRONTEND_URL = 'https://hakoware.xyz'; process.env.API_URL = 'https://api.example.test'; process.env.COSMETIC_PRICE_CURRENCY = 'usd';
    for (const pack of catalog.packs) process.env['COSMETIC_PRICE_' + pack.id.toUpperCase()] = pack.bundle ? '11.99' : '4.99';
    const people = await User.create(['Ari', 'Maya', 'Sol', 'Nia', 'Jules', 'Kai', 'Rin', 'Bea', 'Len', 'Zoe'].map(name => ({ displayName: name, email: name + '@example.test', password: 'fixture', auraBalance: 100, inventory: ['PURIFY'], notificationPreferences: { email: false } })));
    const [ari, maya, sol, nia, jules, kai, rin, bea, len, zoe] = people;
    const duo = await Friendship.create({ user1: ari._id, user2: maya._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE' });
    const pending = await Friendship.create({ user1: ari._id, user2: sol._id, user1DisplayName: 'Ari', user2DisplayName: 'Sol', status: 'PENDING' });
    const record = async person => User.findById(person._id).select('+cosmeticUnlocks +cosmeticCheckoutHolds +cosmeticReceipts');
    const paymentFor = invoice => {
      const payment = { payment_id: String(900000 + invoices.size), invoice_id: invoice.id, order_id: invoice.order_id, price_amount: invoice.price_amount, price_currency: invoice.price_currency, pay_currency: 'usdc', pay_amount: '4.99', actually_paid: '0', payment_status: 'waiting' };
      payments.set(payment.payment_id, payment); return payment;
    };
    provider.request = async (method, path, body) => {
      if (method === 'GET') { reads++; const payment = payments.get(path.split('/').at(-1)); if (!payment) throw new Error('Payment not found'); return structuredClone(payment); }
      assert.equal(path, '/invoice');
      assert.equal(body.ipn_callback_url, 'https://api.example.test/api/payments/nowpayments/webhook'); assert.equal(body.price_currency, 'usd');
      for (const key of ['pay_currency', 'payout_address', 'payout_currency', 'customer_email']) assert.equal(key in body, false);
      assert.ok(new URL(body.success_url).searchParams.get('cosmetic_order').startsWith('style_')); assert.equal(new URL(body.success_url).origin, 'https://hakoware.xyz');
      if (reject) { reject = false; throw Object.assign(new Error('Provider rejected request'), { definitive: true }); }
      const invoice = { ...body, id: String(700000 + ++created) }; invoice.invoice_url = `https://nowpayments.io/payment/?iid=${invoice.id}`;
      invoices.set(invoice.id, invoice); paymentFor(invoice);
      if (replayDuringCreation) { const fn = replayDuringCreation; replayDuringCreation = null; await fn([...payments.values()].at(-1)); }
      if (lost) { lost = false; throw new Error('Invoice response interrupted'); }
      if (malformed) { malformed = false; return { ...invoice, invoice_url: `https://nowpayments.io.attacker.test/payment/?iid=${invoice.id}` }; }
      return structuredClone(invoice);
    };
    const app = express(); app.use('/api/payments/nowpayments/webhook', require('../routes/nowpaymentsWebhook')); app.use(express.json()); app.use(require('../middleware/requestGuard')); app.use('/api/cosmetics', require('../routes/cosmetics'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (person, path, method = 'GET', body) => { const headers = { 'content-type': 'application/json', ...(person ? { 'x-auth-token': jwt.sign({ user: { id: String(person._id), v: 0 } }, process.env.JWT_SECRET) } : {}) }; const r = await fetch(base + '/cosmetics' + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: r.status, data: await r.json() }; };
    // The canonical fixture below is independent of the implementation sorter.
    const canonicalFixture = '{"a":{"a":1,"z":2},"payment_id":123,"z":[{"a":4,"z":5}]}';
    const fixtureSig = createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET).update(canonicalFixture).digest('hex');
    assert.equal(provider.verifyIpn({ z: [{ z: 5, a: 4 }], payment_id: 123, a: { z: 2, a: 1 } }, fixtureSig), true);
    assert.equal(provider.verifyIpn({ payment_id: 124, a: { a: 1, z: 2 }, z: [{ a: 4, z: 5 }] }, fixtureSig), false);
    const webhook = async (payment, { valid = true, claimedStatus = 'finished' } = {}) => {
      const body = { payment_status: claimedStatus, payment_id: payment.payment_id, order_id: payment.order_id };
      const canonical = JSON.stringify({ order_id: body.order_id, payment_id: body.payment_id, payment_status: body.payment_status });
      const signature = valid ? createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET).update(canonical).digest('hex') : '0'.repeat(128);
      const r = await fetch(base + '/payments/nowpayments/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signature }, body: JSON.stringify(body) }); return r.status;
    };
    assert.equal((await request(null, '/checkout', 'POST', {})).status, 401);
    const intent = { packId: 'nocturne', clientId: randomUUID() };
    for (const injection of [{ amount: 1 }, { paid: true }, { provider: 'stripe' }, { payout_address: 'elsewhere' }]) assert.equal((await request(ari, '/checkout', 'POST', { ...intent, ...injection })).status, 400);
    const concurrent = await Promise.allSettled(Array.from({ length: 8 }, () => service.createCheckout(ari._id, intent)));
    assert.ok(concurrent.some(r => r.status === 'fulfilled')); assert.equal(created, 1);
    for (const result of concurrent.filter(r => r.status === 'rejected')) assert.equal(result.reason.status, 503);
    let purchase = await service.createCheckout(ari._id, intent), payment = [...payments.values()][0];
    assert.equal(purchase.order.provider, 'nowpayments'); assert.equal(purchase.order.canCancel, false); assert.equal(purchase.order.amount, 499); assert.equal((await record(ari)).cosmeticCheckoutHolds.length, 1);
    assert.equal((await request(maya, '/orders/' + purchase.order.id + '/resume', 'POST', {})).status, 404);
    const beforeReads = reads; assert.equal(await webhook(payment, { valid: false }), 400); assert.equal(reads, beforeReads);
    assert.equal(await webhook(payment), 200); assert.equal((await record(ari)).cosmeticUnlocks.length, 0, 'a claimed finished callback cannot grant styles while the authenticated payment is waiting');
    payment.payment_status = 'confirmed'; payment.actually_paid = '4.99'; assert.equal(await webhook(payment), 200); assert.equal((await record(ari)).cosmeticUnlocks.length, 0, 'blockchain confirmation is not final payout');
    payment.payment_status = 'partially_paid'; payment.actually_paid = '4.98'; assert.equal(await webhook(payment), 200); assert.equal((await service.verifyOrder(ari._id, purchase.order.id)).order.paymentStatus, 'partially_paid');
    payment.payment_status = 'finished'; assert.equal(await webhook(payment), 500); assert.equal((await record(ari)).cosmeticReceipts.length, 0, 'underfunded finished results fail closed');
    for (const [field, bad] of [['price_amount', 0.01], ['price_currency', 'eur'], ['invoice_id', '700999'], ['payment_id', '900999']]) {
      const old = payment[field]; payment[field] = bad; assert.equal(await webhook(payment), 500); payment[field] = old;
    }
    payment.actually_paid = '4.99000000';
    assert.ok((await Promise.all(Array.from({ length: 6 }, () => webhook(payment)))).every(status => status === 200));
    assert.equal((await record(ari)).cosmeticReceipts.length, 1); assert.equal((await record(ari)).cosmeticUnlocks.length, 3); assert.equal((await record(ari)).cosmeticCheckoutHolds.length, 0);
    assert.equal((await service.createCheckout(ari._id, intent)).checkoutUrl, null); assert.equal(created, 1);
    payment.payment_status = 'waiting'; assert.equal(await webhook(payment), 200); assert.equal((await Order.findById(purchase.order.id)).status, 'DELIVERED', 'late pending messages cannot reverse final delivery');
    const bundle = await service.createCheckout(ari._id, { packId: 'complete', clientId: randomUUID() }); payment = [...payments.values()].at(-1);
    assert.equal(bundle.order.amount, 1199); payment.pay_amount = '11.99'; payment.actually_paid = '12.00'; payment.payment_status = 'finished'; assert.equal(await webhook(payment), 200);
    assert.equal((await record(ari)).cosmeticUnlocks.length, catalog.packs.find(pack => pack.id === 'complete').grants.length); assert.equal((await record(ari)).cosmeticReceipts.length, 2);
    await assert.rejects(service.createCheckout(ari._id, { packId: 'porcelain', clientId: randomUUID() }), e => e.status === 409, 'complete-set ownership prevents a duplicate self purchase');
    const gift = await service.createCheckout(ari._id, { packId: 'prism', friendshipId: String(duo._id), clientId: randomUUID() }); payment = [...payments.values()].at(-1);
    await assert.rejects(service.createCheckout(ari._id, { packId: 'prism', friendshipId: String(pending._id), clientId: randomUUID() }), e => e.status === 404);
    assert.equal((await request(sol, '/orders/' + gift.order.id + '/verify', 'POST', {})).status, 404);
    assert.equal((await request(maya, '/orders/' + gift.order.id + '/resume', 'POST', {})).status, 404);
    payment.payment_status = 'finished'; payment.actually_paid = '5';
    let noticeOutage = true; Notification.updateOne = function(...args) { if (noticeOutage) { noticeOutage = false; return Promise.reject(new Error('Notification outage')); } return originalNotice.apply(this, args); };
    assert.equal(await webhook(payment), 500); assert.equal((await record(maya)).cosmeticReceipts.length, 1); Notification.updateOne = originalNotice;
    assert.equal(await webhook(payment), 200); assert.equal(await webhook(payment), 200); assert.equal((await record(maya)).cosmeticReceipts.length, 1); assert.equal(await Notification.countDocuments({ cosmeticOrderId: gift.order.id }), 1);
    assert.equal((await request(ari, '/orders/' + gift.order.id + '/seen', 'POST', {})).status, 404); assert.equal((await request(maya, '/orders/' + gift.order.id + '/seen', 'POST', {})).status, 200);
    // A quote failure keeps the original invoice and prevents an overlapping bundle.
    const open = await service.createCheckout(nia._id, { packId: 'porcelain', clientId: randomUUID() }); payment = [...payments.values()].at(-1);
    payment.payment_status = 'expired'; assert.equal(await webhook(payment), 200);
    const beforeResume = created; assert.equal((await service.resumeCheckout(nia._id, open.order.id)).checkoutUrl, open.checkoutUrl); assert.equal(created, beforeResume);
    assert.equal((await request(nia, '/orders/' + open.order.id + '/cancel', 'POST', {})).status, 409); assert.equal((await record(nia)).cosmeticCheckoutHolds.length, 1);
    await assert.rejects(service.createCheckout(nia._id, { packId: 'complete', clientId: randomUUID() }), e => e.status === 409);
    // Never replay a POST after an uncertain response; signed proof can recover it.
    lost = true; const unknownBody = { packId: 'nocturne', clientId: randomUUID() }; await assert.rejects(service.createCheckout(jules._id, unknownBody), /interrupted/); payment = [...payments.values()].at(-1);
    const unknownId = service.orderKey(jules._id, unknownBody.clientId), beforeRetry = created;
    await assert.rejects(service.createCheckout(jules._id, unknownBody), e => e.status === 503); assert.equal(created, beforeRetry);
    assert.equal((await service.verifyOrder(jules._id, unknownId)).order.needsSupport, true); assert.equal((await record(jules)).cosmeticCheckoutHolds.length, 1);
    payment.payment_status = 'partially_paid'; payment.actually_paid = '2'; assert.equal(await webhook(payment), 200);
    const recoveredLink = await service.resumeCheckout(jules._id, unknownId); assert.equal(new URL(recoveredLink.checkoutUrl).searchParams.get('iid'), payment.invoice_id); assert.equal(created, beforeRetry);
    payment.payment_status = 'finished'; payment.actually_paid = payment.pay_amount; assert.equal(await webhook(payment), 200); assert.equal((await service.verifyOrder(jules._id, unknownId)).order.status, 'DELIVERED');
    reject = true; const rejectedBody = { packId: 'nocturne', clientId: randomUUID() }; await assert.rejects(service.createCheckout(kai._id, rejectedBody), e => e.publicCode === 'COSMETIC_CHECKOUT_CLOSED'); assert.equal((await record(kai)).cosmeticCheckoutHolds.length, 0);
    assert.equal((await request(kai, '/checkout', 'POST', rejectedBody)).data.code, 'COSMETIC_CHECKOUT_CLOSED');
    malformed = true; const badBody = { packId: 'nocturne', clientId: randomUUID() }; await assert.rejects(service.createCheckout(rin._id, badBody), /invalid checkout link/); const afterBad = created;
    await assert.rejects(service.createCheckout(rin._id, badBody), e => e.status === 503); assert.equal(created, afterBad);
    // An in-flight IPN cannot be downgraded by the late invoice response.
    replayDuringCreation = async p => { p.payment_status = 'finished'; p.actually_paid = p.pay_amount; assert.equal(await webhook(p), 200); };
    const rapid = await service.createCheckout(bea._id, { packId: 'nocturne', clientId: randomUUID() }); assert.equal(rapid.order.status, 'DELIVERED'); assert.equal(rapid.checkoutUrl, null);
    // A process restart leaves a stale send requiring support, never another invoice.
    const staleBody = { packId: 'nocturne', clientId: randomUUID() }; lost = true; await assert.rejects(service.createCheckout(len._id, staleBody)); const staleId = service.orderKey(len._id, staleBody.clientId);
    await Order.updateOne({ _id: staleId }, { $set: { invoiceCreation: 'SENDING', invoiceCreationStartedAt: new Date(Date.now() - 60000) } });
    assert.equal((await service.verifyOrder(len._id, staleId)).order.needsSupport, true); const beforeStale = created; await assert.rejects(service.resumeCheckout(len._id, staleId), e => e.status === 503); assert.equal(created, beforeStale);
    const races = await Promise.allSettled(Array.from({ length: 5 }, () => service.createCheckout(zoe._id, { packId: 'prism', clientId: randomUUID() }))); assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
    for (const row of (await service.purchases(ari._id)).orders) for (const key of ['nowInvoiceId', 'nowPaymentId', 'checkoutUrl', 'clientId', 'grants', 'invoiceCreation', 'invoiceCreationStartedAt']) assert.equal(key in row, false);
    assert.equal((await record(ari)).auraBalance, 100); assert.deepEqual([...(await record(ari)).inventory], ['PURIFY']);
    assert.equal(await GrowthEvent.countDocuments({ type: 'COSMETIC_PAID' }), 5);
    assert.equal(atLeast('1e-8', '0.00000001'), true); assert.equal(atLeast('0.000000009999999999', '1e-8'), false); assert.equal(atLeast('Infinity', '1'), false); assert.equal(minorAmount('4.999', 2), null);
    // Actual adapter requests keep keys in server headers and never retry POSTs.
    provider.request = originalRequest; let calls = [];
    global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ payment_id: '123' }) }; };
    await provider.getPayment('123'); assert.equal(calls[0].url, 'https://api.nowpayments.io/v1/payment/123'); assert.equal(calls[0].options.headers['x-api-key'], process.env.NOWPAYMENTS_API_KEY); assert.equal(calls[0].options.redirect, 'error');
    global.fetch = async () => { calls.push({}); throw new Error('Connection interrupted'); };
    const beforePost = calls.length; await assert.rejects(provider.request('POST', '/invoice', {}), e => e.status === 503); assert.equal(calls.length, beforePost + 1);
    global.fetch = async () => ({ ok: false, status: 422 }); await assert.rejects(provider.request('POST', '/invoice', {}), e => e.definitive === true);
    global.fetch = async () => ({ ok: false, status: 502 }); await assert.rejects(provider.request('POST', '/invoice', {}), e => e.definitive === false);
    global.fetch = originalFetch; provider.request = async () => { throw new Error('not used'); };
    process.env.COSMETIC_PRICE_NOCTURNE = ''; assert.equal((await shopSnapshot(ari._id)).checkoutAvailable, false); process.env.COSMETIC_PRICE_NOCTURNE = '4.99';
    process.env.NOWPAYMENTS_SANDBOX = 'true'; process.env.NODE_ENV = 'production'; assert.equal(provider.isConfigured(), false); process.env.NOWPAYMENTS_SANDBOX = 'false'; process.env.NODE_ENV = 'test';
    console.log('NOWPayments: signed canonical callbacks, authenticated final status/amount/invoice checks, underpayment gates, concurrency, single invoice creation, stale/unknown response recovery, gifts, delivery outage recovery, resumable failed quotes, private receipts, production sandbox guard and server-only API requests passed with secondary indexes blocked. No real payment or provider API was used.');
  } finally { provider.request = originalRequest; global.fetch = originalFetch; Notification.updateOne = originalNotice; if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
