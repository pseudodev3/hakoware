const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// @route    GET api/notifications
// @desc     Get all notifications for current user
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ toUserId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/notifications/:id/read
// @desc     Mark notification as read
// @access   Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    let notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ msg: 'Notification not found' });

    if (notification.toUserId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/notifications/read-all
// @desc     Mark all notifications as read for current user
// @access   Private
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { toUserId: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/notifications/:id
// @desc     Delete notification
// @access   Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ msg: 'Notification not found' });

    if (notification.toUserId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await notification.remove();
    res.json({ msg: 'Notification removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/notifications/clear-all
// @desc     Delete all notifications for current user
// @access   Private
router.delete('/clear-all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ toUserId: req.user.id });
    res.json({ msg: 'All notifications cleared' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
