const Stripe = require('stripe');
const catalog = require('../config/cosmetics.json');
const priceKeys = Object.fromEntries(catalog.packs.map(pack => [pack.id, `STRIPE_PRICE_${pack.id.toUpperCase()}`]));
let instance, instanceKey, cachedStorefront;
const fail = message => { throw Object.assign(new Error(message), { status: 503, publicMessage: message }); };
const client = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) fail('The shop is preview-only while checkout is being set up.');
  if (!instance || instanceKey !== key) { instance = new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 }); instanceKey = key; }
  return instance;
};
const isConfigured = () => process.env.COSMETIC_SALES_ENABLED === 'true'
  && Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.FRONTEND_URL)
  && catalog.packs.every(pack => Boolean(process.env[priceKeys[pack.id]]));
const requireConfigured = () => { if (!isConfigured()) fail('The shop is preview-only while checkout is being set up.'); };
const exponent = currency => ['isk', 'ugx'].includes(currency) ? 2 : new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
const priceFor = async packId => {
  requireConfigured();
  const priceId = process.env[priceKeys[packId]];
  if (!priceId) fail('That collection is not on sale yet.');
  const price = await module.exports.client().prices.retrieve(priceId);
  if (!price.active || price.type !== 'one_time' || !Number.isSafeInteger(price.unit_amount) || price.unit_amount <= 0 || !/^[a-z]{3}$/.test(price.currency)) fail('That collection is not available for checkout.');
  return { id: price.id, amount: price.unit_amount, currency: price.currency, exponent: exponent(price.currency) };
};
const storefront = async () => {
  if (!isConfigured()) return { available: false, prices: {} };
  const key = [process.env.STRIPE_SECRET_KEY, ...Object.values(priceKeys).map(name => process.env[name])].join(':');
  if (cachedStorefront?.key === key && cachedStorefront.until > Date.now()) return cachedStorefront.value;
  try {
    const value = { available: true, prices: Object.fromEntries(await Promise.all(catalog.packs.map(async pack => [pack.id, await priceFor(pack.id)]))) };
    cachedStorefront = { key, until: Date.now() + 30000, value }; return value;
  }
  catch (error) { console.error('Cosmetic price lookup unavailable:', error.code || error.type || 'provider unavailable'); return { available: false, prices: {} }; }
};
const returnUrl = (orderId, state) => {
  const url = new URL(process.env.FRONTEND_URL);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')) fail('Checkout is being configured. Please try again later.');
  url.pathname = '/'; url.search = ''; url.hash = '';
  url.searchParams.set('view', 'you'); url.searchParams.set('cosmetic_order', orderId); url.searchParams.set('checkout', state);
  return url.toString();
};
module.exports = { client, isConfigured, requireConfigured, priceFor, storefront, returnUrl, exponent, fail };
