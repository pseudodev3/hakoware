import { api } from './api';

/**
 * Declare bankruptcy for a friendship
 */
export const declareBankruptcy = async (friendshipId, userId, debtAmount) => {
  try {
    return await api.post(`/bankruptcy/declare`, { friendshipId, userId, debtAmount });
  } catch (error) {
    console.error('Error declaring bankruptcy:', error);
    return { success: false, error: error.message };
  }
};

/**
 * File a mercy request
 */
export const fileMercyRequest = async (friendshipId, message) => {
  try {
    return await api.post(`/bankruptcy/mercy-request`, { friendshipId, message });
  } catch (error) {
    console.error('Error filing mercy request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get pending mercy requests for the current user
 */
export const getPendingMercyRequests = async (userId) => {
  try {
    return await api.get('/bankruptcy/mercy-requests/pending');
  } catch (error) {
    console.error('Error getting mercy requests:', error);
    return [];
  }
};

/**
 * Respond to a mercy request
 */
export const respondToMercyRequest = async (requestId, response, condition = '') => {
  try {
    return await api.post(`/bankruptcy/mercy-requests/${requestId}/respond`, { response, condition });
  } catch (error) {
    console.error('Error responding to mercy request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get bankruptcy history for a user
 */
export const getUserBankruptcyHistory = async (userId) => {
  try {
    return await api.get(`/bankruptcy/user/${userId}`);
  } catch (error) {
    console.error('Error getting bankruptcy history:', error);
    return [];
  }
};

/**
 * Get bailout history for a user
 */
export const getUserBailoutHistory = async (userId) => {
  try {
    return await api.get(`/bankruptcy/bailouts/user/${userId}`);
  } catch (error) {
    console.error('Error getting bailout history:', error);
    return [];
  }
};

/**
 * Resolve bankruptcy
 */
export const resolveBankruptcy = async (bankruptcyId) => {
  try {
    return await api.post(`/bankruptcy/${bankruptcyId}/resolve`);
  } catch (error) {
    console.error('Error resolving bankruptcy:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all active bankruptcies for the Shame Wall
 */
export const getActiveBankruptcies = async (limit = 50) => {
  try {
    return await api.get(`/bankruptcy/active?limit=${limit}`);
  } catch (error) {
    console.error('Error getting active bankruptcies:', error);
    return [];
  }
};
