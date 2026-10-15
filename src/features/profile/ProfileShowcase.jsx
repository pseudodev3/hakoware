import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LockKeyhole, Palette, ShoppingBag } from 'lucide-react';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { CardArtwork } from '../cards/CardArtwork';
import { CosmeticShop } from '../cosmetics/CosmeticShop';
import { getProfilePresentation, saveProfilePresentation } from '../../services/presentationService';
import '../../shared/components/ProfileDecoration.css';
import './ProfileShowcase.css';

export const ProfileShowcase = ({ user, onChanged }) => {
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
    setDraft({ avatarFrame: profile.avatarFrame, cardFinish: profile.cardFinish, profileDecoration: profile.profileDecoration }); setError(''); setPanel('edit');
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
  const close = () => { if (!busyRef.current) setPanel(null); };
  return <section className="profile-showcase" aria-label="Your appearance">
    <header><div><h2>Your look</h2></div><div className="showcase-toolbar"><button type="button" disabled={!profile} onClick={edit}><Palette size={15} />Customize</button><button type="button" onClick={() => setPanel('shop')}><ShoppingBag size={15} aria-hidden="true" />Style shop</button></div></header>
    {!profile ? <p className="showcase-status" role="status">{error || 'Loading your styles…'}{error && <button type="button" onClick={() => void load()}>Retry</button>}</p> : <div className="profile-style-preview">
      <div className="profile-style-person" data-profile-decoration={profile.profileDecoration}><UserAvatar person={{ ...user, avatarFrame: profile.avatarFrame }} size="lg" decorative /><span><strong>{profile.frames.find(frame => frame.id === profile.avatarFrame)?.name || 'Original'} frame</strong><small>{profile.decorations.find(style => style.id === profile.profileDecoration)?.name || 'No backdrop'}</small></span></div>
      <div className="profile-style-finish"><div aria-hidden="true"><CardArtwork cardId="SIGNAL_FLARE" size={48} finishId={profile.cardFinish} /><CardArtwork cardId="ORBIT" size={48} finishId={profile.cardFinish} /></div><span><strong>{profile.finishes.find(style => style.id === profile.cardFinish)?.name || 'Classic'} finish</strong><small>On the cards in your collection</small></span></div>
    </div>}
    {panel === 'edit' && draft && <Modal isOpen title="Customize your look" size="lg" onClose={close}><form className="showcase-form" onSubmit={save}>
      <div className="showcase-frame-preview" data-profile-decoration={draft.profileDecoration}><UserAvatar person={{ ...user, avatarFrame: draft.avatarFrame }} size="lg" /><span><strong>{user.displayName}</strong><small>Your frame and backdrop.</small></span></div>
      <fieldset><legend>Avatar frame</legend><div className="showcase-frames">{profile.frames.map(frame => <button key={frame.id} type="button" aria-label={`${frame.name} avatar frame`} aria-pressed={draft.avatarFrame === frame.id} disabled={busy || !frame.unlocked} onClick={() => setDraft({ ...draft, avatarFrame: frame.id })}><UserAvatar person={{ ...user, avatarFrame: frame.id }} size="sm" decorative /><strong>{frame.name}</strong><small>{frame.unlocked ? 'Available' : frame.level ? <><LockKeyhole size={10} />Duo Lv. {frame.level}</> : <><LockKeyhole size={10} />Shop edition</>}</small></button>)}</div></fieldset>
      <fieldset><legend>Card finish</legend><div className="showcase-finishes">{profile.finishes.map(finish => <button type="button" key={finish.id} aria-label={`${finish.name} card finish`} aria-pressed={draft.cardFinish === finish.id} disabled={busy || !finish.unlocked} onClick={() => setDraft({ ...draft, cardFinish: finish.id })}><CardArtwork cardId="SIGNAL_FLARE" finishId={finish.id} size={52} /><strong>{finish.name}</strong><small>{finish.unlocked ? 'Available' : 'Shop edition'}</small></button>)}</div></fieldset>
      <fieldset><legend>Profile backdrop</legend><div className="showcase-decorations">{profile.decorations.map(decoration => <button type="button" key={decoration.id} aria-pressed={draft.profileDecoration === decoration.id} disabled={busy || !decoration.unlocked} onClick={() => setDraft({ ...draft, profileDecoration: decoration.id })}><span className="showcase-decoration-swatch" data-profile-decoration={decoration.id} aria-hidden="true" /><span><strong>{decoration.name}</strong><small>{decoration.unlocked ? 'Available' : 'Shop edition'}</small></span></button>)}</div></fieldset>
      <button type="button" className="showcase-shop-link" disabled={busy} onClick={() => setPanel('shop')}><ShoppingBag size={16} aria-hidden="true" />Preview editions in the style shop</button>
      {error && <p className="showcase-error" role="alert">{error}</p>}<div className="showcase-form-actions"><Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button><Button variant="aura" type="submit" loading={busy}>Save your look</Button></div>
    </form></Modal>}
    {panel === 'shop' && <Modal isOpen title="Style shop" size="xl" onClose={() => { if (!shopBusy) { setPanel(null); if (returnOrderId) clearReturn(); } }}><CosmeticShop onChanged={changed} onBusyChange={setShopBusy} returnOrderId={returnOrderId} onClearReturn={clearReturn} /></Modal>}
  </section>;
};
