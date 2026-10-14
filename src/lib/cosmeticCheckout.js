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
export const checkoutTarget = (url, provider = 'stripe') => {
  const target = new URL(url);
  const stripe = provider === 'stripe' && target.hostname === 'checkout.stripe.com';
  const nowpayments = provider === 'nowpayments' && ['nowpayments.io', 'sandbox.nowpayments.io'].includes(target.hostname) && ['/payment', '/payment/'].includes(target.pathname) && /^[1-9]\d{0,39}$/.test(target.searchParams.get('iid') || '');
  if (target.protocol !== 'https:' || target.username || target.password || target.port || !stripe && !nowpayments) throw new Error('Could not confirm a secure checkout link.');
  return target;
};
export const goToHostedCheckout = (url, provider) => window.location.assign(checkoutTarget(url, provider).toString());
