import { api } from './api';

export const sendFriendInvitation = async (toEmail, limit) => {
  try {
    const response = await api.post('/friendships', { friendEmail: toEmail, limit });
    if (response?.requiresSignup) {
      return {
        success: true,
        requiresSignup: true,
        inviteUrl: response.inviteUrl,
        recipientEmail: response.recipientEmail,
        expiresAt: response.expiresAt
      };
    }
    return { success: true, friendship: response };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getUserFriendships = async () => api.get('/friendships');

export const performCheckin = async (friendshipId) => {
  try {
    const friendship = await api.post(`/friendships/${friendshipId}/checkin`);
    return { success: true, friendship };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const respondToInvitation = async (friendshipId, action) => {
  try {
    const friendship = await api.put(`/friendships/${friendshipId}/respond`, { action: action.toUpperCase() });
    return { success: true, friendship };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
