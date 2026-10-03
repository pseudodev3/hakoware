const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const {
  wallView,
  addPiece,
  changePiece,
  reactToPiece,
} = require('../services/roomWall');
const router = express.Router();
router.use(auth);
const limiter = createRateLimiter({
  name: 'room-wall',
  windowMs: 600000,
  max: 60,
  keyGenerator: (req) => req.user.id,
  message: 'Give the wall a moment. Try again shortly.',
});
const withActor = (operation) => async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      '_id displayName username avatar inventory isTestAccount testOwnerId',
    );
    if (!user) return res.status(404).json({ msg: 'Account not found' });
    const result = operation ? await operation(req, user) : null;
    return res.json({
      ...(await wallView(user, operation ? null : req.query.week)),
      ...(result?.pieceId ? { pieceId: result.pieceId } : {}),
    });
  } catch (error) {
    return sendRouteError(res, error, 'Could not update the wall');
  }
};
router.get('/', withActor(null));
router.post(
  '/',
  limiter,
  withActor((req, user) => addPiece(user, req.body)),
);
router.patch(
  '/:id',
  limiter,
  withActor((req, user) => changePiece(user, req.params.id, req.body)),
);
router.delete(
  '/:id',
  limiter,
  withActor((req, user) => changePiece(user, req.params.id, {}, true)),
);
router.post(
  '/:id/react',
  limiter,
  withActor((req, user) =>
    reactToPiece(user, req.params.id, req.body.reaction),
  ),
);
module.exports = router;
