const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();

// Keep the old endpoint explicit for saved links and clients with cached UI.
// Retirement does not read, rewrite or delete existing walls or owned cards.
router.use(auth);
router.use((_req, res) => res.status(410).json({
  msg: 'The weekly wall has been retired. Your owned cards remain in your collection.',
  code: 'WALL_RETIRED',
}));

module.exports = router;
