import { api } from './api';

/**
 * Create a new bounty
 */
export const createBounty = async (bountyData) => {
  try {
    return await api.post('/bounties', bountyData);
  } catch (error) {
    console.error('Error creating bounty:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all active bounties
 */
export const getActiveBounties = async () => {
  try {
    return await api.get('/bounties/active');
  } catch (error) {
    console.error('Error getting active bounties:', error);
    return [];
  }
};

/**
 * Claim a bounty
 */
export const claimBounty = async (bountyId, claimantId) => {
  try {
    return await api.post(`/bounties/${bountyId}/claim`);
  } catch (error) {
    console.error('Error claiming bounty:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get bounty history for a user
 */
export const getUserBounties = async (userId) => {
  try {
    return await api.get(`/bounties/user/${userId}`);
  } catch (error) {
    console.error('Error getting user bounties:', error);
    return [];
  }
};

/**
 * Get bounty statistics for a user
 */
export const getUserBountyStats = async (userId) => {
  try {
    return await api.get(`/bounties/user/${userId}/stats`);
  } catch (error) {
    console.error('Error getting user bounty stats:', error);
    return { created: 0, claimed: 0, active: 0 };
  }
};
