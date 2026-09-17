import { api } from '../lib/api';

export const createBounty = async (bountyData) => {
  try {
    return await api.post('/bounties', bountyData);
  } catch (error) {
    console.error('Error creating bounty:', error);
    return { success: false, error: error.message };
  }
};
