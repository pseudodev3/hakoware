import { api } from '../lib/api';
export const getStyleShop = () => api.get('/cosmetics');
export const saveStyleCollection = (id, saved) => api.put(`/cosmetics/saved/${id}`, { saved });
