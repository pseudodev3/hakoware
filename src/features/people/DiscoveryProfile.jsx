import { useEffect, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { people } from '../../services/peopleService';
import './People.css';
import { BlockedPeople } from './BlockedPeople';
import { intentLabel } from './peopleLabels';

export const DiscoveryProfile = ({ onSaved, compact = false }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null), [draft, setDraft] = useState(null), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    people.profile().then(result => { if (mounted.current) { setData(result); setError(''); } }).catch(err => { if (mounted.current) setError(err.message); });
    return () => { mounted.current = false; };
  }, [user._id, user.id, user.uid]);
  const edit = () => { setDraft({ ...data.profile, interests: [...data.profile.interests] }); setError(''); setEditing(true); };
  const save = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const result = await people.saveProfile(draft); if (mounted.current) { setData(result); setEditing(false); onSaved?.(); } }
    catch (err) { if (mounted.current) setError(err.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <section className={`discovery-profile ${compact ? 'is-compact' : ''}`} aria-label="Your Discover profile">
    <div>{!compact && <span className="people-eyebrow"><Compass size={14} />Discover</span>}<h2>{compact ? data?.profile.enabled ? 'You’re visible in Discover.' : 'Your profile is hidden.' : 'Give them a starting point.'}</h2><p>{data?.profile.enabled ? 'Your email and Aura stay private.' : 'Turn it on when you’re ready to meet someone.'}</p></div>
    <div className="discovery-profile-actions"><button type="button" className="people-text-button" disabled={!data} onClick={edit}>{data?.profile.enabled ? 'Edit your profile' : 'Set up your profile'}</button><BlockedPeople /></div>
    {error && !editing && <p role="alert">{error}</p>}
    {editing && <ActionSheet title="Your Discover profile" onClose={() => { if (!busy) setEditing(false); }}>
      <form className="people-profile-form" onSubmit={save}>
        <label className="people-visibility"><span><strong>Show me in Discover</strong><small>Only your avatar, name, bio and interests are shared.</small></span><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /></label>
        <label>About you<textarea maxLength={160} rows={3} value={draft.bio} placeholder="What are you into? Give someone a starting point." onChange={event => setDraft({ ...draft, bio: event.target.value })} /><small>{draft.bio.length}/160</small></label>
        <fieldset><legend>You’re here for</legend><div className="people-intent-options">{data.intents.map(value => <button key={value} type="button" aria-pressed={draft.intent === value} onClick={() => setDraft({ ...draft, intent: value })}>{intentLabel[value]}</button>)}</div></fieldset>
        <fieldset><legend>Your interests <small>Pick up to four</small></legend><div className="people-tags">{data.interests.map(value => <button key={value} type="button" aria-pressed={draft.interests.includes(value)} disabled={!draft.interests.includes(value) && draft.interests.length >= 4} onClick={() => setDraft({ ...draft, interests: draft.interests.includes(value) ? draft.interests.filter(item => item !== value) : [...draft.interests, value] })}>{value}</button>)}</div></fieldset>
        <p className="people-note">Turning Discover off stops new invitations from people you haven’t connected with. Existing connections and accepted rounds remain available.</p>
        {error && <p role="alert" className="people-error">{error}</p>}
        <button type="submit" className="people-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </ActionSheet>}
  </section>;
};
