import { useMemo } from 'react';

/**
 * Hook to calculate debt and status logic consistently across the app.
 * Follows DRY principle by centralizing all "Hunter x Hunter" debt mechanics.
 */
export const useDebt = (perspective) => {
  return useMemo(() => {
    if (!perspective) return null;

    const { 
      baseDebt = 0, 
      lastInteraction, 
      limit = 7 
    } = perspective;

    const interactionDate = new Date(lastInteraction || 0);
    const now = new Date();
    
    // Total days since last interaction
    const diffTime = Math.max(0, now - interactionDate);
    const daysMissed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Days beyond the "grace period" (limit)
    const daysOverLimit = Math.max(0, daysMissed - limit);
    
    // Total Debt = Base Debt (manually added) + Days Over Limit (interest)
    const totalDebt = baseDebt + daysOverLimit;
    
    // Bankruptcy Protocol
    const bankruptcyLimit = limit * 2;
    const isBankrupt = totalDebt >= bankruptcyLimit;
    const isInWarningZone = totalDebt >= limit && totalDebt < bankruptcyLimit;
    const daysUntilBankrupt = Math.max(0, bankruptcyLimit - totalDebt);

    // Visual Metadata
    let status = 'STABLE';
    let color = 'var(--aura-green)';
    let glow = 'var(--aura-green-glow)';

    if (isBankrupt) {
      status = 'BANKRUPT';
      color = 'var(--aura-red)';
      glow = 'var(--aura-red-glow)';
    } else if (isInWarningZone) {
      status = 'WARNING';
      color = 'var(--aura-gold)';
      glow = 'var(--aura-gold-glow)';
    } else if (totalDebt > 0) {
      status = 'GHOSTING';
      color = 'var(--aura-blue)';
      glow = 'var(--aura-blue-glow)';
    }

    return {
      totalDebt,
      daysMissed,
      daysOverLimit,
      baseDebt,
      limit,
      isBankrupt,
      isInWarningZone,
      daysUntilBankrupt,
      status,
      color,
      glow
    };
  }, [perspective]);
};
