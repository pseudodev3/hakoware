const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPriorityNotificationEmail } = require('./emailService');

const HIGH_PRIORITY_TYPES = new Set([
  'CHAOS_EVENT',
  'CHAOS_FAILED',
  'BANKRUPTCY',
  'BOUNTY_PLACED',
  'BOUNTY_HUNTING',
  'BOUNTY_PRESSURE',
  'SIGNAL_FLARE',
  'CLAIM_RECEIVED',
  'REVENGE_RECEIVED'
]);

const shouldEmail = (type, explicit) => Boolean(explicit || HIGH_PRIORITY_TYPES.has(String(type || '')));

const sendPriorityEmailFor = async (notification) => {
  if (!notification?.toUserId) return false;

  const user = await User.findById(notification.toUserId)
    .select('email displayName isTestAccount notificationPreferences')
    .lean();

  if (!user?.email || user.isTestAccount) return false;
  if (user.notificationPreferences?.email === false) return false;
  if (notification.type === 'BANKRUPTCY' && user.notificationPreferences?.bankruptcyWarnings === false) return false;

  return sendPriorityNotificationEmail(
    user.email,
    user.displayName,
    notification.title,
    notification.message
  );
};

const createNotification = async (payload, options = {}) => {
  const notification = await Notification.create(payload);

  if (shouldEmail(payload?.type, options.priorityEmail)) {
    void sendPriorityEmailFor(notification).catch((error) => {
      console.error('Priority notification email failed:', error.message);
    });
  }

  return notification;
};

module.exports = {
  HIGH_PRIORITY_TYPES,
  createNotification
};
