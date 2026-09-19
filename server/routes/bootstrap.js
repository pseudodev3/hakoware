const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { TEMPLATES, getWorldEvent } = require('../services/contractGame');
const { loadContractsForUser } = require('../services/contractQueries');
const { buildAuraSummary } = require('../services/auraSummary');
const { currentUserView, notificationView } = require('../services/clientViews');

router.get('/', auth, async (req, res) => {
  try {
    const [contracts, aura] = await Promise.all([
      loadContractsForUser(req.user.id),
      buildAuraSummary(req.user.id)
    ]);

    const [user, notifications] = await Promise.all([
      User.findById(req.user.id)
        .select('_id displayName username email avatar inventory auraBalance plusInterestAt isTestAccount privacySettings')
        .lean(),
      Notification.find({ toUserId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('_id type title message read createdAt')
        .lean()
    ]);

    if (!user || !aura) return res.status(404).json({ msg: 'User not found' });

    const visibleNotifications = notifications
      .filter((notification) => notification.type !== 'CONTRACT_INVITE')
      .map(notificationView);

    return res.json({
      generatedAt: new Date(),
      user: currentUserView(user),
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
