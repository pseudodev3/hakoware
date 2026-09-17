import { api } from './api';

export const NOTIFICATION_TYPES = {
  LIMIT_CHANGED: 'LIMIT_CHANGED',
  VOICE_NOTE: 'VOICE_NOTE',
  CONTRACT_ACCEPTED: 'CONTRACT_ACCEPTED',
  CONTRACT_DECLINED: 'CONTRACT_DECLINED',
  CONTRACT_ENDED: 'CONTRACT_ENDED',
  CHECKIN: 'CHECKIN',
  BOUNTY_PLACED: 'BOUNTY_PLACED',
  BOUNTY_HUNTING: 'BOUNTY_HUNTING',
  BOUNTY_REWARD: 'BOUNTY_REWARD',
  BOUNTY_REFUND: 'BOUNTY_REFUND'
};

export const getUserNotifications = async () => {
  try {
    return await api.get('/notifications');
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    return await api.put(`/notifications/${notificationId}/read`);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

export const markAllNotificationsAsRead = async () => {
  try {
    return await api.put('/notifications/read-all');
  } catch (error) {
    console.error('Error marking all as read:', error);
    return { success: false, error: error.message };
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    return await api.delete(`/notifications/${notificationId}`);
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};
