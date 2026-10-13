import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { gameSoundsEnabled, playGameSound, setGameSounds, unlockGameAudio } from '../../lib/gameSounds';
export const GameSoundSettings = ({ userId }) => {
  const [enabled, setEnabled] = useState(() => gameSoundsEnabled(userId));
  useEffect(() => {
    const update = () => setEnabled(gameSoundsEnabled(userId));
    update(); window.addEventListener('storage', update); window.addEventListener('hakoware-sound-preference', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('hakoware-sound-preference', update); };
  }, [userId]);
  const toggle = async () => {
    const next = !enabled; setGameSounds(userId, next);
    if (next && await unlockGameAudio()) playGameSound('preview', userId);
  };
  return <div className="game-sound-settings"><button className="privacy-row" type="button" role="switch" aria-checked={enabled} aria-label="Game sounds" onClick={() => void toggle()}>
    <span className="privacy-icon">{enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</span><span className="privacy-copy"><strong>Game sounds</strong><small>Quiet cues for shared wins, cards, and your bank. {enabled ? 'On for this account on this device.' : 'Off until you turn them on.'}</small></span><span className={`privacy-switch ${enabled ? 'on' : ''}`} aria-hidden="true"><i /></span>
  </button>{enabled && <button className="game-sound-preview" type="button" onClick={async () => { if (await unlockGameAudio()) playGameSound('preview', userId); }}>Try the sound <Volume2 size={14} /></button>}</div>;
};
