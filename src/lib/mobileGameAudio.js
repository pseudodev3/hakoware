import { activationClip, clips } from './gameAudioClips.js';

export const usesMobileGameAudio = () => /iPad|iPhone|iPod/.test(window.navigator?.userAgent || '') || window.navigator?.platform === 'MacIntel' && window.navigator?.maxTouchPoints > 1;
export const createMobileGameAudio = () => {
  const audio = new window.Audio(activationClip);
  audio.preload = 'auto'; audio.playsInline = true; audio.loop = false;
  // Keep these short effects on the device's media output.
  audio.setAttribute('playsinline', ''); audio.setAttribute('disableRemotePlayback', '');
  let activated = false, unlocking = null, serial = 0, lastPlay = Promise.resolve(false);
  const stop = () => { serial += 1; audio.pause(); };
  const unlock = () => {
    if (activated) return Promise.resolve(true);
    if (unlocking) return unlocking;
    const version = serial;
    // play() must run synchronously inside the gesture, before any await.
    try {
      audio.src = activationClip;
      unlocking = Promise.resolve(audio.play()).then(() => {
        if (serial !== version) return false;
        audio.pause(); activated = true; return true;
      }).catch(() => false).finally(() => { unlocking = null; });
      return unlocking;
    } catch { return Promise.resolve(false); }
  };
  const play = kind => {
    if (!activated || !clips[kind]) return false;
    stop(); const version = serial, clip = clips[kind];
    try {
      // Setting the source starts a new resource at zero even after an ended
      // cue. Keep this element: iOS grants media activation per element.
      audio.src = clip.src;
      lastPlay = Promise.resolve(audio.play()).then(() => {
        if (serial !== version) return false;
        return true;
      }).catch(() => { if (serial === version) activated = false; return false; });
      return true;
    } catch { activated = false; return false; }
  };
  return { unlock, play, stop, ready: () => activated, confirmation: () => lastPlay };
};
