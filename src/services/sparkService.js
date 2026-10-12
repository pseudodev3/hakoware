import { api, API_BASE_URL } from '../lib/api';
export const getSparks = ({ before, limit } = {}) => {
  const query = new URLSearchParams();
  if (before) query.set('before', before);
  if (limit) query.set('limit', limit);
  return api.get(`/sparks${query.size ? '?' + query : ''}`);
};
export const getSpark = (id, { before, reply } = {}) => {
  const query = new URLSearchParams();
  if (before) query.set('before', before);
  if (reply) query.set('reply', reply);
  return api.get(`/sparks/${encodeURIComponent(id)}${query.size ? '?' + query : ''}`);
};
export const createSpark = ({ text, photo, clientId }) => {
  const data = new FormData();
  data.append('text', text); data.append('clientId', clientId);
  if (photo) data.append('photo', photo);
  return api.upload('/sparks', data);
};
export const reactSpark = (id, reaction) => api.put(`/sparks/${encodeURIComponent(id)}/reaction`, { reaction });
export const replySpark = (id, text, clientId) => api.post(`/sparks/${encodeURIComponent(id)}/replies`, { text, clientId });
export const deleteSpark = id => api.delete(`/sparks/${encodeURIComponent(id)}`);
export const getPreviousActivity = id => api.get(`/sparks/legacy/${encodeURIComponent(id)}`);
export const fetchSparkPhoto = async path => {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'x-auth-token': localStorage.getItem('token') || '' } });
  if (!response.ok) throw new Error('This photo is unavailable.');
  return response.blob();
};
