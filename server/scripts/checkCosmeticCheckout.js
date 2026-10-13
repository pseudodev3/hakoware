const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User'), Friendship = require('../models/Friendship'), Order = require('../models/CosmeticOrder');
const Notification = require('../models/Notification'), GrowthEvent = require('../models/GrowthEvent');
const provider = require('../services/stripeCheckout'), service = require('../services/cosmeticOrders');
const { catalog } = require('../services/cosmetics');
const { currentUserView, contractView } = require('../services/clientViews');
const signer = new Stripe('sk_test_local_fixture');
const sessions = new Map(), keys = new Map();
let created = 0, loseCreationResponse = false;
const fake = {
  webhooks: signer.webhooks,
  paymentIntents: { retrieve: async key => ({ id: key, status: fake.intentStatus || 'requires_payment_method' }) },
  prices: { retrieve: async key => ({ id: key, active: true, type: 'one_time', currency: 'usd', unit_amount: key.endsWith('complete') ? 1900 : 700 }) },
  checkout: { sessions: {
    create: async (body, options) => {
      if (fake.rejectParameters) { fake.rejectParameters = false; throw Object.assign(new Error('Definitive Stripe parameter rejection'), { type: 'StripeInvalidRequestError', statusCode: 400, code: 'amount_too_small' }); }
      const cached = keys.get(options.idempotencyKey);
      if (cached) { assert.equal(cached.body, JSON.stringify(body), 'a retry must use identical Stripe parameters'); return structuredClone(cached.session); }
      const price = await fake.prices.retrieve(body.line_items[0].price), number = ++created;
      const session = { id: 'cs_test_' + number, url: 'https://checkout.stripe.com/c/pay/cs_test_' + number, metadata: body.metadata, client_reference_id: body.client_reference_id, mode: 'payment', status: 'open', payment_status: 'unpaid', currency: price.currency, amount_subtotal: price.unit_amount, amount_total: price.unit_amount, expires_at: Math.floor(Date.now() / 1000) + 86400, priceId: price.id };
      sessions.set(session.id, session); keys.set(options.idempotencyKey, { body: JSON.stringify(body), session });
      if (loseCreationResponse) { loseCreationResponse = false; throw new Error('Response interrupted after Stripe created checkout'); }
      return structuredClone(session);
    },
    retrieve: async key => { assert.ok(sessions.has(key)); return structuredClone(sessions.get(key)); },
    listLineItems: async key => ({ has_more: false, data: [{ quantity: 1, price: { id: sessions.get(key).priceId } }] }),
    expire: async key => { const session = sessions.get(key); if (session.status === 'complete') throw Object.assign(new Error('Already complete'), { type: 'StripeInvalidRequestError' }); session.status = 'expired'; return structuredClone(session); }
  } }
};
async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server; const originalClient = provider.client, originalUpdate = User.updateOne, originalNotice = Notification.updateOne;
  try {
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await Promise.all([User, Friendship, Order, Notification, GrowthEvent].map(model => model.createCollection()));
    await mongoose.connection.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    await assert.rejects(Order.collection.createIndex({ buyerId: 1 }), /available disk space.*less than required minimum/);
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.STRIPE_WEBHOOK_SECRET = randomBytes(32).toString('hex'); process.env.STRIPE_SECRET_KEY = 'sk_test_local_fixture';
    process.env.FRONTEND_URL = 'https://hakoware.xyz'; process.env.COSMETIC_SALES_ENABLED = 'true';
    for (const pack of catalog.packs) process.env['STRIPE_PRICE_' + pack.id.toUpperCase()] = 'price_' + pack.id;
    provider.client = () => fake;
    const people = await User.create(['Ari', 'Maya', 'Sol', 'Nia', 'Jules', 'Kai', 'Rin'].map(name => ({ displayName: name, email: name + '@example.test', password: 'fixture', auraBalance: 100, inventory: ['PURIFY'], notificationPreferences: { email: false } })));
    const [ari, maya, sol, nia, jules, kai, rin] = people;
    const connect = (one, two, status = 'ACTIVE') => Friendship.create({ user1: one._id, user2: two._id, user1DisplayName: one.displayName, user2DisplayName: two.displayName, status });
    const duo = await connect(ari, maya), pending = await connect(ari, sol, 'PENDING');
    const app = express(); app.use('/api/payments/stripe/webhook', require('../routes/stripeWebhook')); app.use(express.json()); app.use(require('../middleware/requestGuard')); app.use('/api/cosmetics', require('../routes/cosmetics'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (person, path, method = 'GET', body) => { const response = await fetch(base + '/cosmetics' + path, { method, headers: { 'content-type': 'application/json', ...(person ? { 'x-auth-token': jwt.sign({ user: { id: String(person._id), v: 0 } }, process.env.JWT_SECRET) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, data: await response.json() }; };
    const webhook = async (session, { signature = true, payloadPaid = false, type = 'checkout.session.completed' } = {}) => {
      const payload = JSON.stringify({ id: 'evt_' + randomUUID(), type, data: { object: { id: session.id, ...(payloadPaid ? { payment_status: 'paid' } : {}) } } });
      const response = await fetch(base + '/payments/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature ? signer.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET }) : 'forged' }, body: payload }); return response.status;
    };
    const pay = session => { session.status = 'complete'; session.payment_status = 'paid'; };
    const receipt = async person => User.findById(person._id).select('+cosmeticUnlocks +cosmeticCheckoutHolds +cosmeticReceipts +productActivity');
    assert.equal((await request(null, '/checkout', 'POST', {})).status, 401);
    const purchase = { packId: 'nocturne', clientId: randomUUID() };
    assert.equal((await request(ari, '/checkout', 'POST', { ...purchase, amount: 1 })).status, 400);
    const starts = await Promise.all(Array.from({ length: 6 }, () => service.createCheckout(ari._id, purchase)));
    assert.equal(created, 1); assert.ok(starts.every(result => result.order.id === starts[0].order.id));
    let session = [...sessions.values()][0];
    assert.equal((await receipt(ari)).cosmeticCheckoutHolds.length, 1);
    assert.equal((await request(maya, '/orders/' + starts[0].order.id + '/resume', 'POST', {})).status, 404);
    assert.equal((await request(ari, '/orders/' + starts[0].order.id + '/verify', 'POST', { paid: true })).status, 400);
    assert.equal(await webhook(session, { signature: false }), 400);
    assert.equal(await webhook(session, { payloadPaid: true }), 200); assert.deepEqual([...(await receipt(ari)).cosmeticUnlocks], [], 'redirects and event claims cannot grant styles without a paid Stripe session');
    await assert.rejects(service.createCheckout(ari._id, { ...purchase, clientId: randomUUID() }), error => error.status === 409);
    await assert.rejects(service.createCheckout(ari._id, { packId: 'complete', clientId: randomUUID() }), error => error.status === 409, 'a bundle cannot overlap an unfinished edition checkout');
    pay(session); const originalSubtotal = session.amount_subtotal; session.amount_subtotal = 1;
    assert.equal(await webhook(session), 500); assert.equal((await receipt(ari)).cosmeticReceipts.length, 0); session.amount_subtotal = originalSubtotal;
    assert.ok((await Promise.all(Array.from({ length: 5 }, () => webhook(session)))).every(status => status === 200));
    assert.equal((await receipt(ari)).cosmeticReceipts.length, 1); assert.equal((await receipt(ari)).cosmeticUnlocks.length, 3); assert.equal((await receipt(ari)).cosmeticCheckoutHolds.length, 0);
    assert.equal((await service.createCheckout(ari._id, purchase)).checkoutUrl, null); assert.equal(created, 1);
    const gift = { packId: 'prism', friendshipId: String(duo._id), clientId: randomUUID() };
    const startedGift = await service.createCheckout(ari._id, gift); session = [...sessions.values()].at(-1);
    await assert.rejects(service.createCheckout(ari._id, { ...gift, friendshipId: undefined }), error => error.status === 409);
    await assert.rejects(service.createCheckout(ari._id, { ...gift, friendshipId: String(pending._id), clientId: randomUUID() }), error => error.status === 404);
    pay(session); let outage = true;
    Notification.updateOne = function(...args) { if (outage) { outage = false; return Promise.reject(new Error('Notification outage')); } return originalNotice.apply(this, args); };
    assert.equal(await webhook(session), 500); assert.equal((await receipt(maya)).cosmeticReceipts.length, 1);
    Notification.updateOne = originalNotice;
    assert.equal(await webhook(session), 200); assert.equal(await webhook(session), 200);
    assert.equal((await receipt(maya)).cosmeticReceipts.length, 1); assert.equal(await Notification.countDocuments({ cosmeticOrderId: startedGift.order.id }), 1);
    assert.equal((await request(maya, '/orders/' + startedGift.order.id + '/resume', 'POST', {})).status, 404, 'gift recipients cannot resume the buyer’s checkout');
    assert.equal((await request(ari, '/orders/' + startedGift.order.id + '/seen', 'POST', {})).status, 404);
    assert.equal((await request(maya, '/orders/' + startedGift.order.id + '/seen', 'POST', {})).status, 200);
    assert.ok((await receipt(maya)).cosmeticReceipts[0].seenAt);
    assert.equal((await request(sol, '/orders/' + startedGift.order.id + '/verify', 'POST', {})).status, 404);
    const options = (await request(ari, '/gift-options?packId=prism')).data; assert.equal(options.friends.length, 1); assert.equal(options.friends[0].alreadyOwned, true);
    // Uncertain provider creation retains its hold and replays the same key.
    loseCreationResponse = true; const interrupted = { packId: 'porcelain', clientId: randomUUID() };
    await assert.rejects(service.createCheckout(nia._id, interrupted), /Response interrupted/); const beforeRetry = created;
    const recovered = await service.createCheckout(nia._id, interrupted); assert.equal(created, beforeRetry);
    assert.equal((await receipt(nia)).cosmeticCheckoutHolds.length, 1);
    await service.cancelCheckout(nia._id, recovered.order.id); assert.equal((await receipt(nia)).cosmeticCheckoutHolds.length, 0);
    const closed = await request(nia, '/checkout', 'POST', interrupted); assert.equal(closed.status, 409); assert.equal(closed.data.code, 'COSMETIC_CHECKOUT_CLOSED');
    const delayed = await service.createCheckout(nia._id, { packId: 'prism', clientId: randomUUID() });
    const delayedSession = [...sessions.values()].at(-1); delayedSession.status = 'complete'; delayedSession.payment_status = 'unpaid'; delayedSession.payment_intent = 'pi_fixture_delayed';
    fake.intentStatus = 'processing'; assert.equal(await webhook(delayedSession, { type: 'checkout.session.async_payment_failed' }), 200); assert.equal((await receipt(nia)).cosmeticCheckoutHolds.length, 1);
    fake.intentStatus = 'requires_payment_method'; assert.equal(await webhook(delayedSession, { type: 'checkout.session.async_payment_failed' }), 200); assert.equal((await receipt(nia)).cosmeticCheckoutHolds.length, 0); assert.equal((await Order.findById(delayed.order.id)).status, 'FAILED');
    fake.rejectParameters = true; await assert.rejects(service.createCheckout(nia._id, { packId: 'porcelain', clientId: randomUUID() }), error => error.publicCode === 'COSMETIC_CHECKOUT_CLOSED'); assert.equal((await receipt(nia)).cosmeticCheckoutHolds.length, 0, 'definitive rejected creation releases its reservation');
    // Recover a database interruption between saving the order and reserving it.
    let reservationOutage = true;
    User.updateOne = function(filter, update, ...rest) { if (reservationOutage && update.$addToSet?.cosmeticCheckoutHolds) { reservationOutage = false; return Promise.reject(new Error('Reservation outage')); } return originalUpdate.call(this, filter, update, ...rest); };
    const paused = { packId: 'nocturne', clientId: randomUUID() };
    await assert.rejects(service.createCheckout(jules._id, paused), /Reservation outage/); User.updateOne = originalUpdate;
    await service.createCheckout(jules._id, { packId: 'complete', clientId: randomUUID() });
    await assert.rejects(service.createCheckout(jules._id, paused), error => error.status === 409, 'resuming a preparing order must acquire the recipient reservation');
    const races = await Promise.allSettled(Array.from({ length: 5 }, () => service.createCheckout(kai._id, { packId: 'prism', clientId: randomUUID() })));
    assert.equal(races.filter(result => result.status === 'fulfilled').length, 1, 'different retry keys cannot create overlapping checkouts');
    const staleBody = { packId: 'prism', clientId: randomUUID() }; loseCreationResponse = true; await assert.rejects(service.createCheckout(rin._id, staleBody));
    const staleId = service.orderKey(rin._id, staleBody.clientId); await Order.collection.updateOne({ _id: staleId }, { $set: { createdAt: new Date(Date.now() - 25 * 3600000) } });
    await assert.rejects(service.resumeCheckout(rin._id, staleId), error => error.status === 503, 'expired idempotency guarantees must not create another charge');
    const raw = await receipt(maya);
    for (const dto of [currentUserView(raw), contractView({ user1: raw }).user1]) for (const key of ['cosmeticUnlocks', 'cosmeticCheckoutHolds', 'cosmeticReceipts', 'productActivity']) assert.equal(key in dto, false);
    assert.equal(raw.auraBalance, 100); assert.deepEqual([...raw.inventory], ['PURIFY']);
    assert.equal(await GrowthEvent.countDocuments({ type: 'COSMETIC_PAID' }), 2);
    console.log('Stripe cosmetics: signed raw webhooks, server-confirmed amount/price/payment, concurrent checkout and delivery retries, gift ownership, receipt privacy, bundle reservations, uncertain creation and recovery, expiry/cancellation, private metrics and unchanged Aura/inventory passed with indexes blocked. No live Stripe charge was performed.');
  } finally { provider.client = originalClient; User.updateOne = originalUpdate; Notification.updateOne = originalNotice; if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
