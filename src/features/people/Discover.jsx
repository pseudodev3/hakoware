import { useCallback, useEffect, useRef, useState } from 'react';
import { Swords } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { people, connectionAction } from '../../services/peopleService';
import { DiscoveryProfile } from './DiscoveryProfile';
import { intentLabel } from './peopleLabels';
import { PersonActions } from './PersonActions';

export const Discover = ({ onNavigate }) => {
  const { user } = useAuth(), userId = String(user._id || user.id || user.uid);
  const [data, setData] = useState(null), [intent, setIntent] = useState(''), [interest, setInterest] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true), [selected, setSelected] = useState(null), [busy, setBusy] = useState(false), [personError, setPersonError] = useState('');
  const alive = useRef(false), sequence = useRef(0), selectedRef = useRef(null);
  selectedRef.current = selected?.person.username;
  const load = useCallback(async after => {
    const request = ++sequence.current; setLoading(true); setError('');
    try { const result = await people.discover({ intent, interest, after }); if (alive.current && request === sequence.current) setData(current => ({ ...result, people: after ? [...(current?.people || []), ...result.people] : result.people })); }
    catch (err) { if (alive.current && request === sequence.current) setError(err.message); }
    finally { if (alive.current && request === sequence.current) setLoading(false); }
  }, [intent, interest]);
  useEffect(() => { alive.current = true; setSelected(null); setData(null); void load(); return () => { alive.current = false; sequence.current += 1; }; }, [load, userId]);
  const open = async person => {
    selectedRef.current = person.username; setSelected({ person, connection: null, loading: true }); setPersonError('');
    try { const result = await people.person(person.username); if (alive.current && selectedRef.current === person.username) setSelected({ ...result, loading: false }); }
    catch (err) { if (alive.current && selectedRef.current === person.username) { setPersonError(err.message); setSelected(current => ({ ...current, loading: false, unavailable: true })); } }
  };
  const act = async kind => {
    if (busy || !selected || selected.loading || selected.unavailable) return; setBusy(true); setPersonError(''); const username = selected.person.username;
    try {
      if (kind === 'DUEL') { const result = await people.prepareDuel(username); if (alive.current && selectedRef.current === username) onNavigate('arena', { section: 'duels', duelId: result.id }); }
      else { const connection = await connectionAction(userId, selected.connection || { revision: 0, partner: selected.person }, kind); if (alive.current && selectedRef.current === username) setSelected(current => ({ ...current, connection })); }
    } catch (err) { if (alive.current && selectedRef.current === username) { setPersonError(err.message); if (err.status === 409) { const latest = await people.person(username).catch(() => null); if (alive.current && selectedRef.current === username && latest) setSelected({ ...latest, loading: false }); } } }
    finally { if (alive.current) setBusy(false); }
  };
  return <section className="people-discover" aria-label="Discover people">
    <div className="people-intro"><p className="people-eyebrow">A new face. A good first round.</p><h1>Your next good connection.</h1><p>Start with a game. Stay for the conversation.</p></div>
    <DiscoveryProfile compact onSaved={() => void load()} />
    <div className="people-filters"><label>Here for<select value={intent} onChange={event => setIntent(event.target.value)}><option value="">Anything good</option>{Object.entries(intentLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Into<select value={interest} onChange={event => setInterest(event.target.value)}><option value="">All interests</option>{(data?.interests || []).map(value => <option key={value}>{value}</option>)}</select></label></div>
    {error && <div className="people-error" role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Try again</button></div>}
    {loading && !data && <p role="status" className="people-note">Finding your people…</p>}
    <div className="people-grid">{data?.people.map(person => <article key={person.username} className="people-person"><button className="people-person-open" type="button" onClick={() => void open(person)}><UserAvatar person={person} size="lg" decorative /><span className="people-person-copy"><strong>{person.displayName}</strong><small>@{person.username}</small><p>{person.bio || 'A fresh face at the table.'}</p></span></button><p className="people-intent">{intentLabel[person.intent]}</p><div className="people-tags">{person.interests.map(value => <span key={value}>{value}</span>)}</div><div className="people-person-footer"><button type="button" className="people-text-button" onClick={() => void open(person)}><Swords size={16} />Meet at the table</button><PersonActions person={person} onBlocked={() => void load()} /></div></article>)}</div>
    {!loading && data && !data.people.length && <div className="people-empty"><h2>{intent || interest ? 'No one with that mix yet.' : 'The circle is still growing.'}</h2><p>{intent || interest ? 'Try another interest or leave the filters open.' : 'Turn on your profile so the next person can find you. Only people who opt in appear here.'}</p>{(intent || interest) && <button type="button" className="people-text-button" onClick={() => { setIntent(''); setInterest(''); }}>Clear filters</button>}</div>}
    {data?.next && <button type="button" className="people-text-button" disabled={loading} onClick={() => void load(data.next)}>{loading ? 'Loading…' : 'More people'}</button>}
    {selected && <ActionSheet title={selected.person.displayName} onClose={() => { if (!busy) setSelected(null); }}><div className="people-person-detail"><UserAvatar person={selected.person} size="lg" decorative /><p>@{selected.person.username}</p><h2>{selected.person.bio || 'A good place to start is a game.'}</h2><div className="people-tags">{selected.person.interests?.map(value => <span key={value}>{value}</span>)}</div><p className="people-note">A duel uses a free deck. A connection opens chat after you both accept. You can choose to start a Duo later.</p><button type="button" className="people-primary" disabled={busy || selected.loading || selected.unavailable} onClick={() => void act('DUEL')}>Choose a duel</button>{selected.connection?.status === 'CONNECTED' ? <button type="button" className="people-text-button" onClick={() => onNavigate('contracts', { section: 'connections', connectionId: selected.connection.id })}>Open conversation</button> : selected.connection?.status === 'PENDING' ? selected.connection.requestedByMe ? <p className="people-note">Connection invitation sent.</p> : <button type="button" className="people-text-button" disabled={busy} onClick={() => void act('ACCEPT')}>Accept connection</button> : <button type="button" className="people-text-button" disabled={busy || selected.loading || selected.unavailable} onClick={() => void act('REQUEST')}>Invite to connect</button>}{personError && <p className="people-error" role="alert">{personError}</p>}</div></ActionSheet>}
  </section>;
};
