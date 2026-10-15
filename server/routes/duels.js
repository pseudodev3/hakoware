const express = require('express');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const { listDuels, getDuel, mutateDuel, markDuelSeen } = require('../services/duels');
const { getOpenTable, enterOpenTable, leaveOpenTable } = require('../services/openTables');
const router = express.Router();
const Connection = require('../models/SocialConnection');
const tables = require('../services/groupTables');
const gameStyles = require('../services/gameStyles');
const { rewardView } = require('../services/gameRewards');
router.use(auth);
const moves = createRateLimiter({ name: 'duel-moves', windowMs: 600000, max: 120, keyGenerator: req => req.user.id });
const invites = createRateLimiter({ name: 'duel-invites', windowMs: 600000, max: 10, keyGenerator: req => req.user.id, message: 'Give your invitations a moment. Try again shortly.' });
const casualInvites = createRateLimiter({ name: 'casual-duel-invites', windowMs: 3600000, max: 5, keyGenerator: req => req.user.id });
const openTables = createRateLimiter({ name: 'open-tables', windowMs: 600000, max: 30, keyGenerator: req => req.user.id });
const limitCasual = async (req, res, next) => {
  try { if (/^[a-f0-9]{24}$/i.test(req.params.id) && await Connection.exists({ _id: req.params.id })) return casualInvites(req, res, next); next(); }
  catch (error) { next(error); }
};
const run = action => async (req, res) => {
  try { res.json(await action(req)); }
  catch (error) { if (!error.status) console.error('Duel request failed:', error.message); sendRouteError(res, error, 'Could not load or update your duel. Try again.'); }
};
router.get('/', run(req => listDuels(req.user.id)));
router.get('/styles', run(req => gameStyles.styleView(req.user.id)));
router.patch('/styles', moves, run(req => gameStyles.chooseBack(req.user.id, req.body)));
router.get('/rewards', run(req => rewardView(req.user.id)));
router.get('/tables', run(req => tables.listTables(req.user.id)));
router.post('/tables', invites, run(req => tables.createTable(req.user.id, req.body)));
router.get('/tables/:code', run(req => tables.getTable(req.user.id, req.params.code)));
router.post('/tables/:code/seen', run(req => tables.seenTable(req.user.id, req.params.code, req.body)));
router.post('/tables/:code/action', moves, run(req => tables.mutateTable(req.user.id, req.params.code, req.body?.action, req.body)));
router.get('/open-table', run(req => getOpenTable(req.user.id, req.query.ticket)));
router.post('/open-table/enter', openTables, run(req => enterOpenTable(req.user.id, req.body)));
router.post('/open-table/leave', moves, run(req => leaveOpenTable(req.user.id, req.body)));
router.get('/:id', run(req => getDuel(req.user.id, req.params.id)));
router.post('/:id/seen', run(req => markDuelSeen(req.user.id, req.params.id, req.body)));
router.post('/:id/invite', invites, limitCasual, run(req => mutateDuel(req.user.id, req.params.id, 'INVITE', req.body)));
router.post('/:id/respond', moves, run(req => {
  const action = String(req.body?.action || '').toUpperCase();
  if (!['ACCEPT', 'DECLINE', 'CANCEL', 'ABANDON'].includes(action)) throw Object.assign(new Error('Choose a valid invitation or round action.'), { status: 400 });
  return mutateDuel(req.user.id, req.params.id, action, req.body);
}));
router.post('/:id/play', moves, run(req => mutateDuel(req.user.id, req.params.id, 'PLAY', req.body)));
module.exports = router;
