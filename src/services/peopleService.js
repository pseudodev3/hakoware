import { api } from '../lib/api';
import { invalidateResource } from '../lib/resourceCache';
import { RESOURCE_KEYS } from './bootstrapService';
const pendingInMemory = new Map();

export const people = {
  profile: () => api.get('/people/profile'),
  saveProfile: profile => api.put('/people/profile', profile),
  discover: filters => api.get(`/people/discover?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`),
  person: username => api.get(`/people/${encodeURIComponent(username)}`),
  prepareDuel: username => api.post(`/people/${encodeURIComponent(username)}/duel`, {}),
  connections: () => api.get('/people/connections'),
  chat: (id, before) => api.get(`/people/connections/${id}/messages${before ? `?before=${before}` : ''}`),
  report: (username, reason, note) => api.post(`/people/${encodeURIComponent(username)}/report`, { reason, note }),
};
export const refreshConnections = () => {
  invalidateResource(RESOURCE_KEYS.notifications);
  window.dispatchEvent(new Event('hakoware-notifications-read'));
  window.dispatchEvent(new Event('hakoware-people-refresh'));
};
export const seeConnection = async connection => {
  await api.post(`/people/connections/${connection.id}/seen`, { revision: connection.revision });
  refreshConnections();
};
export const connectionAction = async (userId, connection, action, values = {}) => {
  const username = connection.partner.username;
  const endpoint = action === 'REQUEST' ? `/people/${encodeURIComponent(username)}/connect` : action === 'BLOCK' && !connection.id ? `/people/${encodeURIComponent(username)}/block` : `/people/connections/${connection.id}/action`;
  const storageKey = `hakoware:connection-pending:${userId}:${connection.id || username}:${action}`;
  const intent = JSON.stringify([action, values]);
  let saved = pendingInMemory.get(storageKey);
  try { saved = JSON.parse(sessionStorage.getItem(storageKey)) || saved; } catch { /* Keep the in-memory retry when storage is full or denied. */ }
  const payload = saved?.intent === intent ? saved.payload : { action, ...values, revision: connection.revision || 0, clientId: crypto.randomUUID() };
  pendingInMemory.set(storageKey, { intent, payload });
  try { sessionStorage.setItem(storageKey, JSON.stringify({ intent, payload })); } catch { /* In-flight key remains stable. */ }
  const clear = () => {
    if (pendingInMemory.get(storageKey)?.payload.clientId === payload.clientId) pendingInMemory.delete(storageKey);
    try { if (JSON.parse(sessionStorage.getItem(storageKey))?.payload.clientId === payload.clientId) sessionStorage.removeItem(storageKey); } catch { /* No stored request. */ }
  };
  try { const result = await api.post(endpoint, payload); clear(); refreshConnections(); return result.connection; }
  catch (error) { if (error.status >= 400 && error.status < 500) clear(); throw error; }
};
