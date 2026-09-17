import { api } from '../lib/api';

export const createBounty = async (bountyData) => {
  try {
    return await api.post('/bounties', bountyData);
  } catch (error) {
    console.error('Error creating bounty:', error);
    return { success: false, error: error.message };
  }
};

export const getBountyMeta = () => api.get('/bounties/meta');
export const getHunterProfile = () => api.get('/bounties/hunter-profile');
export const getContractBounty = (friendshipId) => api.get(`/bounties/contract/${friendshipId}`);
export const huntBounty = (bountyId) => api.post(`/bounties/${bountyId}/hunt`);
export const sendBountyPressure = (bountyId, moveId) => api.post(`/bounties/${bountyId}/pressure`, { moveId });
