import { api } from '../lib/api';
import { invalidateResource } from '../lib/resourceCache';
import { RESOURCE_KEYS } from './bootstrapService';
export const getAuraBank = () => api.get('/aura/bank');
export const changeAuraBank = async (action, amount, clientId) => {
  const result = await api.post(`/aura/bank/${action}`, { amount, clientId });
  [RESOURCE_KEYS.aura, RESOURCE_KEYS.you, RESOURCE_KEYS.bootstrap, RESOURCE_KEYS.user].forEach(invalidateResource);
  return result;
};
