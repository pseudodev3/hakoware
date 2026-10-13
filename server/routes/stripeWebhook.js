const express = require('express');
const provider = require('../services/stripeCheckout');
const { reconcileSession } = require('../services/cosmeticOrders');
const router = express.Router();
router.post('/', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ msg: 'Payment verification is not configured' });
  let event;
  try { event = provider.client().webhooks.constructEvent(req.body, req.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).json({ msg: 'Invalid payment signature' }); }
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) await reconcileSession(event.data.object.id, { failed: event.type === 'checkout.session.async_payment_failed' });
    return res.json({ received: true });
  } catch (error) { console.error('Cosmetic payment recovery pending:', error.code || error.type || 'delivery unavailable'); return res.status(500).json({ msg: 'Payment delivery needs a retry' }); }
});
module.exports = router;
