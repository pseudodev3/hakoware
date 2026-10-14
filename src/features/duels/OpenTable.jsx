import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CardArtwork } from '../cards/CardArtwork';
import { enterOpenTable, getOpenTable, leaveOpenTable } from '../../services/duelService';

export const OpenTable = ({ onNavigate }) => {
  const { user } = useAuth(), userId = String(user.uid || user.id || user._id);
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false), sequence = useRef(0), busyRef = useRef(false), seat = useRef(null), pending = useRef(null), navigate = useRef(onNavigate);
  navigate.current = onNavigate;
  const storageKey = `hakoware:open-table:${userId}`;
  const forgetPending = () => { pending.current = null; try { sessionStorage.removeItem(storageKey); } catch { /* The in-memory key remains enough for an active tab. */ } };
  const receive = useCallback((result, follow = false) => {
    const wasWaiting = seat.current?.status === 'WAITING';
    if (result.status !== 'IDLE') { pending.current = null; try { sessionStorage.removeItem(storageKey); } catch { /* The result confirms the pending request. */ } }
    seat.current = result; setData(result); setError(result.message || '');
    if (result.status === 'MATCHED' && (follow || wasWaiting)) navigate.current('arena', { section: 'duels', duelId: result.duelId });
  }, [storageKey]);
  const load = useCallback(async () => {
    if (busyRef.current) return;
    const request = ++sequence.current;
    try { const result = await getOpenTable(seat.current?.ticketId); if (alive.current && request === sequence.current) receive(result); }
    catch (err) { if (alive.current && request === sequence.current) setError(err.message || 'Could not check your table.'); }
  }, [receive]);
  useEffect(() => {
    alive.current = true; seat.current = null; pending.current = null; busyRef.current = false;
    setData(null); setBusy(false); setError('');
    try { pending.current = sessionStorage.getItem(storageKey); } catch { /* Storage is optional. */ }
    void load();
    const visible = () => { if (document.visibilityState === 'visible' && seat.current?.status === 'WAITING') void load(); };
    const interval = setInterval(visible, 5000);
    document.addEventListener('visibilitychange', visible);
    return () => { alive.current = false; sequence.current += 1; clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [userId, storageKey, load]);
  const act = async leave => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); const request = ++sequence.current;
    try {
      if (!leave && !pending.current) {
        pending.current = crypto.randomUUID();
        try { sessionStorage.setItem(storageKey, pending.current); } catch { /* Retry with the same in-memory key. */ }
      }
      const result = await (leave ? leaveOpenTable(seat.current.ticketId) : enterOpenTable(pending.current));
      if (!alive.current || request !== sequence.current) return;
      forgetPending(); receive(result, true);
    } catch (err) {
      if (alive.current && request === sequence.current) { if (err.status >= 400 && err.status < 500) forgetPending(); setError(err.message || 'Could not confirm your seat. Retry to check it.'); }
    } finally { if (alive.current && request === sequence.current) { busyRef.current = false; setBusy(false); } }
  };
  const waiting = data?.status === 'WAITING', ready = data?.status === 'MATCHED' && ['ACTIVE', 'INVITED'].includes(data.roundStatus);
  return <section className={`open-table ${waiting ? 'is-waiting' : ''}`} aria-label="Open table">
    <div className="open-table-copy"><p className="duel-kicker">Open table</p><h3>{waiting ? 'Your seat is open.' : ready ? 'Your round is waiting.' : 'New face. Same deck.'}</h3><p className="open-table-description">{waiting ? 'The next player to take a seat can join you. Keep this screen open; inactive seats close automatically.' : ready ? 'Pick up the round you started at the open table.' : 'Take a seat with another Hakoware player. Play a short duel. Keep the rivalry, or connect after the round.'}</p><div className="open-table-actions">{ready ? <button type="button" className="duel-primary" onClick={() => onNavigate('arena', { section: 'duels', duelId: data.duelId })}>Open your round</button> : <button type="button" className={waiting ? 'duel-text-action' : 'duel-primary'} disabled={!data || busy} onClick={() => void act(waiting)}>{busy ? waiting ? 'Leaving…' : 'Taking a seat…' : waiting ? 'Leave table' : 'Play someone new'}</button>}<span role="status">{!data ? error ? 'Table unavailable' : 'Checking the table…' : waiting ? 'Waiting for a player' : 'Free deck · No Aura at stake'}</span></div>{error && <div className="duel-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => void load()}>Check table</button></div>}</div>
    <div className="open-table-art" aria-hidden="true"><CardArtwork cardId="WATCHER" size={78} /><CardArtwork cardId="ORBIT" size={90} /><CardArtwork cardId="GHOST" size={78} /></div>
  </section>;
};
