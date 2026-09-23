import { api } from '../lib/api';
import { fetchResource, invalidateResource, peekResource } from '../lib/resourceCache';

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
const contractBountyKey = (friendshipId) => `contract:bounty:${friendshipId}`;

export const getContractBounty = (friendshipId, { force = false } = {}) => fetchResource(
  contractBountyKey(friendshipId),
  () => api.get(`/bounties/contract/${friendshipId}`),
  { ttl: 12000, force }
);

export const peekContractBounty = (friendshipId) => peekResource(contractBountyKey(friendshipId));
export const invalidateContractBounty = (friendshipId) => invalidateResource(contractBountyKey(friendshipId));
export const huntBounty = (bountyId) => api.post(`/bounties/${bountyId}/hunt`);
export const sendBountyPressure = (bountyId, moveId) => api.post(`/bounties/${bountyId}/pressure`, { moveId });
