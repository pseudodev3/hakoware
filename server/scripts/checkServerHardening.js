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
