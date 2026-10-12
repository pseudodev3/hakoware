import { api } from '../lib/api';
export const getWorldActivity = ({ before, limit } = {}) => {
  const query = new URLSearchParams(); if (before) query.set('before', before); if (limit) query.set('limit', limit);
  return api.get(`/world-activity${query.size ? '?' + query : ''}`);
};
export const markWorldActivityRead = eventIds => api.post('/world-activity/read', { eventIds });
