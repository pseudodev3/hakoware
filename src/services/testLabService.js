import { api } from '../lib/api';

export const getFounderLab = () => api.get('/test-lab/status');
export const createTestPlayer = (displayName) => api.post('/test-lab/players', { displayName });
export const createTestContract = (user1Id, user2Id, templateId) => (
  api.post('/test-lab/contracts', { user1Id, user2Id, templateId })
);
export const setTestContractState = (friendshipId, targetUserId, state) => (
  api.patch(`/test-lab/contracts/${friendshipId}/state`, { targetUserId, state })
);
export const completeTestSeason = (friendshipId) => api.post(`/test-lab/contracts/${friendshipId}/season-complete`, {});
export const triggerTestChaos = (friendshipId, targetUserId, type) => (
  api.post(`/test-lab/contracts/${friendshipId}/chaos`, { targetUserId, type })
);
export const setTestAura = (playerId, balance) => api.patch(`/test-lab/players/${playerId}/aura`, { balance });
export const enterTestPlayer = (playerId) => api.post(`/test-lab/players/${playerId}/impersonate`, {});
export const resetFounderLab = () => api.delete('/test-lab/reset');

export const beginTestSession = (token) => {
  const founderToken = localStorage.getItem('hakoware_founder_token') || localStorage.getItem('token');
  if (!founderToken) throw new Error('Founder session is missing');
  localStorage.setItem('hakoware_founder_token', founderToken);
  localStorage.setItem('token', token);
  window.location.assign('/');
};

export const returnToFounderSession = () => {
  const founderToken = localStorage.getItem('hakoware_founder_token');
  if (!founderToken) return false;
  localStorage.setItem('token', founderToken);
  localStorage.removeItem('hakoware_founder_token');
  window.location.assign('/founder');
  return true;
};
