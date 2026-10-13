const assert = require('assert');
const requestGuard = require('../middleware/requestGuard');
const { matchesAudioSignature } = require('../services/audioValidation');
const { sendRouteError } = require('../services/httpError');
const { createRateLimiter } = require('../middleware/rateLimit');

const mockResponse = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const runGuard = (body, query = {}) => {
  const res = mockResponse();
  let nextCalled = false;
  requestGuard({ body, query }, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

assert.strictEqual(runGuard({ friendshipId: 'abc', amount: 25 }).nextCalled, true, 'normal JSON should pass');
assert.strictEqual(runGuard({ filter: { $gt: 0 } }).res.statusCode, 400, 'Mongo operator keys must be rejected');
assert.strictEqual(runGuard({ 'profile.name': 'x' }).res.statusCode, 400, 'dotted keys must be rejected');
assert.strictEqual(runGuard({ constructor: { prototype: { polluted: true } } }).res.statusCode, 400, 'prototype-pollution keys must be rejected');
assert.strictEqual(runGuard({}, { '$where': 'sleep(1)' }).res.statusCode, 400, 'dangerous query keys must be rejected');

let nested = {};
let cursor = nested;
for (let i = 0; i < 22; i += 1) {
  cursor.child = {};
  cursor = cursor.child;
}
assert.strictEqual(runGuard(nested).res.statusCode, 400, 'excessive nesting must be rejected');

const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
assert.strictEqual(matchesAudioSignature(webm, 'audio/webm'), true, 'WebM signature should pass');

const mp4 = Buffer.alloc(12);
mp4.write('ftyp', 4, 'ascii');
assert.strictEqual(matchesAudioSignature(mp4, 'audio/mp4'), true, 'MP4 signature should pass');

assert.strictEqual(matchesAudioSignature(Buffer.from('ID3test'), 'audio/mpeg'), true, 'MP3 ID3 signature should pass');
assert.strictEqual(matchesAudioSignature(Buffer.from('OggStest'), 'audio/ogg'), true, 'Ogg signature should pass');

const wav = Buffer.alloc(12);
wav.write('RIFF', 0, 'ascii');
wav.write('WAVE', 8, 'ascii');
assert.strictEqual(matchesAudioSignature(wav, 'audio/wav'), true, 'WAV signature should pass');

assert.strictEqual(matchesAudioSignature(Buffer.from([0xff, 0xf1, 0x50]), 'audio/aac'), true, 'AAC ADTS signature should pass');
assert.strictEqual(matchesAudioSignature(Buffer.from('not-audio'), 'audio/webm'), false, 'MIME spoofing must fail');

const clientError = mockResponse();
sendRouteError(clientError, Object.assign(new Error('Known conflict'), { status: 409 }), 'Fallback');
assert.strictEqual(clientError.statusCode, 409, 'intentional 4xx status should be preserved');
assert.strictEqual(clientError.body.msg, 'Known conflict', 'intentional 4xx message should be preserved');

const serverError = mockResponse();
sendRouteError(serverError, new Error('mongodb internal detail'), 'Could not complete request');
assert.strictEqual(serverError.statusCode, 500, 'unexpected errors should become 500');
assert.strictEqual(serverError.body.msg, 'Could not complete request', 'unexpected internal messages must be hidden');

const unavailable = mockResponse();
sendRouteError(unavailable, { status: 503, publicMessage: 'Trading is temporarily unavailable.', message: 'internal' }, 'Fallback');
assert.strictEqual(unavailable.statusCode, 503);
assert.strictEqual(unavailable.body.msg, 'Trading is temporarily unavailable.');
const privateUnavailable = mockResponse();
sendRouteError(privateUnavailable, { status: 503, message: 'private database details' }, 'Fallback');
assert.strictEqual(privateUnavailable.statusCode, 500);
assert.strictEqual(privateUnavailable.body.msg, 'Fallback');

const limiter = createRateLimiter({ name: 'hardening-test', windowMs: 60000, max: 2 });
const req = { ip: '203.0.113.10', socket: {} };
const first = mockResponse();
const second = mockResponse();
const third = mockResponse();
let passes = 0;
limiter(req, first, () => { passes += 1; });
limiter(req, second, () => { passes += 1; });
limiter(req, third, () => { passes += 1; });
assert.strictEqual(passes, 2, 'limiter should allow only the configured request count');
assert.strictEqual(third.statusCode, 429, 'limiter should reject requests over the limit');

console.log('Server hardening checks passed');

async function checkSiteOrigins() {
  const express = require('express'), cors = require('cors');
  const { createCorsOptions } = require('../services/siteCors');
  const app = express();
  // Reproduce a deployment retaining the previous Vercel environment values.
  app.use(cors(createCorsOptions({ NODE_ENV: 'production', FRONTEND_URL: 'https://hakoware.vercel.app', CORS_ORIGINS: 'https://hakoware.vercel.app' })));
  app.get('/protected', (req, res) => res.status(401).json({ msg: 'Authentication required' }));
  app.use((error, req, res, next) => res.status(403).json({ msg: 'Origin rejected' }));
  const server = await new Promise(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/protected`;
    for (const origin of ['https://hakoware.xyz', 'https://www.hakoware.xyz', 'https://hakoware.vercel.app', 'https://hakoware-v2-preview-ghostts-projects-0d589912.vercel.app']) {
      const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-auth-token' } });
      assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
      assert.ok(preflight.headers.get('access-control-allow-headers').toLowerCase().includes('x-auth-token'));
      const account = await fetch(url, { headers: { Origin: origin } });
      assert.equal(account.status, 401, 'approved origins still require authentication'); assert.equal(account.headers.get('access-control-allow-origin'), origin);
    }
    for (const origin of ['https://hakoware.xyz.attacker.test', 'https://attacker.test/hakoware.xyz', 'http://hakoware.xyz', 'http://localhost:5173', 'https://other-tenant.vercel.app', 'https://evil.hakoware.xyz']) {
      const response = await fetch(url, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
      assert.equal(response.status, 403); assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
    console.log('Production CORS: new domains with legacy environment values, auth preflights, previews, and foreign/lookalike/local-origin rejection passed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
checkSiteOrigins().catch(error => { console.error(error); process.exitCode = 1; });
