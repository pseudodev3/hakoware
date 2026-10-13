import { api } from '../lib/api';

export const setPlusInterest = (interested = true) => api.post('/growth/plus-interest', { interested });
export const getGrowthMetrics = () => api.get('/growth/metrics');
export const trackShopEvent = (type, packId = null) => api.post('/growth/shop', { type, packId }).catch(() => null);
