import { api } from './api';

/**
 * Perform a check-in for a friendship
 */
export const performCheckin = async (friendshipId, userId, proofOfContact = '') => {
  try {
    const res = await api.post(`/friendships/${friendshipId}/checkin`, { proofOfContact });
    if (res.msg) throw new Error(res.msg);
    return {
        success: true,
        ...res
    };
  } catch (error) {
    console.error('Check-in failed:', error);
    throw error;
  }
};

/**
 * Check if user has already checked in today
 */
export const hasCheckedInToday = async (friendshipId, userId) => {
  try {
    const res = await api.get(`/friendships/${friendshipId}/status`);
    return res.hasCheckedInToday;
  } catch (error) {
    console.error('Error checking check-in status:', error);
    return false;
  }
};

/**
 * Get check-in history for a friendship
 */
export const getCheckinHistory = async (friendshipId, limit = 30) => {
  try {
    return await api.get(`/friendships/${friendshipId}/checkins?limit=${limit}`);
  } catch (error) {
    console.error('Error fetching check-in history:', error);
    return [];
  }
};

/**
 * Calculate current debt for a friendship (client-side)
 * Now handled by backend, but kept for UI compatibility
 */
export const calculateCurrentDebt = (friendship) => {
  if (!friendship) return 0;
  return friendship.calculatedDebt || 0;
};

/**
 * Daily debt accrual - now handled by backend cron jobs
 */
export const applyDailyDebtAccrual = async (friendshipId) => {
    return { success: true };
};

export const calculateDailyInterest = applyDailyDebtAccrual;

export default {
  performCheckin,
  hasCheckedInToday,
  getCheckinHistory,
  calculateCurrentDebt,
  applyDailyDebtAccrual,
  calculateDailyInterest
};
