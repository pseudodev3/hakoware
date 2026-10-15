import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { people, connectionAction } from '../../services/peopleService';
import './People.css';

export const DuelConnection = ({ person, onNavigate, compact = false }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false);
  useEffect(() => { alive.current = true; setData(null); people.person(person.username).then(value => { if (alive.current) setData(value); }).catch(err => { if (alive.current) setError(err.message); }); return () => { alive.current = false; }; }, [person.username, user._id, user.id, user.uid]);
  const act = async action => {
    if (busy || !data) return; setBusy(true); setError('');
    try { const connection = await connectionAction(String(user._id || user.id || user.uid), data.connection || { revision: 0, partner: person }, action); if (alive.current) setData(current => ({ ...current, connection })); }
    catch (err) { if (alive.current) setError(err.message); }
    finally { if (alive.current) setBusy(false); }
  };
  if (!data && !error || !compact && data?.connection?.status === 'CONNECTED') return null;
  return <aside className={`duel-connection ${compact ? 'is-compact' : ''}`}>{compact ? <h3>{person.displayName}</h3> : <><h2>Good game. Good company?</h2><p>Connect if you’d like to keep talking. Chat opens when you both accept.</p></>}{data?.connection?.status === 'CONNECTED' ? <button type="button" className="people-text-button" onClick={() => onNavigate('contracts', { section: 'connections', connectionId: data.connection.id })}>Open conversation</button> : data?.connection?.status === 'PENDING' ? data.connection.requestedByMe ? <p>Connection invitation sent.</p> : <button type="button" className="people-text-button" disabled={busy} onClick={() => void act('ACCEPT')}>Accept connection</button> : <button type="button" className="people-text-button" disabled={!data || busy} onClick={() => void act('REQUEST')}>{busy ? 'Inviting…' : `Connect with ${person.displayName}`}</button>}{error && <p role="alert" className="people-error">{error}</p>}</aside>;
};
