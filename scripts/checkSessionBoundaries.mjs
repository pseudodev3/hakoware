import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { clearResourceCache, deleteResource, fetchResource, peekResource, seedResource } from '../src/lib/resourceCache.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('logout discards an old response without overwriting the new account cache', async () => {
  clearResourceCache(); const old = deferred();
  const pending = fetchResource('tab:you', () => old.promise);
  await Promise.resolve(); clearResourceCache();
  seedResource('tab:you', { owner: 'new-account' });
  old.resolve({ owner: 'old-account' });
  await assert.rejects(pending, { code: 'RESOURCE_INVALIDATED' });
  assert.deepEqual(peekResource('tab:you'), { owner: 'new-account' });
});

test('an old failed request cannot clear a new account’s in-flight request', async () => {
  clearResourceCache(); const old = deferred(), fresh = deferred();
  const prior = fetchResource('app:bootstrap', () => old.promise); await Promise.resolve();
  clearResourceCache(); const next = fetchResource('app:bootstrap', () => fresh.promise); await Promise.resolve();
  old.reject(new Error('Old account request failed')); await assert.rejects(prior);
  let duplicateCalls = 0;
  const duplicate = fetchResource('app:bootstrap', () => { duplicateCalls += 1; });
  fresh.resolve({ owner: 'new-account' });
  assert.deepEqual(await next, { owner: 'new-account' }); assert.deepEqual(await duplicate, { owner: 'new-account' });
  assert.equal(duplicateCalls, 0);
});

test('logout before a deferred loader starts prevents it from running', async () => {
  clearResourceCache(); let calls = 0;
  const request = fetchResource('aura', () => { calls += 1; }); clearResourceCache();
  await assert.rejects(request, { code: 'RESOURCE_INVALIDATED' }); assert.equal(calls, 0);
});

test('deleted resources cannot be restored by an old response', async () => {
  clearResourceCache(); const old = deferred(); const pending = fetchResource('deleted', () => old.promise);
  await Promise.resolve(); deleteResource('deleted'); old.resolve('stale');
  await assert.rejects(pending, { code: 'RESOURCE_INVALIDATED' }); assert.equal(peekResource('deleted'), undefined);
});

test('API methods reject responses after account switching, even during JSON parsing', async () => {
  const original = { storage: globalThis.localStorage, fetch: globalThis.fetch };
  let token = 'account-one'; globalThis.localStorage = { getItem: () => token };
  const source = (await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8')).replace('import.meta.env.API_URL', '""');
  const { api } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  try {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'upload']) {
      token = 'account-one'; const parsed = deferred();
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.headers['x-auth-token'], 'account-one');
        return { ok: true, headers: new globalThis.Headers({ 'content-type': 'application/json' }), json: () => parsed.promise };
      };
      const request = api[method]('/private', method === 'upload' ? new globalThis.FormData() : {});
      await Promise.resolve(); token = 'account-two'; parsed.resolve({ private: 'account-one' });
      await assert.rejects(request, { code: 'SESSION_CHANGED' });
    }
    token = 'stable'; globalThis.fetch = async () => new globalThis.Response(JSON.stringify({ balance: 42 }), { headers: { 'Content-Type': 'application/json' } });
    assert.deepEqual(await api.get('/aura'), { balance: 42 });
    globalThis.fetch = async () => new globalThis.Response(JSON.stringify({ msg: 'Known conflict' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(api.post('/aura', {}), error => error.status === 409 && error.message === 'Known conflict');
  } finally { globalThis.localStorage = original.storage; globalThis.fetch = original.fetch; clearResourceCache(); }
});
