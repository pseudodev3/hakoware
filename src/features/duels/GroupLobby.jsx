import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { createTable, getTables, joinTable } from '../../services/tableService';

export const GroupLobby = ({ userId, onNavigate }) => {
  const [tables, setTables] = useState([]), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false), sequence = useRef(0), locked = useRef(false);
  useEffect(() => {
    alive.current = true;
    const load = async () => { const request = ++sequence.current; try { const data = await getTables(); if (alive.current && request === sequence.current) setTables(data.tables); } catch (err) { if (alive.current && request === sequence.current) setError(err.message); } };
    void load(); const visible = () => { if (document.visibilityState === 'visible' && !locked.current) void load(); };
    const interval = setInterval(visible, 30000); document.addEventListener('visibilitychange', visible);
    return () => { alive.current = false; sequence.current += 1; clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [userId]);
  const open = value => onNavigate('arena', { section: 'duels', duelId: `table_${value}` });
  const act = async join => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); sequence.current += 1;
    try { const result = await (join ? joinTable(userId, code.trim().toUpperCase()) : createTable(userId)); if (alive.current) open(result.id); }
    catch (err) { if (alive.current) setError(err.message || 'Could not open your table. Try again.'); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="group-lobby" aria-label="Group tables">
    <div className="group-lobby-heading"><div><h2>Group tables</h2><p>2–4 players. Invite the crew with a code.</p></div><Users size={32} strokeWidth={1.2} aria-hidden="true" /></div>
    <div className="group-lobby-actions"><button type="button" className="duel-primary" disabled={busy} onClick={() => void act(false)}>{busy ? 'Opening…' : 'Create table'}</button><form onSubmit={event => { event.preventDefault(); if (/^[A-F0-9]{12}$/i.test(code.trim())) void act(true); }}><label htmlFor="group-table-code">Join with a code</label><div><input id="group-table-code" value={code} onChange={event => setCode(event.target.value.replace(/\s/g, '').slice(0, 12))} maxLength={12} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="12-character code" /><button className="duel-text-action" type="submit" disabled={busy || !/^[A-F0-9]{12}$/i.test(code.trim())}>Join</button></div></form></div>
    {error && <p className="duel-warning" role="alert">{error}</p>}
    {tables.length > 0 && <div className="group-table-list">{tables.map(table => <button type="button" className="duel-room-row" key={table.id} onClick={() => open(table.id)}><Users size={21} aria-hidden="true" /><span><strong>{table.players.filter(player => !player.me).map(player => player.displayName).join(', ') || 'Your group table'}</strong><small>{table.status === 'WAITING' ? `${table.players.length} of 4 seats · Getting ready` : table.status === 'FINISHED' ? 'Round finished' : table.myTurn ? 'Your turn' : 'Round in play'}</small></span><span className={table.myTurn ? 'duel-row-ready' : ''}>{table.myTurn ? 'Play' : 'Open'}</span></button>)}</div>}
  </section>;
};
