import { api } from './api';

/**
 * Get user's aura balance and history
 */
export const getUserAura = async (userId) => {
  try {
    const res = await api.get(`/aura/${userId}`);
    if (res.msg) throw new Error(res.msg);
    return {
      balance: res.balance || 0,
      totalEarned: res.totalEarned || 0,
      history: res.history || []
    };
  } catch (error) {
    console.error('Error getting aura:', error);
    return { balance: 0, totalEarned: 0, history: [] };
  }
};

/**
 * Get simple aura balance
 */
export const getAuraBalance = async (userId) => {
    const aura = await getUserAura(userId);
    return aura.balance;
};

/**
 * Get aura transaction history
 */
export const getAuraTransactions = async (userId) => {
    const aura = await getUserAura(userId);
    return aura.history;
};

/**
 * Get aura statistics
 */
export const getAuraStats = async (userId) => {
    const aura = await getUserAura(userId);
    return {
        totalEarned: aura.totalEarned,
        balance: aura.balance
    };
};

/**
 * Initialize aura balance for new user
 */
export const initializeAuraBalance = async (userId) => {
  try {
    return await api.post('/aura/initialize', { userId });
  } catch (error) {
    console.error('Error initializing aura:', error);
    return { success: false };
  }
};

/**
 * Award aura points for an action
 */
export const awardAura = async (userId, type, amount, data = {}) => {
  try {
    return await api.post('/aura/award', { type, amount, data });
  } catch (error) {
    console.error('Error awarding aura:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Spend aura points
 */
export const spendAura = async (userId, amount, action, data = {}) => {
  try {
    return await api.post('/aura/spend', { amount, action, data });
  } catch (error) {
    console.error('Error spending aura:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get aura leaderboard
 */
export const getAuraLeaderboard = async (limit_count = 10) => {
  try {
    return await api.get(`/aura/leaderboard?limit=${limit_count}`);
  } catch (error) {
    console.error('Error getting aura leaderboard:', error);
    return [];
  }
};
