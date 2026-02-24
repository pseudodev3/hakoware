import { api } from './api';

/**
 * Call a backend function for debt calculation
 */
export const calculateFriendshipDebt = async (friendshipId) => {
  try {
    return await api.post(`/friendships/${friendshipId}/calculate-debt`);
  } catch (error) {
    console.error('Error calculating friendship debt:', error);
    throw error;
  }
};

/**
 * Award aura points for a specific action
 */
export const awardAuraPoints = async (userId, type, metadata = {}) => {
  try {
    return await api.post('/aura/award', { type, metadata });
  } catch (error) {
    console.error('Error awarding aura points:', error);
    throw error;
  }
};

/**
 * Trigger bankruptcy process for a user in a friendship
 */
export const triggerBankruptcy = async (friendshipId, userId) => {
  try {
    return await api.post(`/bankruptcy/declare`, { friendshipId, userId });
  } catch (error) {
    console.error('Error triggering bankruptcy:', error);
    throw error;
  }
};

/**
 * Send a notification through the backend
 */
export const sendAppNotification = async (notificationData) => {
  try {
    return await api.post('/notifications', notificationData);
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

export default {
  calculateFriendshipDebt,
  awardAuraPoints,
  triggerBankruptcy,
  sendAppNotification
};
