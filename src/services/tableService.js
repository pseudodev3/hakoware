import { api } from '../lib/api';
import { invalidateResource } from '../lib/resourceCache';
import { RESOURCE_KEYS } from './bootstrapService';

export const getTables = () => api.get('/duels/tables');
export const getTable = code => api.get(`/duels/tables/${encodeURIComponent(code)}`);
export const markTableSeen = async view => {
  if (!view.matchId) return;
  await api.post(`/duels/tables/${view.id}/seen`, { matchId: view.matchId, revision: view.revision });
  invalidateResource(RESOURCE_KEYS.notifications);
  window.dispatchEvent(new Event('hakoware-notifications-read'));
};
const post = async (userId, path, payload) => {
  const storageKey = `hakoware:table-pending:${userId}`, signature = JSON.stringify([path, payload]);
  let stored;
  try { stored = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* Storage is optional. */ }
  const clientId = stored?.signature === signature ? stored.clientId : crypto.randomUUID();
  try { sessionStorage.setItem(storageKey, JSON.stringify({ signature, clientId })); } catch { /* In-flight retry key still works. */ }
  const clear = () => { try { if (JSON.parse(sessionStorage.getItem(storageKey))?.clientId === clientId) sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ } };
  try {
    const result = await api.post(path, { ...payload, clientId }); clear();
    [RESOURCE_KEYS.aura, RESOURCE_KEYS.you, RESOURCE_KEYS.user, RESOURCE_KEYS.notifications].forEach(invalidateResource);
    window.dispatchEvent(new Event('hakoware-duels-refresh'));
    return result;
  } catch (error) { if (error.status >= 400 && error.status < 500) clear(); throw error; }
};
export const createTable = userId => post(userId, '/duels/tables', {});
export const joinTable = (userId, code) => post(userId, `/duels/tables/${encodeURIComponent(code)}/action`, { action: 'JOIN' });
export const tableAction = (userId, view, action, values = {}) => post(userId, `/duels/tables/${view.id}/action`, { action, revision: view.revision, matchId: view.matchId, ...values });
