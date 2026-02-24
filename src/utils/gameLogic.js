/**
 * Core game logic for debt calculation and streaks
 */

/**
 * Calculate debt for a perspective
 */
export const calculateDebt = (perspective) => {
  if (!perspective) return { totalDebt: 0, daysMissed: 0, isBankrupt: false, daysUntilBankrupt: 7 };

  const { baseDebt = 0, lastInteraction, limit = 7 } = perspective;
  
  // Handle Date object or ISO string
  const interactionDate = new Date(lastInteraction || 0);
  const now = new Date();
  
  const diffTime = Math.abs(now - interactionDate);
  const daysMissed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Interest only accrues after limit (grace period)
  const daysOverLimit = Math.max(0, daysMissed - limit);
  const totalDebt = baseDebt + daysOverLimit;
  
  // Bankruptcy at 2x limit
  const bankruptcyLimit = limit * 2;
  const isBankrupt = totalDebt >= bankruptcyLimit;
  const isInWarningZone = totalDebt >= limit && totalDebt < bankruptcyLimit;
  const daysUntilBankrupt = Math.max(0, bankruptcyLimit - totalDebt);
  
  return {
    totalDebt,
    daysMissed,
    daysOverLimit,
    baseDebt,
    limit,
    isBankrupt,
    isInWarningZone,
    daysUntilBankrupt
  };
};

/**
 * Get status color based on debt level
 */
export const getDebtStatusColor = (stats) => {
  if (stats.isBankrupt) return '#ff4444';
  if (stats.isInWarningZone) return '#ffbb33';
  if (stats.totalDebt > 0) return '#33b5e5';
  return '#00e676';
};

/**
 * Get debt status label
 */
export const getDebtStatusLabel = (stats) => {
  if (stats.isBankrupt) return 'BANKRUPT';
  if (stats.isInWarningZone) return 'WARNING';
  if (stats.totalDebt > 0) return 'GHOSTING';
  return 'STABLE';
};

/**
 * Get status info based on total debt
 */
export const getDebtStatus = (totalDebt, limit = 7) => {
  const bankruptcyLimit = limit * 2;
  
  if (totalDebt >= bankruptcyLimit) {
    return { label: 'BANKRUPT', color: '#ff4444' };
  } else if (totalDebt >= limit) {
    return { label: 'WARNING', color: '#ffbb33' };
  } else if (totalDebt > 0) {
    return { label: 'GHOSTING', color: '#33b5e5' };
  }
  return { label: 'STABLE', color: '#00e676' };
};
