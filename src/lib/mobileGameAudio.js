import { clips } from './gameAudioClips.js';

export const usesMobileGameAudio = () => /iPad|iPhone|iPod/.test(window.navigator?.userAgent || '') || window.navigator?.platform === 'MacIntel' && window.navigator?.maxTouchPoints > 1;
export const createMobileGameAudio = () => {
  const audio = new window.Audio(new URL('../assets/game-cues.wav', import.meta.url).href);
  audio.preload = 'auto'; audio.playsInline = true; audio.loop = false;
  // Keep these short effects on the device's media output.
  audio.setAttribute('playsinline', ''); audio.setAttribute('disableRemotePlayback', '');
  let activated = false, unlocking = null, timer = null, serial = 0, clipEnd = null, lastPlay = Promise.resolve(false);
  const stop = () => { serial += 1; window.clearTimeout(timer); timer = null; clipEnd = null; audio.pause(); };
  audio.ontimeupdate = () => { if (clipEnd !== null && audio.currentTime >= clipEnd) stop(); };
  const unlock = () => {
    if (activated) return Promise.resolve(true);
    if (unlocking) return unlocking;
    const version = serial;
    // play() must run synchronously inside the gesture, before any await.
    try {
      audio.currentTime = 0;
      unlocking = Promise.resolve(audio.play()).then(() => {
        if (serial !== version) { audio.pause(); return false; }
        audio.pause(); activated = true; return true;
      }).catch(() => false).finally(() => { unlocking = null; });
      return unlocking;
    } catch { return Promise.resolve(false); }
  };
  const play = kind => {
    if (!activated || !clips[kind]) return false;
    stop(); const version = serial, clip = clips[kind];
    try {
      clipEnd = clip.start + clip.duration;
      audio.currentTime = clip.start;
      lastPlay = Promise.resolve(audio.play()).then(() => {
        if (serial !== version) return false;
        // Stop in the silent gap, before the following sprite can be heard.
        const remaining = Math.max(0, (clip.start + clip.duration - audio.currentTime) * 1000);
        timer = window.setTimeout(() => { if (serial === version) stop(); }, remaining + 15);
        return true;
      }).catch(() => { if (serial === version) activated = false; return false; });
      return true;
    } catch { activated = false; return false; }
  };
  return { unlock, play, stop, ready: () => activated, confirmation: () => lastPlay };
};
