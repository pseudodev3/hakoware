const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const Friendship = require('../models/Friendship');
const { ensureActiveGameState } = require('../services/contractQueries');
const { loadTimeline, sendMessage } = require('../services/contractTimeline');
const { sendRouteError } = require('../services/httpError');
const { createRateLimiter } = require('../middleware/rateLimit');
const messageLimiter = createRateLimiter({ name: 'contract-message', windowMs: 60 * 1000, max: 30, keyGenerator: (req) => req.user?.id || req.ip, message: 'Give your friend a moment. Try again shortly.' });

const activeParticipant = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: 'Contract not found' });
    const friendship = await Friendship.findOne({ _id: req.params.id, status: 'ACTIVE', $or: [{ user1: req.user.id }, { user2: req.user.id }] });
    if (!friendship) return res.status(404).json({ msg: 'Active contract not found' });
    await ensureActiveGameState(friendship);
    req.friendship = friendship;
    return next();
  } catch (error) { return sendRouteError(res, error, 'Could not open this friend space'); }
};
router.get('/:id/timeline', auth, activeParticipant, async (req, res) => {
  try { return res.json(await loadTimeline(req.friendship, req.user.id, req.query)); }
  catch (error) { return sendRouteError(res, error, 'Could not load your conversation'); }
});
router.post('/:id/timeline/read', auth, activeParticipant, async (req, res) => {
  try {
    const ids = req.body.eventIds;
    if (!Array.isArray(ids) || ids.length > 50 || ids.some((value) => !mongoose.isValidObjectId(value))) return res.status(400).json({ msg: 'Choose valid visible updates' });
    await Notification.updateMany({ toUserId: req.user.id, friendshipId: req.friendship._id, type: 'CONTRACT_MESSAGE', read: false, contractEventId: { $in: ids } }, { $set: { read: true } });
    return res.json({ success: true });
  } catch (error) { return sendRouteError(res, error, 'Could not acknowledge these updates'); }
});
router.post('/:id/messages', auth, messageLimiter, activeParticipant, async (req, res) => {
  try { return res.json(await sendMessage(req.friendship, req.user.id, req.body)); }
  catch (error) { return sendRouteError(res, error, 'Could not send this message'); }
});
module.exports = router;
