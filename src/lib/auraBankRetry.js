// Keep the original intent until the server confirms its result, including
// after leaving the bank or reloading this tab. Scope it to the signed-in user.
const fallback = new Map();
const storageKey = userId => `hakoware_bank_pending:${userId}`;
const valid = value => value && ['borrow', 'repay'].includes(value.action)
  && Number.isSafeInteger(value.amount) && value.amount > 0 && value.amount <= 100
  && typeof value.id === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value.id);

export const readBankRetry = userId => {
  if (!userId) return null;
  const remembered = fallback.get(String(userId));
  if (remembered) return remembered;
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(userId)) || 'null');
    if (!valid(value)) return null;
    fallback.set(String(userId), value);
    return value;
  } catch {
    return null;
  }
};

export const saveBankRetry = (userId, value) => {
  if (!userId || !valid(value)) return;
  fallback.set(String(userId), value);
  try { sessionStorage.setItem(storageKey(userId), JSON.stringify(value)); } catch { /* Keep the in-memory retry when storage is unavailable. */ }
};

export const clearBankRetry = userId => {
  fallback.delete(String(userId));
  try { sessionStorage.removeItem(storageKey(userId)); } catch { /* In-memory state is already cleared. */ }
};
