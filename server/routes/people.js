const express = require('express');
const auth = require('../middleware/auth');
const founder = require('../middleware/founder');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const people = require('../services/people');
const Report = require('../models/CommunityReport');
const router = express.Router();
router.use(auth);
const invitations = createRateLimiter({ name: 'people-invites', windowMs: 3600000, max: 5, keyGenerator: req => req.user.id });
const edits = createRateLimiter({ name: 'people-edits', windowMs: 600000, max: 30, keyGenerator: req => req.user.id });
const chat = createRateLimiter({ name: 'connection-chat', windowMs: 600000, max: 80, keyGenerator: req => req.user.id });
const run = action => async (req, res) => {
  try { res.json(await action(req)); }
  catch (error) { if (!error.status) console.error('People request failed:', error.message); sendRouteError(res, error, 'Could not update this space. Please try again.'); }
};
router.get('/profile', run(req => people.getProfile(req.user.id)));
router.put('/profile', edits, run(req => people.saveProfile(req.user.id, req.body)));
router.get('/discover', run(req => people.discover(req.user.id, req.query)));
router.get('/connections', run(req => people.listConnections(req.user.id)));
router.get('/blocked', run(req => people.listBlocked(req.user.id)));
router.get('/connections/:id/messages', run(req => people.getChat(req.user.id, req.params.id, req.query.before)));
router.post('/connections/:id/seen', run(req => people.seen(req.user.id, req.params.id, req.body?.revision)));
router.post('/connections/:id/action', chat, run(req => {
  if (!['ACCEPT', 'DECLINE', 'CANCEL', 'BLOCK', 'UNBLOCK', 'MESSAGE'].includes(req.body?.action)) throw Object.assign(new Error('Choose a valid connection action.'), { status: 400 });
  return people.mutate(req.user.id, req.params.id, req.body.action, req.body);
}));
router.get('/reports', founder, run(() => Report.find({ status: 'OPEN', isTestReport: { $ne: true } }).sort({ createdAt: -1 }).limit(50).populate('reporterId targetId', 'displayName username').lean()));
router.post('/reports/:id/review', founder, run(async req => { const result = await Report.updateOne({ _id: req.params.id, status: 'OPEN' }, { $set: { status: 'REVIEWED' } }); return { success: result.matchedCount === 1 }; }));
router.get('/:username', run(req => people.getPerson(req.user.id, req.params.username)));
router.post('/:username/duel', invitations, run(req => people.prepareDuel(req.user.id, req.params.username)));
router.post('/:username/connect', invitations, run(req => people.requestConnection(req.user.id, req.params.username, req.body)));
router.post('/:username/block', edits, run(req => people.blockPerson(req.user.id, req.params.username, req.body)));
router.post('/:username/report', edits, run(req => people.reportPerson(req.user.id, req.params.username, req.body)));
module.exports = router;
