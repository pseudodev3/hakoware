const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { TEMPLATES, getWorldEvent } = require('../services/contractGame');
const { loadContractsForUser } = require('../services/contractQueries');
const { buildAuraSummary } = require('../services/auraSummary');

router.get('/', auth, async (req, res) => {
  try {
    const [contracts, aura] = await Promise.all([
      loadContractsForUser(req.user.id),
      buildAuraSummary(req.user.id)
    ]);

    const [user, notifications] = await Promise.all([
      User.findById(req.user.id)
        .select('-password -resetPasswordToken -resetPasswordExpire -welcomeAuraGranted -lastDailyAuraBonusKey -authVersion')
        .lean(),
      Notification.find({ toUserId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
    ]);

    if (!user || !aura) return res.status(404).json({ msg: 'User not found' });

    const visibleNotifications = notifications.filter(
      (notification) => notification.type !== 'CONTRACT_INVITE'
    );

    return res.json({
      generatedAt: new Date(),
      user,
      contracts,
      meta: {
        templates: Object.values(TEMPLATES),
        worldEvent: getWorldEvent()
      },
      aura,
      notifications: {
        items: visibleNotifications,
        unreadCount: visibleNotifications.filter((notification) => !notification.read).length
      }
    });
  } catch (error) {
    console.error('Bootstrap failed:', error.message);
    return res.status(500).json({ msg: 'Could not start Hakoware' });
  }
});

module.exports = router;
