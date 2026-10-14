const express = require('express');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const { listDuels, getDuel, mutateDuel, markDuelSeen } = require('../services/duels');
const router = express.Router();
router.use(auth);
const moves = createRateLimiter({ name: 'duel-moves', windowMs: 600000, max: 120, keyGenerator: req => req.user.id });
const invites = createRateLimiter({ name: 'duel-invites', windowMs: 600000, max: 10, keyGenerator: req => req.user.id, message: 'Give your invitations a moment. Try again shortly.' });
const run = action => async (req, res) => {
  try { res.json(await action(req)); }
  catch (error) { if (!error.status) console.error('Duel request failed:', error.message); sendRouteError(res, error, 'Could not load or update your duel. Try again.'); }
};
router.get('/', run(req => listDuels(req.user.id)));
router.get('/:id', run(req => getDuel(req.user.id, req.params.id)));
router.post('/:id/seen', run(req => markDuelSeen(req.user.id, req.params.id, req.body)));
router.post('/:id/invite', invites, run(req => mutateDuel(req.user.id, req.params.id, 'INVITE', req.body)));
router.post('/:id/respond', moves, run(req => {
  const action = String(req.body?.action || '').toUpperCase();
  if (!['ACCEPT', 'DECLINE', 'CANCEL', 'ABANDON'].includes(action)) throw Object.assign(new Error('Choose a valid invitation or round action.'), { status: 400 });
  return mutateDuel(req.user.id, req.params.id, action, req.body);
}));
router.post('/:id/play', moves, run(req => mutateDuel(req.user.id, req.params.id, 'PLAY', req.body)));
module.exports = router;
