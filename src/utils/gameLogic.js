// Pure logic functions - No React code here

/**
 * Calculate debt for a user in a friendship
 * 
 * NEW LOGIC:
 * - Days 0 to limit: FREE (grace period, no debt)
 * - Days limit+1 onwards: debt = baseDebt + (daysMissed - limit)
 * - Bankruptcy: when totalDebt >= limit * 2 (warning zone)
 */
export const calculateDebt = (contract) => {
    if (!contract || !contract.lastInteraction) return { totalDebt: 0, daysMissed: 0, limit: 7, daysOverLimit: 0, isBankrupt: false, isInWarningZone: false, daysUntilBankrupt: 14 };
    
    // Handle Firestore Timestamp vs Date object
    let lastInteraction;
    if (contract.lastInteraction.toDate) {
        lastInteraction = contract.lastInteraction.toDate();
    } else {
        lastInteraction = new Date(contract.lastInteraction);
    }
    
    const now = new Date();
    const diffTime = Math.abs(now - lastInteraction);
    const daysMissed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const limit = contract.bankruptcyLimit || 7;
    const baseDebt = contract.baseDebt || 0;
    
    // NEW: Interest only accrues AFTER the limit (grace period is truly free)
    const daysOverLimit = Math.max(0, daysMissed - limit);
    const totalDebt = baseDebt + daysOverLimit;
    
    // NEW: Bankruptcy threshold is 2x the limit (warning zone)
    const isBankrupt = totalDebt >= limit * 2;
    const isInWarningZone = totalDebt >= limit && totalDebt < limit * 2;
    
    return {
        totalDebt,
        daysMissed,
        daysOverLimit,
        limit,
        baseDebt,
        isBankrupt,
        isInWarningZone,
        daysUntilBankrupt: Math.max(0, (limit * 2) - totalDebt)
    };
};

export const getHunterRank = (debt) => {
    if (debt === 0) return 'CLEAN RECORD';
    if (debt < 10) return 'ROOKIE';
    if (debt < 30) return 'NEN USER';
    if (debt < 50) return 'PHANTOM TROUPE';
    return 'CHIMERA ANT';
};

export const calculateCreditScore = (debt, days) => {
    let score = 850; 
    score -= (days * 10); 
    score -= (debt * 2);  
    return Math.max(300, score);
};

/**
 * Get status label for debt level
 */
export const getDebtStatus = (debt, limit) => {
    if (debt === 0) return { label: 'SOLVENT', color: '#00e676', severity: 'good' };
    if (debt < limit) return { label: 'ACTIVE', color: '#ffd700', severity: 'warning' };
    if (debt < limit * 2) return { label: 'WARNING', color: '#ff8800', severity: 'danger' };
    return { label: 'BANKRUPT', color: '#ff4444', severity: 'critical' };
};
