const preferenceKey = userId => `hakoware:game-sounds:${userId}`;
let context = null;
let ownerId = null;
let lastPlayed = -Infinity;
const active = new Set();
const played = new Set();
export const setGameSoundOwner = userId => { silenceGameSounds(); ownerId = userId ? String(userId) : null; played.clear(); lastPlayed = -Infinity; };
// Frequency, final frequency, delay, duration, volume, waveform.
// Low, softly filtered tones keep these cues closer to a tactile gesture.
const cues = {
  preview: [[330, 330, 0, .13, .017, 'sine'], [440, 440, .11, .16, .015, 'sine']],
  card: [[210, 130, 0, .10, .022, 'triangle'], [390, 300, .035, .12, .009, 'sine']],
  trade: [[294, 294, 0, .12, .016, 'sine'], [440, 440, .10, .17, .015, 'sine']],
  bank: [[262, 262, 0, .12, .016, 'sine'], [330, 330, .09, .13, .013, 'sine']],
  DUO_LEVEL_UP: [[330, 330, 0, .14, .016, 'sine'], [440, 440, .10, .14, .014, 'sine'], [550, 550, .20, .19, .013, 'sine']],
  SEASON_COMPLETED: [[262, 262, 0, .19, .014, 'sine'], [330, 330, .06, .20, .012, 'sine'], [392, 392, .14, .25, .010, 'sine'], [524, 524, .25, .21, .009, 'sine']],
  SIGNAL_FLARE: [[165, 240, 0, .16, .018, 'triangle'], [330, 440, .11, .20, .012, 'sine']]
};
export const gameSoundsEnabled = userId => { if (!userId) return false; try { return localStorage.getItem(preferenceKey(userId)) === 'on'; } catch { return false; } };
export const silenceGameSounds = () => {
  for (const sound of active) { try {
    sound.gain.gain.cancelAndHoldAtTime(context.currentTime);
    sound.gain.gain.linearRampToValueAtTime(0, context.currentTime + .012);
    sound.oscillator.stop(context.currentTime + .015);
  } catch { try { sound.gain.gain.value = 0; sound.oscillator.stop(); } catch { /* Already silent. */ } } }
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
  if (!cues[kind] || String(userId) !== ownerId || !gameSoundsEnabled(userId) || document.visibilityState !== 'visible' || context?.state !== 'running') return false;
  const key = eventId ? `${userId}:${kind}:${eventId}` : null;
  if ((key && played.has(key)) || performance.now() - lastPlayed < 900) return false;
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
