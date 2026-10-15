import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../shared/components/Modal';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { PlayingCardBack } from '../cards/PlayingCardBack';

const StyleShop = lazy(() => import('../cosmetics/CosmeticShop').then(module => ({ default: module.CosmeticShop })));

export const DeckWardrobe = ({ userId }) => {
  const { refreshUser } = useAuth();
  const [shop,setShop] = useState(false), [shopBusy,setShopBusy] = useState(false);
  const [data,setData] = useState(null), [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const version = useRef(0), locked = useRef(false);
  const load = useCallback(async () => { const request = ++version.current; try { const result = await api.get('/duels/styles'); if (request === version.current) { setData(result); setError(''); } } catch (err) { if (request === version.current) setError(err.message); } }, []);
  useEffect(() => { setData(null); setOpen(false); void load(); return () => { version.current++; }; }, [userId,load]);
  const choose = async back => {
    if (locked.current || !back.unlocked) return; locked.current = true; setBusy(true); setError(''); const request = ++version.current;
    try { const result = await api.patch('/duels/styles',{ cardBack:back.id }); if (request === version.current) setData(result); }
    catch (err) { if (request === version.current) setError(err.message); }
    finally { locked.current = false; if (request === version.current) setBusy(false); }
  };
  const selected = data?.backs?.find(back => back.id === data.selected), next = data?.backs?.find(back => !back.packId && !back.unlocked);
  return <section className="deck-wardrobe" aria-label="Your card backs">
    <PlayingCardBack backId={data?.selected} size={48} decorative /><div><h3>Your side of the table.</h3><p>{selected ? `${selected.name}. Everyone across the table sees it.` : 'A card back with a little character.'}</p>{next && <small>{data.rewardedRounds} of {next.rounds} rewarded rounds toward {next.name}.</small>}</div><button type="button" className="duel-text-action" onClick={() => { setOpen(true); void load(); }}>Choose card back</button>
    {error && !open && <p className="duel-warning" role="alert">{error}</p>}
    {open && <ActionSheet title="Make the deck yours" onClose={() => { if (!busy) setOpen(false); }}>
      <p className="duel-rules-intro">Your card back is visible to everyone at your table. Earn a design through play, or wear a matching back from an edition you own.</p>
      {!data ? <p className="duel-loading" role="status">{error || 'Opening your card backs…'}<button type="button" className="duel-text-action" onClick={() => void load()}>Refresh designs</button></p> : <div className="deck-back-grid" role="group" aria-label="Choose your card back">{data.backs.map(back => <button type="button" key={back.id} className={data.selected === back.id ? 'is-selected' : ''} aria-pressed={data.selected === back.id} aria-label={`${back.name} card back${back.unlocked ? '' : ', locked'}`} disabled={busy || !back.unlocked} onClick={() => void choose(back)}><PlayingCardBack backId={back.id} size={84} decorative /><strong>{back.name}</strong><small>{data.selected === back.id ? <><Check size={12} />At your table</> : back.unlocked ? 'Ready to wear' : back.packId ? <><LockKeyhole size={11} />{back.name} edition</> : `${data.rewardedRounds} of ${back.rounds} rewarded rounds`}</small></button>)}</div>}
      {error && data && <p className="duel-warning" role="alert">{error}</p>}
      <button type="button" className="duel-text-action" disabled={busy} onClick={() => { setOpen(false); setShop(true); }}>Explore editions in the style shop</button>
      {busy && <p className="duel-choice-hint" role="status">Saving your card back…</p>}
    </ActionSheet>}
    {shop && <Modal isOpen title="Style shop" size="xl" onClose={() => { if (!shopBusy) setShop(false); }}><Suspense fallback={<p role="status">Opening editions…</p>}><StyleShop onChanged={async () => { await refreshUser(); await load(); }} onBusyChange={setShopBusy} /></Suspense></Modal>}
  </section>;
};
