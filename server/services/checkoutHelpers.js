const fail = message => { throw Object.assign(new Error(message), { status: 503, publicMessage: message }); };
const exponent = currency => ['isk', 'ugx'].includes(currency) ? 2 : new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
const configuredUrl = (value, name) => {
  let url;
  try { url = new URL(value); } catch { fail(`${name} is being configured. Please try again later.`); }
  if (url.username || url.password || url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')) fail(`${name} is being configured. Please try again later.`);
  return url;
};
const returnUrl = (orderId, state) => {
  const url = configuredUrl(process.env.FRONTEND_URL, 'Checkout');
  url.pathname = '/'; url.search = ''; url.hash = '';
  url.searchParams.set('view', 'you'); url.searchParams.set('cosmetic_order', orderId); url.searchParams.set('checkout', state);
  return url.toString();
};
const minorAmount = (value, places) => {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text) || text.length > 24) return null;
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > places && /[1-9]/.test(fraction.slice(places))) return null;
  const result = Number(BigInt(whole) * (10n ** BigInt(places)) + BigInt((fraction.slice(0, places).padEnd(places, '0')) || '0'));
  return Number.isSafeInteger(result) ? result : null;
};
const decimalParts = value => {
  const text = String(value);
  if (text.length > 100 || !/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) return null;
  const [base, power = '0'] = text.toLowerCase().split('e'), [whole, fraction = ''] = base.split('.');
  const scale = fraction.length - Number(power);
  if (!Number.isSafeInteger(scale) || Math.abs(scale) > 80) return null;
  return { amount: BigInt(whole + fraction), scale };
};
const atLeast = (actual, expected) => {
  const a = decimalParts(actual), b = decimalParts(expected);
  if (!a || !b || b.amount <= 0n) return false;
  const scale = Math.max(a.scale, b.scale);
  return a.amount * 10n ** BigInt(scale - a.scale) >= b.amount * 10n ** BigInt(scale - b.scale);
};
module.exports = { fail, exponent, configuredUrl, returnUrl, minorAmount, atLeast };
