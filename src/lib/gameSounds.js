const preferenceKey = userId => `hakoware:game-sounds:${userId}`;
let context = null;
let ownerId = null;
let lastPlayed = 0;
const active = new Set();
const played = new Set();
export const setGameSoundOwner = userId => { silenceGameSounds(); ownerId = userId ? String(userId) : null; played.clear(); };
const notes = {
  preview: [[660, 0, .09], [880, .06, .12]],
  card: [[420, 0, .1], [630, .07, .14]],
  trade: [[440, 0, .12], [660, .08, .16]],
  bank: [[560, 0, .09], [840, .07, .14]],
  DUO_LEVEL_UP: [[440, 0, .14], [550, .09, .14], [660, .18, .22]],
  SEASON_COMPLETED: [[392, 0, .16], [494, .09, .16], [587, .18, .22], [784, .28, .24]],
  SIGNAL_FLARE: [[190, 0, .13], [285, .05, .18], [570, .15, .18]]
};
export const gameSoundsEnabled = userId => { if (!userId) return false; try { return localStorage.getItem(preferenceKey(userId)) === 'on'; } catch { return false; } };
export const silenceGameSounds = () => {
  for (const sound of active) { try { sound.gain.gain.cancelScheduledValues(context.currentTime); sound.gain.gain.setValueAtTime(0, context.currentTime); sound.oscillator.stop(); } catch { /* A finished note is already silent. */ } }
  active.clear();
};
export const setGameSounds = (userId, enabled) => {
  if (!userId) return;
  try { localStorage.setItem(preferenceKey(userId), enabled ? 'on' : 'off'); } catch { /* The browser may block device preferences. */ }
  if (!enabled) silenceGameSounds();
  window.dispatchEvent(new CustomEvent('hakoware-sound-preference', { detail: { userId: String(userId) } }));
};
export const unlockGameAudio = async () => {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!context || context.state === 'closed') context = new Audio();
    if (context.state !== 'running') await context.resume();
    return context.state === 'running';
  } catch { return false; }
};
export const playGameSound = (kind, userId, eventId = null) => {
  if (!notes[kind] || String(userId) !== ownerId || !gameSoundsEnabled(userId) || document.visibilityState !== 'visible' || context?.state !== 'running') return false;
  const key = eventId ? `${userId}:${kind}:${eventId}` : null;
  if (key && played.has(key) || performance.now() - lastPlayed < 250) return false;
  try {
    const at = context.currentTime;
    for (const [frequency, delay, duration] of notes[kind]) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, at + delay);
      gain.gain.linearRampToValueAtTime(.035, at + delay + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, at + delay + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      const sound = { oscillator, gain }; active.add(sound);
      oscillator.onended = () => { active.delete(sound); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at + delay); oscillator.stop(at + delay + duration + .015);
    }
    lastPlayed = performance.now();
    if (key) { played.add(key); if (played.size > 200) played.delete(played.values().next().value); }
    return true;
  } catch { silenceGameSounds(); return false; }
};
