import { api } from '../lib/api';
import { invalidateResource } from '../lib/resourceCache';
import { RESOURCE_KEYS } from './bootstrapService';
import { invalidateYouSnapshot } from './prefetchService';
export const getCardCollection = () => api.get('/cards');
const changed = (result) => {
  [
    RESOURCE_KEYS.bootstrap,
    RESOURCE_KEYS.notifications,
    RESOURCE_KEYS.aura,
  ].forEach(invalidateResource);
  invalidateYouSnapshot();
  window.dispatchEvent(new Event('hakoware-notifications-read'));
  return result;
};
export const purchaseCollectionCard = async (cardId, clientId) =>
  changed(await api.post('/aura/buy-card', { cardId, clientId }));
export const createCardOffer = async (body) =>
  changed(await api.post('/cards/trades', body));
export const respondToCardOffer = async (id, action) =>
  changed(await api.post(`/cards/trades/${id}/respond`, { action }));
export const activateCollectionCard = async (cardId, targetFriendshipId) =>
  changed(await api.post('/aura/use-card', { cardId, targetFriendshipId }));
