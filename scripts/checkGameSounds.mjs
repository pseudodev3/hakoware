import assert from 'node:assert/strict';
import test from 'node:test';

const fixture = async () => {
  const previous = Object.fromEntries(['window', 'document', 'localStorage', 'performance'].map(key => [key, globalThis[key]]));
  const storage = new Map(), contexts = [], notes = [], peaks = [];
  let now = 1000, denyStorage = false, resumeGate = null, primes = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelAndHoldAtTime() {}, linearRampToValueAtTime(value) { peaks.push(value); } });
  class Audio {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; contexts.push(this); }
    async resume() { if (resumeGate) await resumeGate; this.state = 'running'; }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { primes += 1; } }; }
    createOscillator() { return { frequency: param(), connect() {}, disconnect() {}, start() { notes.push(this); }, stop() {} }; }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createBiquadFilter() { return { frequency: {}, Q: {}, connect() {}, disconnect() {} }; }
  }
  globalThis.window = { AudioContext: Audio, dispatchEvent() {} };
  globalThis.document = { visibilityState: 'visible' };
  globalThis.localStorage = { getItem(key) { if (denyStorage) throw Error('storage denied'); return storage.get(key) ?? null; }, setItem(key, value) { if (denyStorage) throw Error('storage denied'); storage.set(key, value); } };
  globalThis.performance = { now: () => now };
  const sound = await import(`../src/lib/gameSounds.js?fixture=${Math.random()}`);
  sound.setGameSoundOwner('player');
  return { sound, notes, contexts, peaks, storage, get primes() { return primes; }, advance: value => { now += value; }, denyStorage: () => { denyStorage = true; },
    holdResume() { let release; resumeGate = new Promise(resolve => { release = resolve; }); return release; },
    close() { sound.setGameSoundOwner(null); for (const [key, value] of Object.entries(previous)) globalThis[key] = value; } };
};

test('muted and pre-gesture events never create audio or replay on the next activation', async () => {
  const f = await fixture();
  try {
    assert.equal(f.sound.playGameSound('checkin', 'player', 'old'), false); assert.equal(f.contexts.length, 0);
    f.sound.setGameSounds('player', true);
    assert.equal(f.sound.playGameSound('checkin', 'player', 'old'), false);
    await f.sound.unlockGameAudio(); assert.equal(f.notes.length, 0); assert.equal(f.primes, 1);
    await f.sound.unlockGameAudio(); assert.equal(f.primes, 1, 'output primes once per context');
    await f.sound.unlockGameAudio('touchend'); assert.equal(f.primes, 2, 'touch activation gets a valid output prime even after pointer activation');
    await f.sound.unlockGameAudio('touchend'); assert.equal(f.primes, 2);
  } finally { f.close(); }
});

test('a confirmation waits for a brief suspension, plays once and keeps event deduplication', async () => {
  const f = await fixture();
  try {
    f.sound.setGameSounds('player', true); await f.sound.unlockGameAudio();
    f.contexts[0].state = 'interrupted'; const release = f.holdResume();
    f.sound.playGameSound('checkin', 'player', 'saved-checkin');
    f.sound.playGameSound('checkin', 'player', 'saved-checkin');
    assert.equal(f.notes.length, 0); release(); await new Promise(resolve => globalThis.setTimeout(resolve, 0));
    assert.equal(f.notes.length, 2); f.advance(1000);
    assert.equal(f.sound.playGameSound('checkin', 'player', 'saved-checkin'), false);
  } finally { f.close(); }
});

for (const boundary of ['mute', 'account switch', 'hidden tab', 'expired cue']) test(`${boundary} cancels a confirmation awaiting audio recovery`, async () => {
  const f = await fixture();
  try {
    f.sound.setGameSounds('player', true); await f.sound.unlockGameAudio();
    f.contexts[0].state = 'suspended'; const release = f.holdResume();
    f.sound.playGameSound('duel_win', 'player', 'finished');
    if (boundary === 'mute') f.sound.setGameSounds('player', false);
    if (boundary === 'account switch') { f.sound.setGameSoundOwner('other'); f.sound.setGameSounds('other', true); }
    if (boundary === 'hidden tab') globalThis.document.visibilityState = 'hidden';
    if (boundary === 'expired cue') f.advance(1300);
    release(); await new Promise(resolve => globalThis.setTimeout(resolve, 0)); assert.equal(f.notes.length, 0);
  } finally { f.close(); }
});

test('an explicit sound preference still works for the session when browser storage is blocked', async () => {
  const f = await fixture();
  try {
    f.storage.set('hakoware:game-sounds:player', 'off'); f.denyStorage();
    f.sound.setGameSounds('player', true); assert.equal(f.sound.gameSoundsEnabled('player'), true);
    await f.sound.unlockGameAudio(); assert.equal(f.sound.playGameSound('card', 'player', 'move'), true);
    assert.equal(f.sound.playGameSound('card', 'other', 'move'), false);
    assert.equal(f.sound.gameSoundsEnabled('player', { type: 'storage', key: 'hakoware:game-sounds:other' }), true);
    assert.equal(f.sound.gameSoundsEnabled('player', { type: 'storage', key: 'hakoware:game-sounds:player' }), false, 'a cross-tab preference change invalidates the fallback');
    f.sound.setGameSounds('player', false); f.advance(1000);
    assert.equal(f.sound.gameSoundsEnabled('player'), false); assert.equal(f.sound.playGameSound('card', 'player', 'next'), false);
  } finally { f.close(); }
});

test('confirmed gameplay has distinct cues, a quiet gain ceiling and a cooldown', async () => {
  const f = await fixture();
  try {
    f.sound.setGameSounds('player', true); await f.sound.unlockGameAudio();
    for (const kind of ['preview', 'checkin', 'card', 'duel_win', 'duel_end', 'bank', 'trade', 'DUO_LEVEL_UP', 'SEASON_COMPLETED', 'SIGNAL_FLARE']) {
      const before = f.notes.length;
      assert.equal(f.sound.playGameSound(kind, 'player', kind), true); assert.ok(f.notes.length > before);
      assert.equal(f.sound.playGameSound(kind, 'player', 'overlap'), false); f.advance(1000);
      assert.equal(f.sound.playGameSound(kind, 'player', kind), false);
    }
    assert.ok(f.peaks.every(peak => peak <= .035));
  } finally { f.close(); }
});
