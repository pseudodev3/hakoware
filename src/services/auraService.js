import { api } from './api';

export const getUserAura = async () => {
  try {
    const res = await api.get('/aura/me');
    return {
      balance: res.balance || 0,
      totalEarned: res.totalEarned || 0,
      totalSpent: res.totalSpent || 0,
      totalTransactions: res.totalTransactions || 0,
      history: res.history || []
    };
  } catch (error) {
    console.error('Error getting Aura:', error);
    return { balance: 0, totalEarned: 0, totalSpent: 0, totalTransactions: 0, history: [] };
  }
};

export const getAuraCards = async () => {
  try {
    return await api.get('/aura/cards');
  } catch (error) {
    console.error('Error loading Aura cards:', error);
    return [];
  }
};

export const buyAuraCard = (cardId) => api.post('/aura/buy-card', { cardId });
export const useAuraCard = (cardId, targetFriendshipId = null) => api.post('/aura/use-card', { cardId, targetFriendshipId });
