import { api } from '../lib/api';
import { invalidateContractBounty } from './bountyService';

export const sendFriendInvitation = async (friendIdentifier, limit, templateId = 'DONT_GHOST') => {
  try {
    const response = await api.post('/friendships', { friendIdentifier, limit, templateId });
    if (response?.inviteReady || response?.requiresSignup) {
      return {
        success: true,
        inviteReady: true,
        inviteUrl: response.inviteUrl,
        recipientEmail: response.recipientEmail || null,
        recipientUsername: response.recipientUsername || null,
        recipientLabel: response.recipientLabel || response.recipientEmail || null,
        requiresSignup: Boolean(response.requiresSignup),
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

export const performCheckin = async (friendshipId, source = 'TEXT', bountyCreditId = null, bountyDecision = null, voiceNoteId = null, social = {}) => {
  try {
    const response = await api.post(`/friendships/${friendshipId}/checkin`, {
      source,
      bountyCreditId,
      bountyDecision,
      voiceNoteId,
      checkinStatus: social.checkinStatus || null,
      note: social.note || null
    });
    invalidateContractBounty(friendshipId);
    return {
      success: true,
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
    await api.put(`/friendships/${friendshipId}/respond`, { action: action.toUpperCase() });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


export const getSocialPresence = async (since) => {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return api.get(`/friendships/social${query}`);
};

export const reactToLatestCheckin = async (friendshipId, reaction) => {
  try {
    const response = await api.post(`/friendships/${friendshipId}/react-checkin`, { reaction });
    return { success: true, ...response };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const pokeContract = async (friendshipId) => {
  try {
    const response = await api.post(`/friendships/${friendshipId}/poke`);
    return { success: true, ...response };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


export const replyToLatestCheckin = async (friendshipId, text) => {
  try {
    const response = await api.post(`/friendships/${friendshipId}/reply-checkin`, { text });
    return { success: true, ...response };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


export const respondToContractMoment = async (friendshipId, momentId, value) => {
  try {
    const response = await api.post(`/friendships/${friendshipId}/moments/${momentId}/respond`, { value });
    return { success: true, ...response };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
