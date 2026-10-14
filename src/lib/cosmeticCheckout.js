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
export const bundleSavings = (bundle, packs) => {
  if (!bundle?.bundle || bundle.unlockedStyles > 0) return null;
  const members = packs.filter(pack => !pack.bundle && pack.grants?.length && pack.grants.every(grant => bundle.grants?.includes(grant)));
  if (members.length < 2 || !bundle.grants?.every(grant => members.some(pack => pack.grants.includes(grant))) || members.some(pack => pack.owned || pack.unlockedStyles > 0)) return null;
  const price = bundle.price;
  const valid = value => value && /^[a-z]{3}$/i.test(value.currency || '') && Number.isSafeInteger(value.amount) && value.amount > 0 && Number.isInteger(value.exponent) && value.exponent >= 0 && value.exponent <= 6;
  if (!valid(price) || members.some(pack => !valid(pack.price) || pack.price.currency !== price.currency || pack.price.exponent !== price.exponent)) return null;
  const total = members.reduce((sum, pack) => sum + pack.price.amount, 0);
  if (!Number.isSafeInteger(total) || total <= price.amount) return null;
  return { amount: total - price.amount, currency: price.currency, exponent: price.exponent };
};
export const checkoutTarget = (url, provider = 'stripe') => {
  const target = new URL(url);
  const stripe = provider === 'stripe' && target.hostname === 'checkout.stripe.com';
  const nowpayments = provider === 'nowpayments' && ['nowpayments.io', 'sandbox.nowpayments.io'].includes(target.hostname) && ['/payment', '/payment/'].includes(target.pathname) && /^[1-9]\d{0,39}$/.test(target.searchParams.get('iid') || '');
  if (target.protocol !== 'https:' || target.username || target.password || target.port || !stripe && !nowpayments) throw new Error('Could not confirm a secure checkout link.');
  return target;
};
export const goToHostedCheckout = (url, provider) => window.location.assign(checkoutTarget(url, provider).toString());
