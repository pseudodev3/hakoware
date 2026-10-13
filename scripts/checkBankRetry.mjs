import assert from 'node:assert/strict';
import test from 'node:test';
import { clearBankRetry, readBankRetry, saveBankRetry } from '../src/lib/auraBankRetry.js';

const stored = new Map();
const storage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: key => stored.delete(key)
};
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
const request = { action: 'repay', amount: 25, id: 'original-payment-123456789' };

test('an uncertain repayment survives a new module instance without changing its intent or retry key', async () => {
  saveBankRetry('one', request);
  const reloaded = await import('../src/lib/auraBankRetry.js?reloaded');
  assert.deepEqual(reloaded.readBankRetry('one'), request);
});
test('a different account cannot recover another player’s request', () => {
  assert.equal(readBankRetry('two'), null);
  saveBankRetry('two', { ...request, action: 'borrow', amount: 50, id: 'another-request-123456789' });
  assert.deepEqual(readBankRetry('one'), request);
  clearBankRetry('two');
  assert.deepEqual(readBankRetry('one'), request);
});
test('confirmation removes the durable request so the next action can start fresh', async () => {
  clearBankRetry('one');
  const reloaded = await import('../src/lib/auraBankRetry.js?confirmed');
  assert.equal(reloaded.readBankRetry('one'), null);
});
test('corrupted and invalid stored requests cannot become bank actions', () => {
  for (const value of ['broken-json', JSON.stringify({ ...request, amount: -25 }), JSON.stringify({ ...request, amount: 1.5 }), JSON.stringify({ ...request, amount: 101 }), JSON.stringify({ ...request, action: 'other' }), JSON.stringify({ ...request, id: 'short' })]) {
    stored.set('hakoware_bank_pending:invalid', value);
    assert.equal(readBankRetry('invalid'), null);
  }
});
test('denied browser storage keeps a recoverable request in memory and clears it after confirmation', () => {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Storage denied'); } });
  try {
    saveBankRetry('denied', request);
    assert.deepEqual(readBankRetry('denied'), request);
    clearBankRetry('denied');
    assert.equal(readBankRetry('denied'), null);
  } finally {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  }
});
test('full browser storage still preserves the original request across a component remount', () => {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { ...storage, setItem() { throw new Error('Quota exceeded'); } } });
  try {
    saveBankRetry('full', request);
    assert.deepEqual(readBankRetry('full'), request);
    clearBankRetry('full');
    assert.equal(readBankRetry('full'), null);
  } finally {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  }
});
