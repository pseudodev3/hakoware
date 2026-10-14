import { useEffect, useState } from 'react';
import { Swords } from 'lucide-react';
import { getDuels } from '../../services/duelService';
import './Duels.css';

export const DuelReturn = ({ userId, onNavigate }) => {
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    let alive = true, sequence = 0;
    setRooms([]);
    const load = async () => {
      const request = ++sequence;
      try { const result = await getDuels(); if (alive && request === sequence) setRooms(result.rooms || []); }
      catch { /* Arena retains the explicit loading/error state. */ }
    };
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    void load(); const interval = setInterval(visible, 30000);
    window.addEventListener('hakoware-duels-refresh', visible);
    document.addEventListener('visibilitychange', visible);
    return () => { alive = false; sequence += 1; clearInterval(interval); window.removeEventListener('hakoware-duels-refresh', visible); document.removeEventListener('visibilitychange', visible); };
  }, [userId]);
  const ready = rooms.filter(room => room.myTurn || room.status === 'INVITED' && !room.invitedByMe).slice(0, 2);
  if (!ready.length) return null;
  return <section className="duel-return" aria-label="Your duels">{ready.map(room => <button type="button" key={room.id} onClick={() => onNavigate('arena', { section: 'duels', duelId: room.id })}>
    <Swords size={19} aria-hidden="true" /><span><strong>{room.myTurn ? 'Your next move' : 'A card duel?'}</strong><small>{room.partner.displayName}{room.myTurn ? ' is waiting at the table.' : ' invited you to play.'}</small></span><span className="duel-return-action">{room.myTurn ? 'Play' : 'Review'}</span>
  </button>)}</section>;
};
