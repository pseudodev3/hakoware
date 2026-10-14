import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { connectionAction } from '../../services/peopleService';
import { Shield } from 'lucide-react';

export const BlockedPeople = ({ variant = 'inline' }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false), [rows, setRows] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = async () => { try { const result = await api.get('/people/blocked'); if (alive.current) { setRows(result.connections); setError(''); } } catch (err) { if (alive.current) setError(err.message); } };
  const unblock = async connection => {
    if (busy) return; setBusy(true);
    try { await connectionAction(String(user._id || user.id || user.uid), connection, 'UNBLOCK'); await load(); }
    catch (err) { if (alive.current) setError(err.message); }
    finally { if (alive.current) setBusy(false); }
  };
  return <><button type="button" aria-label="Blocked people" className={variant === 'settings' ? 'privacy-row blocked-people-row' : 'people-text-button'} onClick={() => { setOpen(true); setRows(null); void load(); }}>{variant === 'settings' ? <><span className="privacy-icon"><Shield size={18} strokeWidth={1.6} /></span><span className="privacy-copy"><strong>Blocked people</strong><small>Review people you’ve blocked.</small></span></> : 'Blocked people'}</button>{open && <ActionSheet title="Blocked people" onClose={() => { if (!busy) setOpen(false); }}><p className="people-note">Unblocking allows you to find each other again. Connecting and playing still need a new invitation.</p>{rows?.map(connection => <div className="people-connection-row" key={connection.id}><div><strong>{connection.partner.displayName}</strong><small>@{connection.partner.username}</small></div><button type="button" className="people-text-button" disabled={busy} onClick={() => void unblock(connection)}>Unblock</button></div>)}{rows && !rows.length && <p className="people-note">No blocked people.</p>}{!rows && !error && <p role="status">Loading…</p>}{error && <p role="alert" className="people-error">{error}</p>}</ActionSheet>}</>;
};
