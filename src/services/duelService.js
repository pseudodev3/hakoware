import { api } from '../lib/api';
import { invalidateResource } from '../lib/resourceCache';
import { RESOURCE_KEYS } from './bootstrapService';

export const getDuels = () => api.get('/duels');
export const getDuel = id => api.get(`/duels/${encodeURIComponent(id)}`);
export const getOpenTable = ticketId => api.get(`/duels/open-table${ticketId ? `?ticket=${encodeURIComponent(ticketId)}` : ''}`);
export const enterOpenTable = clientId => api.post('/duels/open-table/enter', { clientId });
export const leaveOpenTable = ticketId => api.post('/duels/open-table/leave', { ticketId });
const refreshActivity = () => {
  invalidateResource(RESOURCE_KEYS.notifications);
  window.dispatchEvent(new Event('hakoware-notifications-read'));
  window.dispatchEvent(new Event('hakoware-duels-refresh'));
};
export const markDuelSeen = async view => {
  if (!view.matchId) return;
  await api.post(`/duels/${view.id}/seen`, { matchId: view.matchId, revision: view.revision });
  refreshActivity();
};
export const makeDuelMove = async (userId, view, action, values = {}) => {
  const endpoint = action === 'INVITE' ? 'invite' : action === 'PLAY' ? 'play' : 'respond';
  const payload = { revision: view.revision, ...(action === 'INVITE' ? { previousMatchId: view.matchId } : { matchId: view.matchId }),
    ...(endpoint === 'respond' ? { action } : {}), ...values };
  const signature = JSON.stringify([view.id, endpoint, payload]);
  const storageKey = `hakoware:duel-pending:${userId}`;
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* Storage can be unavailable. */ }
  const clientId = pending?.signature === signature ? pending.clientId : crypto.randomUUID();
  const clearPending = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey));
      if (stored?.clientId === clientId) sessionStorage.removeItem(storageKey);
    } catch { /* No persisted key. */ }
  };
  try { sessionStorage.setItem(storageKey, JSON.stringify({ signature, clientId })); } catch { /* The in-flight request still has its key. */ }
  try {
    const result = await api.post(`/duels/${view.id}/${endpoint}`, { ...payload, clientId });
    clearPending();
    refreshActivity();
    return result;
  } catch (error) {
    if (error.status >= 400 && error.status < 500) {
      clearPending();
    }
    throw error;
  }
};
