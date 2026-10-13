const memory = new Map();
const storageKey = (userId, packId, friendshipId) => `hakoware:cosmetic-checkout:${userId}:${packId}:${friendshipId || 'self'}`;
export const checkoutRetryKey = (userId, packId, friendshipId = null) => {
  const key = storageKey(userId, packId, friendshipId);
  let current = memory.get(key);
  try { current ||= localStorage.getItem(key); } catch { /* Saved orders also allow recovery without browser storage. */ }
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(current || '')) current = crypto.randomUUID();
  memory.set(key, current);
  try { localStorage.setItem(key, current); } catch { /* Keep the same intent in memory. */ }
  return current;
};
export const clearCheckoutRetryKey = (userId, packId, friendshipId = null) => {
  const key = storageKey(userId, packId, friendshipId); memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* Optional storage. */ }
};
export const formatCosmeticPrice = price => price ? new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.amount / (10 ** price.exponent)) : 'Prices at launch';
export const goToStripeCheckout = url => {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') throw new Error('Could not confirm a secure checkout link.');
  window.location.assign(target.toString());
};
