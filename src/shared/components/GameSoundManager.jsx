import { useEffect } from 'react';
import { gameSoundsEnabled, setGameSoundOwner, silenceGameSounds, unlockGameAudio } from '../../lib/gameSounds';
export const GameSoundManager = ({ userId }) => {
  useEffect(() => {
    setGameSoundOwner(userId);
    const unlock = event => { if (event.isTrusted && gameSoundsEnabled(userId)) void unlockGameAudio(); };
    const hide = () => { if (document.visibilityState !== 'visible') silenceGameSounds(); };
    const preference = () => { if (!gameSoundsEnabled(userId)) silenceGameSounds(); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock); document.addEventListener('visibilitychange', hide); window.addEventListener('storage', preference);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); document.removeEventListener('visibilitychange', hide); window.removeEventListener('storage', preference); setGameSoundOwner(null); };
  }, [userId]);
  return null;
};
