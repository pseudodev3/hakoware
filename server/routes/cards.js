const express = require('express');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const {
  createOffer,
  respondToOffer,
  collectionSnapshot,
} = require('../services/cardTrading');
const router = express.Router();
router.use(auth);
const limiter = createRateLimiter({
  name: 'card-trade',
  windowMs: 600000,
  max: 30,
  keyGenerator: (req) => req.user.id,
  message: 'Give your offers a moment. Try again shortly.',
});
router.get('/', async (req, res) => {
  try {
    res.json(await collectionSnapshot(req.user.id));
  } catch (error) {
    sendRouteError(res, error, 'Could not load your collection');
  }
});
router.post('/trades', limiter, async (req, res) => {
  try {
    const trade = await createOffer(req.user.id, req.body);
    res.json({
      success: true,
      tradeId: String(trade._id),
      status: trade.status,
    });
  } catch (error) {
    sendRouteError(res, error, 'Could not make this offer');
  }
});
router.post('/trades/:id/respond', limiter, async (req, res) => {
  try {
    const trade = await respondToOffer(
      req.user.id,
      req.params.id,
      String(req.body.action || '').toUpperCase(),
    );
    res.json({
      success: true,
      tradeId: String(trade._id),
      status: trade.status,
    });
  } catch (error) {
    sendRouteError(res, error, 'Could not answer this offer');
  }
});
module.exports = router;
