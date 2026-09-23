import { api } from '../lib/api';
import { fetchResource, invalidateResource, peekResource } from '../lib/resourceCache';
import { RESOURCE_KEYS } from './bootstrapService';

export const NOTIFICATION_TYPES = {
  LIMIT_CHANGED: 'LIMIT_CHANGED',
  VOICE_NOTE: 'VOICE_NOTE',
  CONTRACT_ACCEPTED: 'CONTRACT_ACCEPTED',
  CONTRACT_DECLINED: 'CONTRACT_DECLINED',
  CONTRACT_ENDED: 'CONTRACT_ENDED',
  CHECKIN: 'CHECKIN',
  CHECKIN_REACTION: 'CHECKIN_REACTION',
  POKE: 'POKE',
  BOUNTY_PLACED: 'BOUNTY_PLACED',
  BOUNTY_HUNTING: 'BOUNTY_HUNTING',
  BOUNTY_PRESSURE: 'BOUNTY_PRESSURE',
  BOUNTY_REWARD: 'BOUNTY_REWARD',
  BOUNTY_REFUND: 'BOUNTY_REFUND',
  GAME_EVENT: 'GAME_EVENT',
  CHAOS_EVENT: 'CHAOS_EVENT',
  CHAOS_FAILED: 'CHAOS_FAILED',
  CHAOS_SURVIVED: 'CHAOS_SURVIVED',
  DUO_LEVEL_UP: 'DUO_LEVEL_UP',
  SEASON_STARTED: 'SEASON_STARTED',
  SEASON_COMPLETED: 'SEASON_COMPLETED'
};

export const getUserNotifications = async ({ force = false } = {}) => {
  try {
    return await fetchResource(
      RESOURCE_KEYS.notifications,
      () => api.get('/notifications'),
      { ttl: 15000, force }
    );
  } catch (error) {
    console.error('Error getting notifications:', error);
    return peekResource(RESOURCE_KEYS.notifications) || [];
  }
};

export const peekUserNotifications = () => peekResource(RESOURCE_KEYS.notifications) || [];

const invalidateNotifications = () => {
  invalidateResource(RESOURCE_KEYS.notifications);
  invalidateResource(RESOURCE_KEYS.bootstrap);
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const result = await api.put(`/notifications/${notificationId}/read`);
    invalidateNotifications();
    return result;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

export const markAllNotificationsAsRead = async () => {
  try {
    const result = await api.put('/notifications/read-all');
    invalidateNotifications();
    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    const result = await api.delete(`/notifications/${notificationId}`);
    invalidateNotifications();
    return result;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};
