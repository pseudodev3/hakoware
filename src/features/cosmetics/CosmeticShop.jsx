import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bookmark, Check, Layers, Palette, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { COSMETIC_PACKS, collectionFor } from '../../lib/cosmetics';
import { getStyleShop, saveStyleCollection } from '../../services/cosmeticService';
import { saveProfilePresentation } from '../../services/presentationService';
import { CardArtwork } from '../cards/CardArtwork';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { Button } from '../../shared/components/Button';
import { ViewTabs } from '../../shared/components/ViewTabs';
import '../../shared/components/ProfileDecoration.css';
import './CosmeticShop.css';

const CARDS = [['SIGNAL_FLARE', 'Signal Flare'], ['PURIFY', 'Clean Slate'], ['CHAOS_TICKET', 'Chaos Ticket'], ['STEAL', 'Claim']];
const PackArt = ({ pack }) => <div className={`shop-pack-art ${pack.bundle ? 'is-bundle' : ''}`} data-shop-edition={pack.id} aria-hidden="true">
  {collectionFor(pack).map((edition, index) => <CardArtwork key={edition.id} cardId={pack.bundle ? CARDS[index][0] : 'SIGNAL_FLARE'} finishId={edition.finishId} size={pack.bundle ? 76 : 114} />)}
  {!pack.bundle && <><span className="shop-art-rule" /><small>{pack.number} / HAKOWARE EDITIONS</small></>}
</div>;

export const CosmeticShop = ({ onChanged, onBusyChange }) => {
  const { user, refreshUser } = useAuth();
  const userId = String(user?.uid || user?.id || user?._id || '');
  const uid = useId().replaceAll(':', '');
  const [shop, setShop] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [filter, setFilter] = useState('all'), [selectedId, setSelectedId] = useState(null), [editionId, setEditionId] = useState('nocturne');
  const [previewCard, setPreviewCard] = useState('SIGNAL_FLARE'), [busy, setBusy] = useState(null), [notice, setNotice] = useState('');
  const root = useRef(null), detailHeading = useRef(null), previous = useRef(null);
  const alive = useRef(true), request = useRef(0), owner = useRef({ userId }), busyRef = useRef(false);
  const load = useCallback(async () => {
    const current = ++request.current;
    try { const data = await getStyleShop(); if (alive.current && current === request.current) { setShop(data); setError(''); } }
    catch (failure) { if (alive.current && current === request.current) setError(failure.message || 'Could not confirm your saved collections.'); }
    finally { if (alive.current && current === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true; owner.current = { userId }; busyRef.current = false; setBusy(null); setShop(null); setLoading(true); setError(''); setNotice(''); setSelectedId(null); setFilter('all'); void load();
    return () => { alive.current = false; request.current += 1; };
  }, [userId, load]);
  useEffect(() => { onBusyChange?.(Boolean(busy)); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (selectedId) { detailHeading.current?.focus({ preventScroll: true }); detailHeading.current?.scrollIntoView({ block: 'nearest' }); }
      else if (previous.current) (root.current?.querySelector(`[data-open-pack="${previous.current}"]`) || root.current?.querySelector('[role="tab"][aria-selected="true"]'))?.focus();
      previous.current = selectedId;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);
  const packs = shop?.packs || COSMETIC_PACKS;
  const selected = packs.find(pack => pack.id === selectedId);
  const edition = collectionFor(selected).find(pack => pack.id === editionId) || collectionFor(selected)[0];
  const savedCount = packs.filter(pack => pack.saved).length;
  const visible = filter === 'saved' ? packs.filter(pack => pack.saved) : packs;
  const open = pack => { if (busyRef.current) return; setSelectedId(pack.id); setEditionId(collectionFor(pack)[0].id); setPreviewCard('SIGNAL_FLARE'); if (shop) setError(''); setNotice(''); };
  const wish = async pack => {
    if (busyRef.current || !shop) return;
    const actor = owner.current; busyRef.current = true; request.current += 1; setBusy({ kind: 'save', id: pack.id }); setError(''); setNotice('');
    try {
      const result = await saveStyleCollection(pack.id, !pack.saved);
      if (!alive.current || actor !== owner.current) return;
      setShop(result.shop); setNotice(pack.saved ? `${pack.name} removed from your list.` : `${pack.name} saved for launch.`);
    } catch (failure) {
      if (alive.current && actor === owner.current) { setError(failure.message || 'Could not confirm your saved collections.'); void load(); }
    } finally { if (actor === owner.current) { busyRef.current = false; if (alive.current) setBusy(null); } }
  };
  const apply = async () => {
    if (busyRef.current || !selected?.owned || !edition) return;
    const actor = owner.current; busyRef.current = true; setBusy({ kind: 'apply', id: selected.id }); setError('');
    try {
      await saveProfilePresentation({ avatarFrame: edition.frameId, cardFinish: edition.finishId, profileDecoration: edition.decorationId });
      if (!alive.current || actor !== owner.current) return;
      const account = await refreshUser();
      if (!alive.current || actor !== owner.current) return;
      if (!account.success) throw new Error('Your style is saved. Refresh your profile to see it.');
      await onChanged?.();
      if (alive.current && actor === owner.current) setNotice(`${edition.name} is now your signature.`);
    } catch (failure) { if (alive.current && actor === owner.current) setError(failure.message || 'Could not apply that edition.'); }
    finally { if (actor === owner.current) { busyRef.current = false; if (alive.current) setBusy(null); } }
  };
  const saveButton = pack => <button type="button" className={`shop-save ${pack.saved ? 'is-saved' : ''}`} aria-pressed={Boolean(pack.saved)} aria-label={`${pack.saved ? 'Remove' : 'Save'} ${pack.name} ${pack.saved ? 'from your list' : 'for launch'}`} disabled={!shop || Boolean(busy)} onClick={() => void wish(pack)}><Bookmark size={17} fill={pack.saved ? 'currentColor' : 'none'} /><span>{busy?.kind === 'save' && busy.id === pack.id ? 'Saving…' : pack.saved ? 'Saved' : 'Save for launch'}</span></button>;
  return <section ref={root} className="cosmetic-shop" aria-label="Style shop">
    {!selected ? <>
      <div className="shop-hero"><div className="shop-hero-copy"><p className="eyebrow">HAKOWARE / EDITIONS 01–03</p><h2>Your signature,<br /><em>collected.</em></h2><p>Card finishes, avatar frames and profile backdrops. Find the edition that feels like you.</p><span className="shop-launch-note"><Sparkles size={14} />First-drop preview · Not yet on sale</span></div><div className="shop-hero-art" aria-hidden="true"><CardArtwork cardId="PURIFY" finishId="porcelain" size={90} /><CardArtwork cardId="SIGNAL_FLARE" finishId="nocturne" size={112} /><CardArtwork cardId="CHAOS_TICKET" finishId="prism" size={90} /></div></div>
      <ViewTabs id={`shop-${uid}`} label="Shop collections" className="shop-tabs" value={filter} onChange={setFilter} items={[{ value: 'all', label: 'Collections' }, { value: 'saved', label: 'Saved', count: savedCount }]} />
      <div role="tabpanel" id={`shop-${uid}-panel-${filter}`} aria-labelledby={`shop-${uid}-tab-${filter}`}>
        {visible.length ? <div className="shop-grid">{visible.map(pack => <article key={pack.id} className="shop-pack" style={{ '--shop-accent': pack.accent }}>
          <button type="button" className="shop-pack-preview" data-open-pack={pack.id} aria-label={`Preview ${pack.name}`} onClick={() => open(pack)}><PackArt pack={pack} /></button>
          <div className="shop-pack-caption"><span>{pack.bundle ? 'THE FULL COLLECTION' : `EDITION ${pack.number}`}</span>{pack.owned && <small><Check size={12} />Owned</small>}</div><h3>{pack.name}</h3><p>{pack.headline}</p><small className="shop-pack-includes">{pack.bundle ? '3 finishes · 3 frames · 3 backdrops' : 'Deck finish · Avatar frame · Profile backdrop'}</small>
          <div className="shop-pack-actions"><button type="button" onClick={() => open(pack)}>{pack.owned ? 'Wear this edition' : 'Explore the collection'}<ArrowUpRight size={16} /></button>{saveButton(pack)}</div>
        </article>)}</div> : <div className="shop-empty"><Bookmark size={26} /><h3>Keep your favourites here.</h3><p>Save an edition and come back to it when the shop opens.</p><button type="button" onClick={() => setFilter('all')}>Browse collections<ArrowUpRight size={16} /></button></div>}
      </div>
      <p className="shop-footnote">Each edition is a permanent cosmetic pack. Your cards and game progress stay yours. Prices will be shown when sales open.</p>
    </> : <>
      <button className="shop-back" type="button" disabled={Boolean(busy)} onClick={() => setSelectedId(null)}><ArrowLeft size={17} />All collections</button>
      <div className="shop-detail-heading"><p className="eyebrow">{selected.bundle ? 'THE COMPLETE SET' : `EDITION ${selected.number}`}</p><h2 ref={detailHeading} tabIndex={-1}>{selected.name}</h2><p>{selected.description}</p></div>
      {selected.bundle && <div className="shop-edition-switch" role="group" aria-label="Preview an edition">{collectionFor(selected).map(pack => <button type="button" key={pack.id} aria-pressed={edition.id === pack.id} onClick={() => setEditionId(pack.id)}>{pack.name}</button>)}</div>}
      <div className="shop-detail-grid"><div className={`shop-card-stage edition-${edition.id}`}><CardArtwork cardId={previewCard} finishId={edition.finishId} size={176} /><span>{edition.name} / DECK FINISH</span></div><div className="shop-detail-copy">
        <label htmlFor={`shop-card-${uid}`}>Try it on a card</label><select id={`shop-card-${uid}`} value={previewCard} onChange={event => setPreviewCard(event.target.value)}>{CARDS.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
        <div className="shop-profile-preview" data-profile-decoration={edition.decorationId}><UserAvatar person={{ ...user, avatarFrame: edition.frameId }} size="lg" decorative /><span><strong>{user.displayName}</strong><small>{user.username ? '@' + user.username : 'Your profile'}<br />{edition.name} frame + backdrop</small></span></div>
        <div className="shop-included"><h3>In the collection</h3><p><Layers size={16} />{selected.bundle ? 'All three finishes for your whole collection' : 'A finish for every card in your collection'}</p><p><Sparkles size={16} />{selected.bundle ? 'Gilt, Prismatic and Ceramic avatar frames' : 'A signature avatar frame'}</p><p><Palette size={16} />{selected.bundle ? 'All three profile backdrops' : 'A matching profile backdrop'}</p><p><Check size={16} />Permanent style unlocks when purchased</p></div>
        <div className="shop-detail-actions">{selected.owned ? <Button variant="aura" disabled={Boolean(busy)} loading={busy?.kind === 'apply'} onClick={() => void apply()}>Wear {edition.name}</Button> : <><p>Preview only. Purchases open later.</p>{saveButton(selected)}</>}</div>
      </div></div>
    </>}
    {loading && <p className="shop-status" role="status">Opening your saved collections…</p>}
    {notice && <p className="shop-status" role="status">{notice}</p>}
    {error && <p className="shop-error" role="alert">{error}<button type="button" disabled={Boolean(busy)} onClick={() => void load()}>Refresh shop</button></p>}
  </section>;
};
