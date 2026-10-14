import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { people, connectionAction } from '../../services/peopleService';

export const PersonActions = ({ person, onBlocked }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false), [mode, setMode] = useState('menu'), [reason, setReason] = useState('SPAM'), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  const blockContext = useRef(null);
  useEffect(() => { alive.current = true; blockContext.current = null; return () => { alive.current = false; }; }, [person.username]);
  const submit = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      if (mode === 'report') { await people.report(person.username, reason, note); if (alive.current) setMode('reported'); }
      else {
        if (!blockContext.current) { const data = await people.person(person.username); blockContext.current = data.connection || { revision: 0, partner: person }; }
        await connectionAction(String(user._id || user.id || user.uid), blockContext.current, 'BLOCK');
        if (alive.current) { setOpen(false); onBlocked?.(); }
      }
    } catch (err) { if (alive.current) setError(err.message); }
    finally { if (alive.current) setBusy(false); }
  };
  return <><button type="button" className="people-more" aria-label={`Options for ${person.displayName}`} onClick={() => { setMode('menu'); setError(''); setOpen(true); }}><MoreHorizontal size={22} /></button>
    {open && <ActionSheet title={mode === 'menu' ? person.displayName : mode === 'report' ? 'Report this person' : mode === 'reported' ? 'Report received' : 'Block this person?'} onClose={() => { if (!busy) setOpen(false); }}>
      {mode === 'menu' ? <div className="people-safety-menu"><button type="button" onClick={() => setMode('report')}>Report</button><button type="button" onClick={() => setMode('block')}>Block</button></div> : mode === 'reported' ? <p className="people-note">Your report is in the review queue. You can also block this person to end contact.</p> : mode === 'report' ? <div className="people-profile-form"><label>Reason<select value={reason} onChange={event => setReason(event.target.value)}>{[['SPAM', 'Spam'], ['HARASSMENT', 'Harassment'], ['INAPPROPRIATE', 'Inappropriate content'], ['OTHER', 'Something else']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>What happened?<textarea maxLength={500} rows={3} value={note} onChange={event => setNote(event.target.value)} /></label><button type="button" className="people-primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Sending…' : 'Send report'}</button></div> : <><p className="people-note">You won’t see each other in Discover. Casual duels and connection chat will close. Unblocking won’t restore the connection automatically.</p><button type="button" className="people-primary is-danger" disabled={busy} onClick={() => void submit()}>{busy ? 'Blocking…' : 'Block'}</button></>}
      {error && <p role="alert" className="people-error">{error}</p>}
    </ActionSheet>}
  </>;
};
