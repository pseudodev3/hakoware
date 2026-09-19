const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const { notificationView } = require('../services/clientViews');

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ toUserId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('_id type title message read createdAt')
      .lean();
    return res.json(notifications.map(notificationView));
  } catch (err) {
    console.error('Load notifications failed:', err.message);
    return res.status(500).json({ msg: 'Could not load notifications' });
  }
});

router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { toUserId: req.user.id, read: false },
      { $set: { read: true } }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Mark all notifications failed:', err.message);
    return res.status(500).json({ msg: 'Could not update notifications' });
  }
});

router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ msg: 'Notification not found' });
    if (notification.toUserId.toString() !== req.user.id) return res.status(403).json({ msg: 'Not authorized' });

    notification.read = true;
    await notification.save();
    return res.json(notificationView(notification));
  } catch (err) {
    console.error('Mark notification failed:', err.message);
    return res.status(500).json({ msg: 'Could not update notification' });
  }
});

router.delete('/clear-all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ toUserId: req.user.id });
    return res.json({ success: true });
  } catch (err) {
    console.error('Clear notifications failed:', err.message);
    return res.status(500).json({ msg: 'Could not clear notifications' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ msg: 'Notification not found' });
    if (notification.toUserId.toString() !== req.user.id) return res.status(403).json({ msg: 'Not authorized' });

    await notification.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete notification failed:', err.message);
    return res.status(500).json({ msg: 'Could not delete notification' });
  }
});

module.exports = router;
