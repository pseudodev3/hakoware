import { api } from '../lib/api';

export const sendFriendInvitation = async (toEmail, limit, templateId = 'DONT_GHOST') => {
  try {
    const response = await api.post('/friendships', { friendEmail: toEmail, limit, templateId });
    if (response?.inviteReady || response?.requiresSignup) {
      return {
        success: true,
        inviteReady: true,
        inviteUrl: response.inviteUrl,
        recipientEmail: response.recipientEmail,
        templateId: response.templateId,
        expiresAt: response.expiresAt
      };
    }
    return { success: true, friendship: response };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getUserFriendships = async () => api.get('/friendships');
export const getContractMeta = async () => api.get('/friendships/meta');
export const getContractRecap = async (friendshipId) => api.get(`/friendships/${friendshipId}/recap`);
export const runContractBack = async (friendshipId) => api.post(`/friendships/${friendshipId}/run-it-back`);

export const performCheckin = async (friendshipId, source = 'TEXT', bountyCreditId = null, bountyDecision = null, voiceNoteId = null) => {
  try {
    const response = await api.post(`/friendships/${friendshipId}/checkin`, {
      source,
      bountyCreditId,
      bountyDecision,
      voiceNoteId
    });
    return {
      success: true,
      friendship: response.friendship || response,
      game: response.game || null,
      bounty: response.bounty || null,
      recovery: response.recovery || null
    };
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
