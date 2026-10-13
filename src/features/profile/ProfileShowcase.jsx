import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LockKeyhole, Palette } from 'lucide-react';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { DuoIdentity } from '../../shared/components/DuoIdentity';
import { CardArtwork } from '../cards/CardArtwork';
import { getProfilePresentation, saveProfilePresentation } from '../../services/presentationService';
import { duoLabel } from '../../lib/duoIdentity';
import './ProfileShowcase.css';
import { usePresentationViewport } from '../../shared/hooks/usePresentationViewport';

export const ProfileShowcase = ({ user, onChanged, onNavigate }) => {
  const userId = user.uid || user.id || user._id;
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);
  usePresentationViewport(open);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => { const current = ++generation.current; try { const data = await getProfilePresentation(); if (current === generation.current) { setProfile(data); setError(''); } } catch (failure) { if (current === generation.current) setError(failure.message); } }, []);
  useEffect(() => { setProfile(null); setOpen(false); setBusy(false); void load(); return () => { generation.current += 1; }; }, [userId, load]);
  const edit = () => { setDraft({ avatarFrame: profile.avatarFrame, favoriteCardId: profile.favoriteCardId, featuredDuoId: profile.featuredDuoId }); setError(''); setOpen(true); };
  const featured = profile?.duos.find(contract => String(contract._id) === profile.featuredDuoId) || profile?.duos.reduce((best, contract) => (contract.duoLevel || 1) > (best?.duoLevel || 0) ? contract : best, null);
  const favorite = profile?.cards.find(card => card.id === profile.favoriteCardId);
  return <section className="profile-showcase" aria-label="Your showcase"><header><div><p className="eyebrow">A little more you</p><h2>Your signature.</h2></div><button type="button" disabled={!profile} onClick={edit}><Palette size={15} />Customize</button></header>
    {!profile ? <p className="showcase-status" role="status">{error || 'Opening your showcase…'}{error && <button type="button" onClick={() => void load()}>Retry</button>}</p> : <div className="showcase-grid">
      {featured ? <DuoIdentity friendship={featured} userId={userId} variant="card"><button type="button" className="showcase-duo-open" onClick={() => onNavigate?.('friend', { contractKey: featured.contractKey })}>Your featured Duo<ArrowUpRight size={16} /></button></DuoIdentity> : <div className="showcase-empty"><p>Your strongest Duo belongs here.</p><button type="button" onClick={() => onNavigate?.('contracts')}>Find your people<ArrowUpRight size={15} /></button></div>}
      <button type="button" className="showcase-card" onClick={edit}>{favorite ? <><CardArtwork cardId={favorite.id} size={88} /><span><small>Signature card</small><strong>{favorite.name}</strong><p>{favorite.owned ? `${favorite.owned} ready to play` : favorite.reserved ? 'Reserved for trade' : 'From your collection'}</p></span></> : <><span className="showcase-card-back"><span>H</span></span><span><small>Signature card</small><strong>Pick your favourite.</strong><p>A card you’ve collected, a little personality.</p></span></>}<ArrowUpRight size={16} /></button>
    </div>}
    {open && draft && <Modal isOpen title="Make your profile yours" onClose={() => { if (!busy) setOpen(false); }}><form className="showcase-form" onSubmit={async event => { event.preventDefault(); if (busy) return; const current = ++generation.current; setBusy(true); setError(''); try { const result = await saveProfilePresentation(draft); if (current === generation.current) { setProfile(result.profile); setOpen(false); void onChanged?.(); } } catch (failure) { if (current === generation.current) setError(failure.message); } finally { if (current === generation.current) setBusy(false); } }}>
      <div className="showcase-frame-preview"><UserAvatar person={{ ...user, avatarFrame: draft.avatarFrame }} size="lg" /><span><strong>{user.displayName}</strong><small>Frames are earned through real Duo levels.</small></span></div>
      <fieldset><legend>Avatar frame</legend><div className="showcase-frames">{profile.frames.map(frame => <button key={frame.id} type="button" aria-pressed={draft.avatarFrame === frame.id} disabled={busy || !frame.unlocked} onClick={() => setDraft({ ...draft, avatarFrame: frame.id })}><UserAvatar person={{ ...user, avatarFrame: frame.id }} size="sm" decorative /><strong>{frame.name}</strong><small>{frame.unlocked ? 'Unlocked' : <><LockKeyhole size={10} />Duo Lv. {frame.level}</>}</small></button>)}</div></fieldset>
      <label htmlFor="showcase-favorite">Signature card</label><select id="showcase-favorite" disabled={busy} value={draft.favoriteCardId || ''} onChange={event => setDraft({ ...draft, favoriteCardId: event.target.value || null })}><option value="">No signature card</option>{profile.cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}</select>
      <label htmlFor="showcase-duo">Featured Duo</label><select id="showcase-duo" disabled={busy} value={draft.featuredDuoId || ''} onChange={event => setDraft({ ...draft, featuredDuoId: event.target.value || null })}><option value="">Use my strongest Duo</option>{profile.duos.map(contract => <option key={contract._id} value={contract._id}>{duoLabel(contract, `${contract.user1?.displayName} + ${contract.user2?.displayName}`)} · Lv. {contract.duoLevel || 1}</option>)}</select>
      {!profile.cards.length && <p>Collect your first card in the Arena to feature it here.</p>}{error && <p className="showcase-error" role="alert">{error}</p>}<div className="showcase-form-actions"><Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button variant="aura" type="submit" loading={busy}>Save your signature</Button></div>
    </form></Modal>}
  </section>;
};
