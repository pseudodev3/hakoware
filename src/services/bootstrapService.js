import { api } from '../lib/api';
import { fetchResource, invalidateResource, peekResource, seedResource } from '../lib/resourceCache';

export const RESOURCE_KEYS = Object.freeze({
  bootstrap: 'app:bootstrap',
  user: 'app:user',
  contracts: 'app:contracts',
  contractMeta: 'app:contract-meta',
  aura: 'app:aura',
  notifications: 'app:notifications',
  arena: 'tab:arena',
  you: 'tab:you'
});

export const seedBootstrap = (payload) => {
  if (!payload) return payload;

  seedResource(RESOURCE_KEYS.bootstrap, payload);
  seedResource(RESOURCE_KEYS.user, payload.user);
  seedResource(RESOURCE_KEYS.contracts, payload.contracts);
  seedResource(RESOURCE_KEYS.contractMeta, payload.meta);
  seedResource(RESOURCE_KEYS.aura, payload.aura);
  seedResource(RESOURCE_KEYS.notifications, payload.notifications?.items || []);
  return payload;
};

export const peekBootstrap = () => peekResource(RESOURCE_KEYS.bootstrap);

export const getBootstrap = async ({ force = false } = {}) => {
  const payload = await fetchResource(
    RESOURCE_KEYS.bootstrap,
    () => api.get('/bootstrap'),
    { ttl: 15000, force }
  );
  return seedBootstrap(payload);
};

export const invalidateBootstrap = () => {
  invalidateResource(RESOURCE_KEYS.bootstrap);
  invalidateResource(RESOURCE_KEYS.user);
  invalidateResource(RESOURCE_KEYS.contracts);
  invalidateResource(RESOURCE_KEYS.contractMeta);
  invalidateResource(RESOURCE_KEYS.aura);
  invalidateResource(RESOURCE_KEYS.notifications);
};
