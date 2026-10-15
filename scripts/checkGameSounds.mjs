import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { clips } from '../src/lib/gameAudioClips.js';

const fixture = async ({ mobile = false } = {}) => {
  const previous = Object.fromEntries(['window', 'document', 'localStorage', 'performance'].map(key => [key, globalThis[key]]));
  const storage = new Map(), contexts = [], notes = [], peaks = [];
  let now = 1000, denyStorage = false, resumeGate = null, primes = 0;
  const media = [], timers = new Map(); let timerId = 0, gesture = false, denyMedia = false;
  class Media {
    constructor(src) { this.src = src; this.currentTime = 0; this.paused = true; this.activated = false; this.starts = []; media.push(this); }
    setAttribute() {}
    play() {
      if (denyMedia || !this.activated && !gesture) return Promise.reject(Error('media gesture required'));
      this.activated = true; this.paused = false; this.starts.push(this.currentTime); return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
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
  globalThis.window = { AudioContext: Audio, Audio: Media, dispatchEvent() {}, navigator: mobile ? { userAgent: 'iPhone', audioSession: { type: 'ambient' } } : {}, setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  globalThis.document = { visibilityState: 'visible' };
  globalThis.localStorage = { getItem(key) { if (denyStorage) throw Error('storage denied'); return storage.get(key) ?? null; }, setItem(key, value) { if (denyStorage) throw Error('storage denied'); storage.set(key, value); } };
  globalThis.performance = { now: () => now };
  const sound = await import(`../src/lib/gameSounds.js?fixture=${Math.random()}`);
  sound.setGameSoundOwner('player');
  return { sound, notes, contexts, peaks, storage, media, timers, get primes() { return primes; }, advance: value => { now += value; }, denyStorage: () => { denyStorage = true; },
    gesture(fn) { gesture = true; try { return fn(); } finally { gesture = false; } }, denyMedia(value) { denyMedia = value; },
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

test('iPhone preview and delayed gameplay share one gesture-activated media element', async () => {
  const f = await fixture({ mobile: true });
  try {
    f.sound.setGameSounds('player', true);
    assert.equal(f.sound.playGameSound('card', 'player', 'before-tap'), false); assert.equal(f.media.length, 0);
    assert.equal(await f.sound.unlockGameAudio('pointerup'), false); assert.equal(f.media.length, 0, 'an earlier pointer event cannot consume touch activation');
    assert.equal(await f.gesture(() => f.sound.previewGameSound('player')), true);
    assert.equal(f.media.length, 1); assert.equal(f.contexts.length, 0, 'mobile uses media output rather than ambient Web Audio');
    assert.equal(globalThis.window.navigator.audioSession.type, 'playback');
    assert.deepEqual(f.media[0].starts, [0, clips.preview.start]);
    f.advance(1500); assert.equal(f.sound.playGameSound('card', 'player', 'move-one'), true);
    await Promise.resolve(); assert.equal(f.media[0].starts.at(-1), clips.card.start);
    assert.equal(f.media.length, 1); assert.equal(f.sound.playGameSound('card', 'player', 'overlap'), false);
    f.sound.setGameSounds('player', false); assert.equal(f.media[0].paused, true); assert.equal(f.timers.size, 0);
    f.advance(1500); assert.equal(f.sound.playGameSound('duel_win', 'player', 'finish'), false);
    f.sound.setGameSoundOwner('other'); f.sound.setGameSounds('other', true);
    assert.equal(f.sound.playGameSound('card', 'player', 'old-account'), false);
    assert.equal(f.sound.playGameSound('card', 'other', 'new-account'), true);
  } finally { f.close(); }
});

test('a rejected mobile preview reports failure and retries on a fresh tap', async () => {
  const f = await fixture({ mobile: true });
  try {
    f.sound.setGameSounds('player', true); f.denyMedia(true);
    assert.equal(await f.gesture(() => f.sound.previewGameSound('player')), false);
    f.denyMedia(false); assert.equal(await f.gesture(() => f.sound.previewGameSound('player')), true);
    f.sound.silenceGameSounds(); assert.equal(f.media[0].paused, true); assert.equal(f.timers.size, 0);
    globalThis.document.visibilityState = 'hidden'; f.advance(1500);
    assert.equal(await f.gesture(() => f.sound.previewGameSound('player')), false);
  } finally { f.close(); }
});

test('the mobile file contains distinct short cues, quiet peaks and silent sprite gaps', () => {
  const wav = readFileSync(new globalThis.URL('../src/assets/game-cues.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  const rate = wav.readUInt32LE(24), length = wav.readUInt32LE(40) / 2;
  const sample = index => wav.readInt16LE(44 + index * 2) / 32768;
  let previousEnd = 0;
  for (const clip of Object.values(clips)) {
    const from = Math.round(clip.start * rate), to = Math.round((clip.start + clip.duration) * rate);
    assert.ok(clip.duration <= .5); assert.ok(to <= length);
    for (let n = previousEnd; n < from; n += 1) assert.equal(sample(n), 0, 'sprite separation must be silent');
    let peak = 0; for (let n = from; n < to; n += 1) peak = Math.max(peak, Math.abs(sample(n)));
    assert.ok(peak > .01 && peak < .09, `peak ${peak}`); previousEnd = to;
  }
});
