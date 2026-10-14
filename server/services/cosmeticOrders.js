const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const CosmeticOrder = require('../models/CosmeticOrder');
const Notification = require('../models/Notification');
const GrowthEvent = require('../models/GrowthEvent');
const catalog = require('../config/cosmetics.json');
const provider = require('./stripeCheckout');
const nowpayments = require('./nowpaymentsCheckout');
const { active } = require('./cosmeticPaymentProvider');
const { exponent, minorAmount, atLeast } = require('./checkoutHelpers');
const { eventId, quiet } = require('./productMetrics');
const id = value => String(value?._id || value || '');
const privateFields = '+clientId +grants +priceId +stripeSessionId +nowInvoiceId +nowPaymentId +nowSandbox +invoiceCreation +invoiceCreationStartedAt +checkoutUrl';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const closed = message => { throw Object.assign(new Error(message), { status: 409, publicCode: 'COSMETIC_CHECKOUT_CLOSED' }); };
const orderKey = (actor, clientId) => 'style_' + createHash('sha256').update(`cosmetic:${actor}:${clientId}`).digest('hex').slice(0, 32);
const person = user => ({ displayName: user?.displayName || 'Your friend', username: user?.username || null, avatar: user?.avatar || null, avatarFrame: user?.avatarFrame || 'plain' });
const needsInvoiceRecovery = order => order.invoiceCreation === 'UNCERTAIN' || order.invoiceCreation === 'SENDING' && Date.now() - new Date(order.invoiceCreationStartedAt || order.updatedAt).getTime() > 30000;
const orderView = async (order, viewerId) => {
  const [buyer, recipient] = await Promise.all([User.findById(order.buyerId).select('displayName username avatar avatarFrame').lean(), User.findById(order.recipientId).select('displayName username avatar avatarFrame').lean()]);
  const paymentProvider = order.provider || 'stripe';
  const canResume = ['PREPARING', 'OPEN'].includes(order.status) && (paymentProvider === 'stripe' || Boolean(order.nowInvoiceId && order.checkoutUrl) || order.invoiceCreation === 'READY');
  return { id: order._id, packId: order.packId, status: order.status, provider: paymentProvider, paymentStatus: order.nowPaymentStatus || null, canResume, canCancel: paymentProvider === 'stripe' && order.status === 'OPEN', needsSupport: paymentProvider === 'nowpayments' && order.status === 'PREPARING' && needsInvoiceRecovery(order), amount: order.amount, currency: order.currency, exponent: exponent(order.currency), paidTotal: order.paidTotal, paidAt: order.paidAt, forMe: id(order.recipientId) === id(viewerId), isGift: id(order.buyerId) !== id(order.recipientId), ...(id(order.buyerId) === id(viewerId) ? { checkoutFriendshipId: id(order.friendshipId) || null } : {}), buyer: person(buyer), recipient: person(recipient) };
};
const giftOptions = async (actorId, packId) => {
  const pack = catalog.packs.find(pack => pack.id === packId);
  if (!pack) fail(404, 'Choose a collection from the shop');
  const actor = await User.findById(actorId).select('isTestAccount testOwnerId').lean();
  if (!actor) fail(404, 'Account not found');
  const duos = await Friendship.find({ status: 'ACTIVE', $or: [{ user1: actorId }, { user2: actorId }] }).select('user1 user2').lean();
  const friends = await User.find({ _id: { $in: duos.map(duo => id(duo.user1) === id(actorId) ? duo.user2 : duo.user1) }, ...(actor.isTestAccount ? { isTestAccount: true, testOwnerId: actor.testOwnerId } : { isTestAccount: { $ne: true } }) }).select('displayName username avatar avatarFrame +cosmeticUnlocks').lean();
  return { friends: duos.flatMap(duo => { const friend = friends.find(friend => id(friend) === (id(duo.user1) === id(actorId) ? id(duo.user2) : id(duo.user1))); return friend ? [{ friendshipId: id(duo), person: person(friend), alreadyOwned: pack.grants.every(grant => friend.cosmeticUnlocks?.includes(grant)) }] : []; }) };
};
const ownedOrder = async (actorId, orderId, buyerOnly = false) => {
  if (!/^style_[a-f0-9]{32}$/.test(orderId)) fail(404, 'Purchase not found');
  const order = await CosmeticOrder.findOne({ _id: orderId, ...(buyerOnly ? { buyerId: actorId } : { $or: [{ buyerId: actorId }, { recipientId: actorId }] }) }).select(privateFields).lean();
  if (!order) fail(404, 'Purchase not found');
  return order;
};
const releaseHold = order => User.updateOne({ _id: order.recipientId }, { $pull: { cosmeticCheckoutHolds: { orderId: order._id } } });
const ensureHold = async order => {
  const held = await User.updateOne({ _id: order.recipientId, cosmeticUnlocks: { $not: { $all: order.grants } }, $or: [{ 'cosmeticCheckoutHolds.orderId': order._id }, { cosmeticCheckoutHolds: { $not: { $elemMatch: { grants: { $in: order.grants } } } } }] }, { $addToSet: { cosmeticCheckoutHolds: { orderId: order._id, grants: order.grants } } });
  if (!held.matchedCount) {
    const latest = await CosmeticOrder.findById(order._id).select(privateFields).lean();
    if (['PAID', 'DELIVERED'].includes(latest.status)) return latest;
    await CosmeticOrder.updateOne({ _id: order._id, status: 'PREPARING' }, { $set: { status: 'FAILED' } });
    fail(409, 'This collection is already owned or has an unfinished checkout. Open your purchases to continue.');
  }
  return order;
};
const recordPaymentEvent = (order, type) => quiet(async () => {
  const _id = eventId(`cosmetic:${type}:${order._id}`);
  try { await GrowthEvent.updateOne({ _id }, { $setOnInsert: { userId: order.buyerId, type, source: order.packId, createdAt: type === 'COSMETIC_PAID' ? order.paidAt : order.createdAt, metadata: {} } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000 || !await GrowthEvent.exists({ _id })) throw error; }
});
const deliverOrder = async orderId => {
  const order = await CosmeticOrder.findById(orderId).select(privateFields).lean();
  if (!order || !['PAID', 'DELIVERED'].includes(order.status)) return order;
  const update = await User.updateOne({ _id: order.recipientId, 'cosmeticReceipts.orderId': { $ne: order._id } }, {
    $addToSet: { cosmeticUnlocks: { $each: order.grants } },
    $push: { cosmeticReceipts: { orderId: order._id, packId: order.packId, buyerId: order.buyerId, receivedAt: order.paidAt, seenAt: null } },
    $pull: { cosmeticCheckoutHolds: { orderId: order._id } }
  });
  if (!update.matchedCount && !await User.exists({ _id: order.recipientId, 'cosmeticReceipts.orderId': order._id })) throw new Error('Paid recipient unavailable; delivery requires recovery');
  await releaseHold(order);
  if (id(order.buyerId) !== id(order.recipientId)) {
    const buyer = await User.findById(order.buyerId).select('displayName').lean();
    const _id = eventId(`cosmetic-gift:${order._id}`), pack = catalog.packs.find(pack => pack.id === order.packId);
    try { await Notification.updateOne({ _id }, { $setOnInsert: { toUserId: order.recipientId, fromUserId: order.buyerId, type: 'COSMETIC_GIFT', title: 'An edition, just for you', message: `${buyer?.displayName || 'A friend'} sent you ${pack.name}. Make it yours.`, cosmeticOrderId: order._id, createdAt: order.paidAt, read: false } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000 || !await Notification.exists({ _id })) throw error; }
  }
  await recordPaymentEvent(order, 'COSMETIC_PAID');
  await CosmeticOrder.updateOne({ _id: order._id, status: 'PAID' }, { $set: { status: 'DELIVERED', deliveredAt: new Date() } });
  return CosmeticOrder.findById(order._id).select(privateFields).lean();
};
const reconcileSession = async (sessionId, { failed = false } = {}) => {
  const session = await provider.client().checkout.sessions.retrieve(sessionId);
  const orderId = session.metadata?.hakoware_order;
  if (!/^style_[a-f0-9]{32}$/.test(orderId || '')) return null;
  let order = await CosmeticOrder.findById(orderId).select(privateFields).lean();
  if (!order || order.provider === 'nowpayments' || order.stripeSessionId && order.stripeSessionId !== session.id || session.client_reference_id !== order._id || session.currency !== order.currency || session.mode !== 'payment') return null;
  if (session.payment_status === 'paid' && session.status === 'complete') {
    const lines = await provider.client().checkout.sessions.listLineItems(session.id, { limit: 2 });
    if (lines.has_more || lines.data.length !== 1 || lines.data[0].quantity !== 1 || lines.data[0].price?.id !== order.priceId || session.amount_subtotal !== order.amount || !Number.isSafeInteger(session.amount_total) || session.amount_total < order.amount) throw new Error('Stripe payment does not match the stored order');
    await CosmeticOrder.updateOne({ _id: order._id, status: { $in: ['PREPARING', 'OPEN', 'EXPIRED'] }, $or: [{ stripeSessionId: null }, { stripeSessionId: session.id }] }, { $set: { status: 'PAID', stripeSessionId: session.id, paidAt: new Date(), paidTotal: session.amount_total, checkoutUrl: null } });
    return deliverOrder(order._id);
  }
  if (session.status === 'expired' && !['PAID', 'DELIVERED'].includes(order.status)) {
    await CosmeticOrder.updateOne({ _id: order._id, status: { $in: ['PREPARING', 'OPEN'] } }, { $set: { status: 'EXPIRED', stripeSessionId: session.id, checkoutUrl: null } });
    await releaseHold(order);
  }
  if (failed && session.status === 'complete' && session.payment_status === 'unpaid' && session.payment_intent && !['PAID', 'DELIVERED'].includes(order.status)) {
    const intent = await provider.client().paymentIntents.retrieve(typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id);
    if (['requires_payment_method', 'canceled'].includes(intent.status)) {
      const changed = await CosmeticOrder.updateOne({ _id: order._id, status: { $in: ['PREPARING', 'OPEN'] } }, { $set: { status: 'FAILED', stripeSessionId: session.id, checkoutUrl: null } });
      if (changed.modifiedCount) await releaseHold(order);
    }
  }
  return CosmeticOrder.findById(order._id).select(privateFields).lean();
};
const nowStatuses = new Set(['waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired']);
const reconcileNowPayment = async paymentId => {
  const payment = await nowpayments.getPayment(paymentId);
  const orderId = String(payment.order_id || '');
  if (!/^style_[a-f0-9]{32}$/.test(orderId)) return null;
  let order = await CosmeticOrder.findById(orderId).select(privateFields).lean();
  if (!order || order.provider !== 'nowpayments') return null;
  if (Boolean(order.nowSandbox) !== nowpayments.sandbox()) provider.fail('This payment needs its original provider environment to be confirmed.');
  const invoiceId = nowpayments.providerId(payment.invoice_id), reference = nowpayments.providerId(payment.payment_id);
  if (!invoiceId || reference !== String(paymentId) || order.nowInvoiceId && order.nowInvoiceId !== invoiceId || String(payment.price_currency).toLowerCase() !== order.currency || minorAmount(payment.price_amount, exponent(order.currency)) !== order.amount || !nowStatuses.has(payment.payment_status)) throw new Error('NOWPayments payment does not match the stored order');
  if (['PAID', 'DELIVERED'].includes(order.status)) return deliverOrder(order._id);
  if (!['PREPARING', 'OPEN'].includes(order.status)) throw new Error('A closed purchase needs manual payment review');
  // A failed/expired coin quote does not revoke its hosted invoice. Keep the
  // same order and reservation: the buyer can resume it for a fresh quote.
  if (payment.payment_status === 'finished' && !atLeast(payment.actually_paid, payment.pay_amount)) throw new Error('NOWPayments payment is not fully funded');
  const paid = payment.payment_status === 'finished';
  const recoveredUrl = order.checkoutUrl || nowpayments.invoiceUrl(`https://nowpayments.io/payment/?iid=${invoiceId}`, invoiceId);
  const update = { nowInvoiceId: invoiceId, nowPaymentId: reference, nowPaymentStatus: payment.payment_status, invoiceCreation: 'CREATED', ...(paid ? { status: 'PAID', paidAt: new Date(), paidTotal: order.amount, checkoutUrl: null } : { status: 'OPEN', checkoutUrl: recoveredUrl }) };
  const changed = await CosmeticOrder.updateOne({ _id: order._id, provider: 'nowpayments', status: { $in: ['PREPARING', 'OPEN'] }, $or: [{ nowInvoiceId: null }, { nowInvoiceId: invoiceId }] }, { $set: update });
  order = await CosmeticOrder.findById(order._id).select(privateFields).lean();
  if (paid && changed.matchedCount || ['PAID', 'DELIVERED'].includes(order.status)) return deliverOrder(order._id);
  return order;
};
const openNowCheckout = async order => {
  if (['PAID', 'DELIVERED'].includes(order.status)) return { order: await orderView(await deliverOrder(order._id), order.buyerId), checkoutUrl: null };
  if (Boolean(order.nowSandbox) !== nowpayments.sandbox()) provider.fail('This checkout needs its original payment environment.');
  if (order.nowPaymentId) {
    order = await reconcileNowPayment(order.nowPaymentId);
    if (['PAID', 'DELIVERED'].includes(order.status)) return { order: await orderView(order, order.buyerId), checkoutUrl: null };
  }
  if (order.nowInvoiceId && order.checkoutUrl) return { order: await orderView(order, order.buyerId), checkoutUrl: nowpayments.invoiceUrl(order.checkoutUrl, order.nowInvoiceId) };
  if (['FAILED', 'EXPIRED'].includes(order.status)) closed('That checkout did not open. You can start a fresh purchase.');
  nowpayments.requireConfigured();
  order = await ensureHold(order);
  if (['PAID', 'DELIVERED'].includes(order.status)) return openNowCheckout(order);
  const lock = await CosmeticOrder.updateOne({ _id: order._id, provider: 'nowpayments', status: 'PREPARING', invoiceCreation: 'READY', nowInvoiceId: null }, { $set: { invoiceCreation: 'SENDING', invoiceCreationStartedAt: new Date() } });
  if (!lock.modifiedCount) {
    const latest = await CosmeticOrder.findById(order._id).select(privateFields).lean();
    if (latest.nowInvoiceId && latest.checkoutUrl || ['PAID', 'DELIVERED'].includes(latest.status)) return openNowCheckout(latest);
    provider.fail(needsInvoiceRecovery(latest) ? 'Your payment link needs confirmation. Contact support with the purchase reference before starting another purchase.' : 'Your payment link is being confirmed. Check your saved purchase in a moment.');
  }
  let invoice, invoiceId, url;
  try {
    invoice = await nowpayments.createInvoice(order); invoiceId = nowpayments.providerId(invoice.id);
    if (!invoiceId || invoice.order_id !== order._id || String(invoice.price_currency).toLowerCase() !== order.currency || minorAmount(invoice.price_amount, exponent(order.currency)) !== order.amount) throw new Error('NOWPayments returned an invalid invoice');
    url = nowpayments.invoiceUrl(invoice.invoice_url, invoiceId);
  } catch (error) {
    const changed = await CosmeticOrder.updateOne({ _id: order._id, status: 'PREPARING', invoiceCreation: 'SENDING', nowInvoiceId: null }, { $set: error.definitive ? { status: 'FAILED', invoiceCreation: 'READY' } : { invoiceCreation: 'UNCERTAIN' } });
    if (error.definitive && changed.modifiedCount) { await releaseHold(order); closed('The payment provider could not open this checkout. Refresh the shop and try again.'); }
    throw error;
  }
  // An IPN may have finished delivery while the invoice response was in flight.
  await CosmeticOrder.updateOne({ _id: order._id, provider: 'nowpayments', status: { $in: ['PREPARING', 'OPEN'] }, $or: [{ nowInvoiceId: null }, { nowInvoiceId: invoiceId }] }, { $set: { status: 'OPEN', invoiceCreation: 'CREATED', nowInvoiceId: invoiceId, checkoutUrl: url } });
  order = await CosmeticOrder.findById(order._id).select(privateFields).lean();
  await recordPaymentEvent(order, 'CHECKOUT_STARTED');
  return { order: await orderView(order, order.buyerId), checkoutUrl: ['PAID', 'DELIVERED'].includes(order.status) ? null : order.checkoutUrl };
};
const openCheckout = async order => {
  if (order.provider === 'nowpayments') return openNowCheckout(order);
  if (['PAID', 'DELIVERED'].includes(order.status)) return { order: await orderView(await deliverOrder(order._id), order.buyerId), checkoutUrl: null };
  if (order.stripeSessionId) {
    order = await reconcileSession(order.stripeSessionId);
    if (['PAID', 'DELIVERED'].includes(order.status)) return { order: await orderView(order, order.buyerId), checkoutUrl: null };
    if (order.status === 'EXPIRED') closed('That checkout has expired. You can open a fresh checkout.');
    return { order: await orderView(order, order.buyerId), checkoutUrl: order.checkoutUrl };
  }
  if (order.status === 'FAILED') closed('That checkout did not open. You can open a fresh checkout.');
  provider.requireConfigured();
  order = await ensureHold(order);
  if (['PAID', 'DELIVERED'].includes(order.status)) return openCheckout(order);
  // Stripe keeps idempotency keys for at least 24h. Never replay an uncertain
  // creation beyond that window, or release its hold without reconciliation.
  if (Date.now() - new Date(order.createdAt).getTime() > 20 * 3600000) provider.fail('This checkout needs support to confirm it before another purchase.');
  const buyer = await User.findById(order.buyerId).select('email displayName').lean();
  let session;
  try { session = await provider.client().checkout.sessions.create({ mode: 'payment', client_reference_id: order._id, customer_email: buyer.email,
    line_items: [{ price: order.priceId, quantity: 1 }], metadata: { hakoware_order: order._id },
    success_url: provider.returnUrl(order._id, 'success'), cancel_url: provider.returnUrl(order._id, 'cancelled'),
    automatic_tax: { enabled: order.taxEnabled }, adaptive_pricing: { enabled: false }
  }, { idempotencyKey: order._id }); }
  catch (error) {
    // Stripe's definitive parameter rejection creates no checkout. An in-flight
    // idempotency conflict or transport failure keeps its reservation instead.
    if (error.type === 'StripeInvalidRequestError' && error.statusCode === 400 && error.code !== 'idempotency_key_in_use') {
      const changed = await CosmeticOrder.updateOne({ _id: order._id, status: 'PREPARING' }, { $set: { status: 'FAILED' } });
      if (changed.modifiedCount) { await releaseHold(order); closed('Stripe could not open this checkout. Refresh the shop and try again.'); }
    }
    throw error;
  }
  if (!session.id || !session.url || new URL(session.url).protocol !== 'https:' || new URL(session.url).hostname !== 'checkout.stripe.com') throw new Error('Stripe checkout response unavailable');
  await CosmeticOrder.updateOne({ _id: order._id, status: 'PREPARING' }, { $set: { status: 'OPEN', stripeSessionId: session.id, checkoutUrl: session.url, ...(session.expires_at ? { checkoutExpiresAt: new Date(session.expires_at * 1000) } : {}) } });
  order = await CosmeticOrder.findById(order._id).select(privateFields).lean();
  await recordPaymentEvent(order, 'CHECKOUT_STARTED');
  return { order: await orderView(order, order.buyerId), checkoutUrl: ['PAID', 'DELIVERED'].includes(order.status) ? null : session.url };
};
const createCheckout = async (actorId, body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['packId', 'clientId', 'friendshipId'].includes(key)) || typeof body.clientId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.clientId)) fail(400, 'A valid purchase retry key is required');
  const pack = catalog.packs.find(pack => pack.id === body.packId);
  if (!pack) fail(404, 'Choose a collection from the shop');
  if (body.friendshipId != null && (typeof body.friendshipId !== 'string' || !mongoose.isValidObjectId(body.friendshipId))) fail(404, 'Choose an accepted friend');
  const actor = await User.findById(actorId).select('isTestAccount').lean();
  if (!actor || actor.isTestAccount) fail(403, 'Purchases require your real account');
  const key = orderKey(actorId, body.clientId);
  const existing = await CosmeticOrder.findById(key).select(privateFields).lean();
  if (existing) {
    if (existing.packId !== body.packId || id(existing.friendshipId) !== id(body.friendshipId)) fail(409, 'This retry belongs to a different purchase.');
    return openCheckout(existing);
  }
  const checkoutProvider = active(); checkoutProvider.requireConfigured();
  let recipientId = actorId;
  if (body.friendshipId) {
    if (!mongoose.isValidObjectId(body.friendshipId)) fail(404, 'Choose an accepted friend');
    const duo = await Friendship.findOne({ _id: body.friendshipId, status: 'ACTIVE', $or: [{ user1: actorId }, { user2: actorId }] }).lean();
    if (!duo) fail(404, 'Choose an accepted friend');
    recipientId = id(duo.user1) === id(actorId) ? duo.user2 : duo.user1;
    if (!await User.exists({ _id: recipientId, isTestAccount: { $ne: true } })) fail(404, 'Choose an accepted friend');
  }
  const price = await checkoutProvider.priceFor(pack.id);
  const fields = { buyerId: actorId, recipientId, friendshipId: body.friendshipId || null, packId: pack.id, grants: pack.grants, clientId: body.clientId, provider: checkoutProvider.name, priceId: price.id, amount: price.amount, currency: price.currency, checkoutExpiresAt: checkoutProvider.name === 'stripe' ? new Date(Date.now() + 86400000) : null, taxEnabled: checkoutProvider.name === 'stripe' && process.env.STRIPE_AUTOMATIC_TAX_ENABLED === 'true', nowSandbox: checkoutProvider.name === 'nowpayments' && nowpayments.sandbox(), invoiceCreation: 'READY', status: 'PREPARING' };
  try { await CosmeticOrder.updateOne({ _id: key }, { $setOnInsert: fields }, { upsert: true }); }
  catch (error) { if (error.code !== 11000 || !await CosmeticOrder.exists({ _id: key })) throw error; }
  let order = await CosmeticOrder.findById(key).select(privateFields).lean();
  if (order.packId !== body.packId || id(order.friendshipId) !== id(body.friendshipId)) fail(409, 'This retry belongs to a different purchase.');
  if (order.status !== 'PREPARING') return openCheckout(order);
  return openCheckout(order);
};
const purchases = async actorId => {
  const rows = await CosmeticOrder.find({ $or: [{ buyerId: actorId }, { recipientId: actorId, status: { $in: ['PAID', 'DELIVERED'] } }] }).sort({ createdAt: -1 }).limit(30).select(privateFields).lean();
  const results = [];
  for (let order of rows) {
    if (order.status === 'PAID') order = await deliverOrder(order._id);
    results.push(await orderView(order, actorId));
  }
  return { orders: results };
};
const verifyOrder = async (actorId, orderId) => {
  let order = await ownedOrder(actorId, orderId);
  if (order.status === 'PAID') order = await deliverOrder(order._id);
  else if (order.provider === 'nowpayments' && order.nowPaymentId && order.status !== 'DELIVERED') order = await reconcileNowPayment(order.nowPaymentId);
  else if (order.stripeSessionId && !['DELIVERED', 'FAILED', 'EXPIRED'].includes(order.status)) order = await reconcileSession(order.stripeSessionId);
  return { order: await orderView(order, actorId) };
};
const resumeCheckout = async (actorId, orderId) => openCheckout(await ownedOrder(actorId, orderId, true));
const cancelCheckout = async (actorId, orderId) => {
  let order = await ownedOrder(actorId, orderId, true);
  if (order.provider === 'nowpayments') fail(409, 'This hosted invoice cannot be closed here. Resume the same saved purchase or contact support.');
  if (!order.stripeSessionId) fail(409, 'That checkout needs to be confirmed before it can be closed.');
  if (order.status === 'OPEN') {
    try { await provider.client().checkout.sessions.expire(order.stripeSessionId); }
    catch (error) { if (error.type !== 'StripeInvalidRequestError') throw error; }
  }
  order = await reconcileSession(order.stripeSessionId);
  return { order: await orderView(order, actorId) };
};
const acknowledgeReceipt = async (actorId, orderId) => {
  const order = await ownedOrder(actorId, orderId);
  if (id(order.recipientId) !== id(actorId) || !['PAID', 'DELIVERED'].includes(order.status)) fail(404, 'Edition not found');
  await User.updateOne({ _id: actorId, cosmeticReceipts: { $elemMatch: { orderId, seenAt: null } } }, { $set: { 'cosmeticReceipts.$.seenAt': new Date() } });
  return { success: true };
};
module.exports = { createCheckout, resumeCheckout, cancelCheckout, verifyOrder, purchases, giftOptions, acknowledgeReceipt, reconcileSession, reconcileNowPayment, deliverOrder, orderKey, orderView };
