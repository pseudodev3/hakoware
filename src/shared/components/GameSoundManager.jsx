import { useEffect } from 'react';
import { gameSoundsEnabled, setGameSoundOwner, silenceGameSounds, unlockGameAudio } from '../../lib/gameSounds';
export const GameSoundManager = ({ userId }) => {
  useEffect(() => {
    setGameSoundOwner(userId);
    const unlock = event => { if (event.isTrusted && gameSoundsEnabled(userId)) void unlockGameAudio(event.type); };
    const hide = () => { if (document.visibilityState !== 'visible') silenceGameSounds(); };
    const preference = event => { if (!gameSoundsEnabled(userId, event)) silenceGameSounds(); };
    const gestures = ['pointerup', 'touchend', 'keydown'];
    gestures.forEach(type => window.addEventListener(type, unlock, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', hide); window.addEventListener('storage', preference);
    return () => { gestures.forEach(type => window.removeEventListener(type, unlock, { capture: true })); document.removeEventListener('visibilitychange', hide); window.removeEventListener('storage', preference); setGameSoundOwner(null); };
  }, [userId]);
  return null;
};
