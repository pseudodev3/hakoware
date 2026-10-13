const router = require('express').Router();
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const { shopSnapshot, saveShopWish } = require('../services/cosmetics');
const orders = require('../services/cosmeticOrders');
router.use(auth);
const writes = createRateLimiter({ name: 'cosmetic-list', windowMs: 60000, max: 30, keyGenerator: req => req.user.id });
router.get('/', async (req, res) => { try { res.json(await shopSnapshot(req.user.id)); } catch (error) { sendRouteError(res, error, 'Could not open the style shop'); } });
router.put('/saved/:id', writes, async (req, res) => { try { res.json(await saveShopWish(req.user.id, req.params.id, req.body)); } catch (error) { sendRouteError(res, error, 'Could not confirm your saved collections'); } });
const checkout = createRateLimiter({ name: 'cosmetic-checkout', windowMs: 60000, max: 12, keyGenerator: req => req.user.id });
router.get('/gift-options', async (req, res) => { try { res.json(await orders.giftOptions(req.user.id, req.query.packId)); } catch (error) { sendRouteError(res, error, 'Could not open your accepted friends'); } });
router.get('/orders', async (req, res) => { try { res.json(await orders.purchases(req.user.id)); } catch (error) { sendRouteError(res, error, 'Could not open your purchases'); } });
router.post('/checkout', checkout, async (req, res) => { try { res.json(await orders.createCheckout(req.user.id, req.body)); } catch (error) { if (error.publicCode === 'COSMETIC_CHECKOUT_CLOSED') return res.status(409).json({ msg: error.message, code: error.publicCode }); sendRouteError(res, error, 'Could not confirm checkout. Your purchase remains recoverable.'); } });
for (const [action, operation] of [['resume', orders.resumeCheckout], ['verify', orders.verifyOrder], ['cancel', orders.cancelCheckout], ['seen', orders.acknowledgeReceipt]]) router.post(`/orders/:id/${action}`, checkout, async (req, res) => {
  try { if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length) return res.status(400).json({ msg: 'Purchase details come from your saved order' }); res.json(await operation(req.user.id, req.params.id)); }
  catch (error) { sendRouteError(res, error, 'Could not confirm your purchase. Please try again.'); }
});
module.exports = router;
