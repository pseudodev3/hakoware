import { useMemo } from 'react';

export const calculateDebt = (perspective, now = new Date()) => {
  if (!perspective) return null;

  const {
    baseDebt = 0,
    lastInteraction,
    limit = 7,
    recoveryRequired = false
  } = perspective;

  const interactionDate = new Date(lastInteraction || 0);
  const diffTime = Math.max(0, now - interactionDate);
  const daysMissed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const daysOverLimit = Math.max(0, daysMissed - limit);
  const totalDebt = baseDebt + daysOverLimit;
  const bankruptcyLimit = limit * 2;
  const isBankrupt = totalDebt >= bankruptcyLimit;
  const isInWarningZone = totalDebt >= limit && totalDebt < bankruptcyLimit;
  const isRecovering = Boolean(recoveryRequired) && !isBankrupt;
  const daysUntilBankrupt = Math.max(0, bankruptcyLimit - totalDebt);

  let status = 'STABLE';
  let color = 'var(--aura-green)';
  let glow = 'var(--aura-green-glow)';

  if (isBankrupt) {
    status = 'BANKRUPT';
    color = 'var(--aura-red)';
    glow = 'var(--aura-red-glow)';
  } else if (isRecovering) {
    status = 'RECOVERING';
    color = 'var(--aura-gold)';
    glow = 'var(--aura-gold-glow)';
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
    bankruptcyLimit,
    isBankrupt,
    isInWarningZone,
    isRecovering,
    daysUntilBankrupt,
    status,
    color,
    glow
  };
};

export const useDebt = (perspective) => useMemo(
  () => calculateDebt(perspective),
  [perspective]
);
