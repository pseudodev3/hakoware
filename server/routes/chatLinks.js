const express = require('express');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const { createChatLinkPreviews } = require('../services/chatLinkPreviews');

module.exports = (service = createChatLinkPreviews()) => {
  const router = express.Router(); router.use(auth);
  router.use(createRateLimiter({ name: 'chat-links', windowMs: 600000, max: 180, keyGenerator: req => req.user.id }));
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.post('/preview', async (req, res) => {
    try { res.json(await service.preview(req.user.id, req.body)); }
    catch (error) { sendRouteError(res, error, 'Preview unavailable.'); }
  });
  router.post('/image', async (req, res) => {
    try {
      const image = await service.image(req.user.id, req.body);
      res.set({ 'Content-Type': image.contentType, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' });
      res.send(image.body);
    } catch (error) { sendRouteError(res, error, 'Preview image unavailable.'); }
  });
  return router;
};
