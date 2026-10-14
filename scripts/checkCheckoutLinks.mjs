import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
const code = await readFile(new URL('../src/lib/cosmeticCheckout.js', import.meta.url), 'utf8');
const { checkoutTarget, formatCosmeticPrice } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('Only the intended provider hosted checkout can receive a buyer redirect', () => {
  assert.equal(checkoutTarget('https://nowpayments.io/payment/?iid=1234', 'nowpayments').hostname, 'nowpayments.io');
  assert.equal(checkoutTarget('https://sandbox.nowpayments.io/payment/?iid=1234', 'nowpayments').hostname, 'sandbox.nowpayments.io');
  assert.equal(checkoutTarget('https://checkout.stripe.com/c/pay/cs_existing', 'stripe').hostname, 'checkout.stripe.com');
  for (const url of ['http://nowpayments.io/payment/?iid=1234', 'https://nowpayments.io.attacker.test/payment/?iid=1234', 'https://attacker.test/nowpayments.io/payment/?iid=1234', 'https://attacker@nowpayments.io/payment/?iid=1234', 'https://nowpayments.io:8443/payment/?iid=1234', 'https://nowpayments.io/login?iid=1234', 'https://nowpayments.io/payment/?iid=invalid', 'https://nowpayments.io/payment/', 'https://checkout.stripe.com/c/pay/cs_1234']) assert.throws(() => checkoutTarget(url, 'nowpayments'));
  assert.throws(() => checkoutTarget('https://nowpayments.io/payment/?iid=1234', 'stripe'));
  assert.throws(() => checkoutTarget('https://nowpayments.io/payment/?iid=1234', 'unknown'));
});
test('Minor-unit order prices and receipts retain the agreed fiat value', () => {
  assert.match(formatCosmeticPrice({ amount: 499, currency: 'usd', exponent: 2 }), /4\.99/);
  assert.match(formatCosmeticPrice({ amount: 1199, currency: 'usd', exponent: 2 }), /11\.99/);
  assert.equal(formatCosmeticPrice(null), 'Prices at launch');
});
