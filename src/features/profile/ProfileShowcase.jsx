import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, LockKeyhole, Palette, Sparkles } from 'lucide-react';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { DuoIdentity } from '../../shared/components/DuoIdentity';
import { CardArtwork } from '../cards/CardArtwork';
import { CosmeticShop } from '../cosmetics/CosmeticShop';
import { getProfilePresentation, saveProfilePresentation } from '../../services/presentationService';
import { duoLabel } from '../../lib/duoIdentity';
import '../../shared/components/ProfileDecoration.css';
import './ProfileShowcase.css';

export const ProfileShowcase = ({ user, onChanged, onNavigate }) => {
  const userId = user.uid || user.id || user._id;
  const [params, setParams] = useSearchParams();
  const returnOrderId = params.get('cosmetic_order');
  const [profile, setProfile] = useState(null), [panel, setPanel] = useState(null), [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false), [shopBusy, setShopBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), busyRef = useRef(false);
  const load = useCallback(async () => {
    const current = ++generation.current;
    try { const data = await getProfilePresentation(); if (current === generation.current) { setProfile(data); setError(''); } }
    catch (failure) { if (current === generation.current) setError(failure.message); }
  }, []);
  useEffect(() => { setProfile(null); setPanel(null); setBusy(false); setShopBusy(false); busyRef.current = false; void load(); return () => { generation.current += 1; }; }, [userId, load]);
  useEffect(() => { if (returnOrderId) setPanel('shop'); }, [returnOrderId]);
  const clearReturn = () => setParams(current => { const next = new URLSearchParams(current); next.delete('cosmetic_order'); next.delete('checkout'); return next; }, { replace: true });
  const edit = () => {
    if (!profile) return;
    setDraft({ avatarFrame: profile.avatarFrame, favoriteCardId: profile.favoriteCardId, featuredDuoId: profile.featuredDuoId, cardFinish: profile.cardFinish, profileDecoration: profile.profileDecoration }); setError(''); setPanel('edit');
  };
  const changed = async () => { await onChanged?.(); await load(); };
  const save = async event => {
    event.preventDefault(); if (busyRef.current) return;
    const current = ++generation.current; busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await saveProfilePresentation(draft);
      if (current !== generation.current) return;
      setProfile(result.profile); setPanel(null); await onChanged?.();
    } catch (failure) { if (current === generation.current) setError(failure.message); }
    finally { if (current === generation.current) { busyRef.current = false; setBusy(false); } }
  };
  const featured = profile?.duos.find(contract => String(contract._id) === profile.featuredDuoId) || profile?.duos.reduce((best, contract) => (contract.duoLevel || 1) > (best?.duoLevel || 0) ? contract : best, null);
  const favorite = profile?.cards.find(card => card.id === profile.favoriteCardId);
  const close = () => { if (!busyRef.current) setPanel(null); };
  return <section className="profile-showcase" aria-label="Your showcase">
    <header><div><p className="eyebrow">A little more you</p><h2>Your signature.</h2></div><div className="showcase-toolbar"><button type="button" disabled={!profile} onClick={edit}><Palette size={15} />Customize</button><button type="button" onClick={() => setPanel('shop')}><Sparkles size={15} />Style shop</button></div></header>
    {!profile ? <p className="showcase-status" role="status">{error || 'Opening your showcase…'}{error && <button type="button" onClick={() => void load()}>Retry</button>}</p> : <div className="showcase-grid">
      {featured ? <DuoIdentity friendship={featured} userId={userId} variant="card"><button type="button" className="showcase-duo-open" onClick={() => onNavigate?.('friend', { contractKey: featured.contractKey })}>Your featured Duo<ArrowUpRight size={16} /></button></DuoIdentity> : <div className="showcase-empty"><p>Your strongest Duo belongs here.</p><button type="button" onClick={() => onNavigate?.('contracts')}>Find your people<ArrowUpRight size={15} /></button></div>}
      <button type="button" className="showcase-card" onClick={edit}>{favorite ? <><CardArtwork cardId={favorite.id} size={88} finishId={profile.cardFinish} /><span><small>Signature card</small><strong>{favorite.name}</strong><p>{favorite.owned ? `${favorite.owned} ready to play` : favorite.reserved ? 'Reserved for trade' : 'From your collection'}</p></span></> : <><span className="showcase-card-back"><span>H</span></span><span><small>Signature card</small><strong>Pick your favourite.</strong><p>A card you’ve collected, a little personality.</p></span></>}<ArrowUpRight size={16} /></button>
    </div>}
    {panel === 'edit' && draft && <Modal isOpen title="Make your profile yours" size="lg" onClose={close}><form className="showcase-form" onSubmit={save}>
      <div className="showcase-frame-preview" data-profile-decoration={draft.profileDecoration}><UserAvatar person={{ ...user, avatarFrame: draft.avatarFrame }} size="lg" /><span><strong>{user.displayName}</strong><small>Your frame, your backdrop, your signature.</small></span></div>
      <fieldset><legend>Avatar frame</legend><div className="showcase-frames">{profile.frames.map(frame => <button key={frame.id} type="button" aria-label={`${frame.name} avatar frame`} aria-pressed={draft.avatarFrame === frame.id} disabled={busy || !frame.unlocked} onClick={() => setDraft({ ...draft, avatarFrame: frame.id })}><UserAvatar person={{ ...user, avatarFrame: frame.id }} size="sm" decorative /><strong>{frame.name}</strong><small>{frame.unlocked ? 'Available' : frame.level ? <><LockKeyhole size={10} />Duo Lv. {frame.level}</> : <><LockKeyhole size={10} />Shop edition</>}</small></button>)}</div></fieldset>
      <fieldset><legend>Card finish</legend><div className="showcase-finishes">{profile.finishes.map(finish => <button type="button" key={finish.id} aria-label={`${finish.name} card finish`} aria-pressed={draft.cardFinish === finish.id} disabled={busy || !finish.unlocked} onClick={() => setDraft({ ...draft, cardFinish: finish.id })}><CardArtwork cardId={draft.favoriteCardId || 'SIGNAL_FLARE'} finishId={finish.id} size={52} /><strong>{finish.name}</strong><small>{finish.unlocked ? 'Available' : 'Shop edition'}</small></button>)}</div></fieldset>
      <fieldset><legend>Profile backdrop</legend><div className="showcase-decorations">{profile.decorations.map(decoration => <button type="button" key={decoration.id} aria-pressed={draft.profileDecoration === decoration.id} disabled={busy || !decoration.unlocked} onClick={() => setDraft({ ...draft, profileDecoration: decoration.id })}><span className="showcase-decoration-swatch" data-profile-decoration={decoration.id} aria-hidden="true" /><span><strong>{decoration.name}</strong><small>{decoration.unlocked ? 'Available' : 'Shop edition'}</small></span></button>)}</div></fieldset>
      <button type="button" className="showcase-shop-link" disabled={busy} onClick={() => setPanel('shop')}><Sparkles size={16} />Preview editions in the style shop<ArrowUpRight size={16} /></button>
      <label htmlFor="showcase-favorite">Signature card</label><select id="showcase-favorite" disabled={busy} value={draft.favoriteCardId || ''} onChange={event => setDraft({ ...draft, favoriteCardId: event.target.value || null })}><option value="">No signature card</option>{profile.cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}</select>
      <label htmlFor="showcase-duo">Featured Duo</label><select id="showcase-duo" disabled={busy} value={draft.featuredDuoId || ''} onChange={event => setDraft({ ...draft, featuredDuoId: event.target.value || null })}><option value="">Use my strongest Duo</option>{profile.duos.map(contract => <option key={contract._id} value={contract._id}>{duoLabel(contract, `${contract.user1?.displayName} + ${contract.user2?.displayName}`)} · Lv. {contract.duoLevel || 1}</option>)}</select>
      {!profile.cards.length && <p>Collect your first card in the Arena to feature it here.</p>}{error && <p className="showcase-error" role="alert">{error}</p>}<div className="showcase-form-actions"><Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button><Button variant="aura" type="submit" loading={busy}>Save your signature</Button></div>
    </form></Modal>}
    {panel === 'shop' && <Modal isOpen title="Style shop" size="xl" onClose={() => { if (!shopBusy) { setPanel(null); if (returnOrderId) clearReturn(); } }}><CosmeticShop onChanged={changed} onBusyChange={setShopBusy} returnOrderId={returnOrderId} onClearReturn={clearReturn} /></Modal>}
  </section>;
};
