import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { enterOpenTable } from '../../services/duelService';

export const AuraMoment = ({ moment, name }) => moment ? <span className="aura-moment"><Sparkles size={15} aria-hidden="true" /><span><strong>{moment.name}</strong><small>{name ? `${name} · ` : ''}Aura moment</small></span></span> : null;
export const RoundFinish = ({ won, children, matchId }) => <section key={matchId} className={`round-finish ${won ? 'is-winner' : ''}`} aria-label="Round result">{children}</section>;

export const PlaySomeoneNew = ({ userId, onNavigate }) => {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const locked = useRef(false), key = useRef(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // A confirmed result is safe to follow; an unconfirmed request keeps its key.
  const find = async () => {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    const storageKey = `hakoware:open-table:${userId}`;
    if (!key.current) { try { key.current = sessionStorage.getItem(storageKey); } catch { /* Use the in-memory key. */ } key.current ||= crypto.randomUUID(); }
    try { sessionStorage.setItem(storageKey,key.current); } catch { /* The in-flight request retains its key. */ }
    try {
      const result = await enterOpenTable(key.current);
      try { if (sessionStorage.getItem(storageKey) === key.current) sessionStorage.removeItem(storageKey); } catch { /* No persisted request. */ }
      key.current = null;
      if (alive.current) onNavigate('arena',{ section:'duels', ...(result.status === 'MATCHED' ? { duelId:result.duelId } : {}) });
    } catch (err) { if (err.status >= 400 && err.status < 500) { try { if (sessionStorage.getItem(storageKey) === key.current) sessionStorage.removeItem(storageKey); } catch { /* No persisted key. */ } key.current = null; } if (alive.current) setError(err.message || 'Could not find your next table. Try again.'); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  return <div className="round-next-opponent"><button type="button" className="duel-text-action" disabled={busy} onClick={() => void find()}>{busy ? 'Finding your next table…' : 'Play someone new'}</button>{error && <p className="duel-warning" role="alert">{error}</p>}</div>;
};
