const express = require('express');
const provider = require('../services/nowpaymentsCheckout');
const { reconcileNowPayment } = require('../services/cosmeticOrders');
const router = express.Router();
router.post('/', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  if (!process.env.NOWPAYMENTS_API_KEY || !process.env.NOWPAYMENTS_IPN_SECRET) return res.status(503).json({ msg: 'Payment verification is not configured' });
  let body;
  try { body = JSON.parse(req.body); } catch { return res.status(400).json({ msg: 'Invalid payment callback' }); }
  if (!body || Array.isArray(body) || typeof body !== 'object' || !provider.verifyIpn(body, req.get('x-nowpayments-sig'))) return res.status(400).json({ msg: 'Invalid payment signature' });
  const paymentId = provider.providerId(body.payment_id);
  if (!paymentId) return res.status(400).json({ msg: 'Invalid payment reference' });
  try { await reconcileNowPayment(paymentId); return res.json({ received: true }); }
  catch { console.error('NOWPayments delivery needs recovery'); return res.status(500).json({ msg: 'Payment delivery needs a retry' }); }
});
module.exports = router;
