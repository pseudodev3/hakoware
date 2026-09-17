import { api } from './api';

export const getUserAura = async () => {
  const res = await api.get('/aura/me');
  return {
    balance: Number(res.balance) || 0,
    totalEarned: Number(res.totalEarned) || 0,
    totalSpent: Number(res.totalSpent) || 0,
    totalTransactions: Number(res.totalTransactions) || 0,
    history: Array.isArray(res.history) ? res.history : []
  };
};

export const getAuraCards = async () => {
  try {
    const cards = await api.get('/aura/cards');
    return Array.isArray(cards) ? cards : [];
  } catch (error) {
    console.error('Error loading Aura cards:', error);
    return [];
  }
};

export const buyAuraCard = (cardId) => api.post('/aura/buy-card', { cardId });
export const useAuraCard = (cardId, targetFriendshipId = null) => api.post('/aura/use-card', { cardId, targetFriendshipId });
