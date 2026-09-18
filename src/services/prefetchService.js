import { api } from '../lib/api';
import { fetchResource, invalidateResource, peekResource } from '../lib/resourceCache';
import { getBountyMeta, getHunterProfile } from './bountyService';
import { getAuraCards, getMyGrudges, getPublicGrudges, getUserAura } from './auraService';
import { RESOURCE_KEYS } from './bootstrapService';

export const getArenaSnapshot = ({ force = false } = {}) => fetchResource(
  RESOURCE_KEYS.arena,
  async () => {
    const [bounties, shame, hunterProfile, meta, grudges] = await Promise.all([
      api.get('/bounties/active'),
      api.get('/users/leaderboard'),
      getHunterProfile(),
      getBountyMeta(),
      getPublicGrudges()
    ]);

    return {
      bounties: bounties || [],
      shame: shame || [],
      hunterProfile: hunterProfile || {},
      meta: meta || { pressureMoves: [], huntWindowHours: 12 },
      grudges: grudges || []
    };
  },
  { ttl: 20000, force }
);

export const peekArenaSnapshot = () => peekResource(RESOURCE_KEYS.arena);
export const invalidateArenaSnapshot = () => invalidateResource(RESOURCE_KEYS.arena);

export const getYouSnapshot = ({ force = false } = {}) => fetchResource(
  RESOURCE_KEYS.you,
  async () => {
    const [aura, cards, grudges] = await Promise.all([
      getUserAura({ force }),
      getAuraCards(),
      getMyGrudges()
    ]);

    return {
      aura,
      cards: cards || [],
      grudges: grudges || []
    };
  },
  { ttl: 30000, force }
);

export const peekYouSnapshot = () => peekResource(RESOURCE_KEYS.you);
export const invalidateYouSnapshot = () => invalidateResource(RESOURCE_KEYS.you);

export const prefetchWarmTabs = () => {
  const run = () => {
    void Promise.allSettled([
      getArenaSnapshot(),
      getYouSnapshot()
    ]);
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 1200 });
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(run, 250);
  return () => window.clearTimeout(id);
};
