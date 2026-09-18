const DAY = 24 * 60 * 60 * 1000;

const calculateDebtState = (perspective, now = new Date()) => {
  const limit = Math.max(1, Number(perspective?.limit) || 7);
  const baseDebt = Math.max(0, Number(perspective?.baseDebt) || 0);
  const lastInteraction = new Date(perspective?.lastInteraction || 0);
  const elapsed = Math.max(0, now.getTime() - lastInteraction.getTime());
  const daysMissed = Math.floor(elapsed / DAY);
  const daysOverLimit = Math.max(0, daysMissed - limit);
  const totalDebt = baseDebt + daysOverLimit;
  const bankruptcyLimit = limit * 2;
  const isBankrupt = totalDebt >= bankruptcyLimit;
  const isInWarningZone = totalDebt >= limit && totalDebt < bankruptcyLimit;

  return {
    limit,
    baseDebt,
    daysMissed,
    daysOverLimit,
    totalDebt,
    bankruptcyLimit,
    isBankrupt,
    isInWarningZone,
    daysUntilBankrupt: Math.max(0, bankruptcyLimit - totalDebt)
  };
};

const syncDebtState = (perspective, now = new Date()) => {
  const state = calculateDebtState(perspective, now);
  perspective.calculatedDebt = state.totalDebt;
  perspective.calculatedAt = now;
  perspective.daysMissed = state.daysMissed;
  perspective.isBankrupt = state.isBankrupt;
  perspective.isInWarningZone = state.isInWarningZone;
  perspective.daysUntilBankrupt = state.daysUntilBankrupt;

  if (state.isBankrupt) {
    perspective.wasBankrupt = true;
    if (!perspective.bankruptAt) perspective.bankruptAt = now;
  }

  return state;
};

module.exports = {
  DAY,
  calculateDebtState,
  syncDebtState
};
