import { cues } from './gameSoundCues.js';
import { createMobileGameAudio, usesMobileGameAudio } from './mobileGameAudio.js';
const preferenceKey = userId => `hakoware:game-sounds:${userId}`;
let context = null;
let ownerId = null;
let lastPlayed = -Infinity;
let pendingCue = null;
let generation = 0;
let primedContext = null;
let touchPrimedContext = null;
let mobile = null;
const active = new Set();
const played = new Set();
const deviceOverrides = new Map();
export const setGameSoundOwner = userId => { generation += 1; silenceGameSounds(); ownerId = userId ? String(userId) : null; played.clear(); lastPlayed = -Infinity; };
export const gameSoundsEnabled = (userId, event = null) => {
  if (!userId) return false;
  const key = preferenceKey(userId);
  if (event?.type === 'storage' && (event.key === key || event.key === null)) deviceOverrides.delete(key);
  if (deviceOverrides.has(key)) return deviceOverrides.get(key);
  try { return localStorage.getItem(key) === 'on'; } catch { return false; }
};
export const silenceGameSounds = () => {
  pendingCue = null;
  mobile?.stop();
  for (const sound of active) { try {
    sound.gain.gain.cancelAndHoldAtTime(context.currentTime);
    sound.gain.gain.linearRampToValueAtTime(0, context.currentTime + .012);
    sound.oscillator.stop(context.currentTime + .015);
  } catch { try { sound.gain.gain.value = 0; sound.oscillator.stop(); } catch { /* Already silent. */ } } }
  active.clear();
};
export const setGameSounds = (userId, enabled) => {
  if (!userId) return;
  const key = preferenceKey(userId);
  try { localStorage.setItem(key, enabled ? 'on' : 'off'); deviceOverrides.delete(key); }
  catch { deviceOverrides.set(key, Boolean(enabled)); }
  if (!enabled) silenceGameSounds();
  window.dispatchEvent(new CustomEvent('hakoware-sound-preference', { detail: { userId: String(userId) } }));
};
export const unlockGameAudio = async (gesture = null) => {
  try {
    // WebKit's ambient Web Audio route can be silent with the ringer muted.
    // A gesture-activated media element uses the phone's media output instead.
    if (window.navigator?.audioSession) {
      try { window.navigator.audioSession.type = 'playback'; } catch { /* Older WebKit. */ }
    }
    if (usesMobileGameAudio()) {
      if (gesture === 'pointerup') return false;
      mobile ||= createMobileGameAudio();
      if (!await mobile.unlock()) return false;
      const queued = pendingCue; pendingCue = null;
      if (queued && queued.generation === generation && performance.now() < queued.expiresAt) playGameSound(queued.kind, queued.userId, queued.eventId);
      return true;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!context || context.state === 'closed') context = new Audio({ latencyHint: 'interactive' });
    const audio = context;
    // Start an inaudible sample during the gesture as well as resuming. WebKit
    // can otherwise report a running context before its output is activated.
    if ((primedContext !== audio || audio.state !== 'running' || gesture === 'touchend' && touchPrimedContext !== audio) && audio.createBufferSource && audio.createBuffer) {
      const prime = audio.createBufferSource(); prime.buffer = audio.createBuffer(1, 1, audio.sampleRate);
      prime.connect(audio.destination); prime.onended = () => prime.disconnect(); prime.start(); primedContext = audio;
      if (gesture === 'touchend') touchPrimedContext = audio;
    }
    if (audio.state !== 'running') await audio.resume();
    if (audio !== context || audio.state !== 'running') return false;
    const queued = pendingCue; pendingCue = null;
    if (queued && queued.generation === generation && performance.now() < queued.expiresAt) playGameSound(queued.kind, queued.userId, queued.eventId);
    return true;
  } catch { return false; }
};
export const playGameSound = (kind, userId, eventId = null) => {
  if (!cues[kind] || String(userId) !== ownerId || !gameSoundsEnabled(userId) || document.visibilityState !== 'visible') return false;
  const key = eventId ? `${userId}:${kind}:${eventId}` : null;
  if ((key && played.has(key)) || performance.now() - lastPlayed < 900) return false;
  if (usesMobileGameAudio()) {
    if (!mobile?.ready()) {
      if (mobile) { pendingCue = { kind, userId, eventId, generation, expiresAt: performance.now() + 1200 }; void unlockGameAudio(); }
      return false;
    }
    if (!mobile.play(kind)) return false;
    const owner = generation;
    void mobile.confirmation().then(ok => { if (!ok && key && owner === generation) played.delete(key); });
    lastPlayed = performance.now();
    if (key) { played.add(key); if (played.size > 200) played.delete(played.values().next().value); }
    return true;
  }
  if (context?.state !== 'running') {
    // Never queue historical page-load events before a real audio activation.
    // Keep only one fresh confirmation through a brief suspension/interruption.
    if (context && context.state !== 'closed') {
      pendingCue = { kind, userId, eventId, generation, expiresAt: performance.now() + 1200 };
      void unlockGameAudio();
    }
    return false;
  }
  try {
    const at = context.currentTime;
    for (const [frequency, endFrequency, delay, duration, volume, waveform] of cues[kind]) {
      const oscillator = context.createOscillator(), gain = context.createGain(), filter = context.createBiquadFilter();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, at + delay);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + delay + duration);
      filter.type = 'lowpass'; filter.frequency.value = 1600; filter.Q.value = .5;
      gain.gain.setValueAtTime(.0001, at + delay);
      gain.gain.linearRampToValueAtTime(volume, at + delay + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, at + delay + duration);
      oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination);
      const sound = { oscillator, gain }; active.add(sound);
      oscillator.onended = () => { active.delete(sound); oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
      oscillator.start(at + delay); oscillator.stop(at + delay + duration + .015);
    }
    lastPlayed = performance.now();
    if (key) { played.add(key); if (played.size > 200) played.delete(played.values().next().value); }
    return true;
  } catch { silenceGameSounds(); return false; }
};
export const previewGameSound = async userId => {
  if (String(userId) !== ownerId || !gameSoundsEnabled(userId) || document.visibilityState !== 'visible') return false;
  const owner = generation;
  if (!await unlockGameAudio() || generation !== owner || !gameSoundsEnabled(userId) || document.visibilityState !== 'visible') return false;
  // A deliberate preview may immediately follow the enable confirmation.
  silenceGameSounds();
  lastPlayed = -Infinity;
  if (!playGameSound('preview', userId)) return false;
  return mobile && usesMobileGameAudio() ? mobile.confirmation() : true;
};
