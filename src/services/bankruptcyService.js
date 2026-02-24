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
 * Resolve bankruptcy (e.g. after a mercy grant or bailout)
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
