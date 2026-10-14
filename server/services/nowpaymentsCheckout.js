const { createHmac, timingSafeEqual } = require('node:crypto');
const catalog = require('../config/cosmetics.json');
const { fail, exponent, configuredUrl, returnUrl, minorAmount } = require('./checkoutHelpers');
const priceKeys = Object.fromEntries(catalog.packs.map(pack => [pack.id, `COSMETIC_PRICE_${pack.id.toUpperCase()}`]));
const sandbox = () => process.env.NOWPAYMENTS_SANDBOX === 'true';
const providerId = value => {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const text = String(value ?? '');
  return /^[1-9]\d{0,39}$/.test(text) ? text : null;
};
const callbackUrl = () => {
  const url = configuredUrl(process.env.PUBLIC_API_URL || process.env.API_URL, 'Payment verification');
  url.pathname = '/api/payments/nowpayments/webhook'; url.search = ''; url.hash = '';
  return url.toString();
};
const configuredPrice = packId => {
  const currency = String(process.env.COSMETIC_PRICE_CURRENCY || 'usd').toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) return null;
  let places;
  try { places = exponent(currency); } catch { return null; }
  const amount = minorAmount(process.env[priceKeys[packId]] || '', places);
  if (!amount || amount > 100000000) return null;
  return { id: `nowpayments:${packId}:${currency}:${amount}`, amount, currency, exponent: places };
};
const configurationIssues = () => {
  const issues = [];
  if (process.env.COSMETIC_SALES_ENABLED !== 'true') issues.push('COSMETIC_SALES_ENABLED must be true');
  for (const name of ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_IPN_SECRET']) if (!process.env[name]) issues.push(`${name} is missing`);
  if (process.env.NODE_ENV === 'production' && sandbox()) issues.push('NOWPAYMENTS_SANDBOX must be false in production');
  try { configuredUrl(process.env.FRONTEND_URL, 'Checkout'); } catch { issues.push('FRONTEND_URL is missing or invalid'); }
  try { callbackUrl(); } catch { issues.push('PUBLIC_API_URL (or API_URL) is missing or invalid'); }
  for (const pack of catalog.packs) if (!configuredPrice(pack.id)) issues.push(`${priceKeys[pack.id]} is missing or invalid; also check COSMETIC_PRICE_CURRENCY`);
  return issues;
};
const isConfigured = () => configurationIssues().length === 0;
const requireConfigured = () => { if (!isConfigured()) fail('The shop is preview-only while checkout is being set up.'); };
const priceFor = async packId => { requireConfigured(); return configuredPrice(packId) || fail('That collection is not on sale yet.'); };
const storefront = async () => ({ available: isConfigured(), prices: Object.fromEntries(catalog.packs.map(pack => [pack.id, configuredPrice(pack.id)]).filter(([, price]) => price)) });
const request = async (method, path, body) => {
  if (!process.env.NOWPAYMENTS_API_KEY || process.env.NODE_ENV === 'production' && sandbox()) fail('Payment verification is being configured. Please try again later.');
  const base = sandbox() ? 'https://api-sandbox.nowpayments.io/v1' : 'https://api.nowpayments.io/v1';
  let response;
  try {
    response = await fetch(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch { fail('We could not confirm the payment provider response. Your purchase is saved; check it before trying again.'); }
  if (!response.ok) {
    const error = Object.assign(new Error('The payment provider could not confirm this request.'), { status: 503, publicMessage: 'Checkout is temporarily unavailable. Your purchase remains saved.', providerStatus: response.status, definitive: method === 'POST' && [400, 401, 403, 422].includes(response.status) });
    throw error;
  }
  try { return await response.json(); } catch { fail('The payment provider response needs confirmation. Please check your saved purchase.'); }
};
const invoiceUrl = (value, invoiceId) => {
  let url;
  try { url = new URL(value); } catch { throw new Error('NOWPayments returned an invalid checkout link'); }
  const hosts = sandbox() ? ['nowpayments.io', 'sandbox.nowpayments.io'] : ['nowpayments.io'];
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname) || !['/payment', '/payment/'].includes(url.pathname) || url.searchParams.get('iid') !== invoiceId) throw new Error('NOWPayments returned an invalid checkout link');
  return url.toString();
};
const createInvoice = async order => {
  const pack = catalog.packs.find(pack => pack.id === order.packId);
  return module.exports.request('POST', '/invoice', { price_amount: order.amount / 10 ** exponent(order.currency), price_currency: order.currency, order_id: order._id, order_description: `Hakoware - ${pack.name} cosmetic collection`, ipn_callback_url: callbackUrl(), success_url: returnUrl(order._id, 'success'), cancel_url: returnUrl(order._id, 'cancelled') });
};
const getPayment = async paymentId => {
  const key = providerId(paymentId);
  if (!key) throw new Error('Invalid NOWPayments payment reference');
  return module.exports.request('GET', `/payment/${key}`);
};
const canonical = (value, depth = 0) => {
  if (depth > 12) throw new Error('Payment callback is too deeply nested');
  if (Array.isArray(value)) return value.map(item => canonical(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key], depth + 1)]));
  return value;
};
const verifyIpn = (body, signature) => {
  if (!process.env.NOWPAYMENTS_IPN_SECRET || !/^[a-f0-9]{128}$/i.test(signature || '')) return false;
  try {
    const expected = createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET).update(JSON.stringify(canonical(body))).digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  } catch { return false; }
};
module.exports = { name: 'nowpayments', sandbox, configurationIssues, isConfigured, requireConfigured, priceFor, storefront, request, createInvoice, getPayment, invoiceUrl, providerId, verifyIpn };
