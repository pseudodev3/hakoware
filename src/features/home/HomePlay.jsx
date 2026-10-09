import React, { useEffect, useState } from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { getCardCollection } from '../../services/cardService';
import { CardArtwork } from '../cards/CardArtwork';
import './HomePlay.css';

export const HomePlay = ({ user, onNavigate }) => {
  const [collection, setCollection] = useState(null);
  useEffect(() => {
    let alive = true;
    let running = false;
    const load = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const next = await getCardCollection();
        if (alive) setCollection(next);
      } catch {
        // Keep the collection action available when its preview cannot load.
      } finally {
        running = false;
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [user._id, user.uid, user.id]);

  const tools = collection?.cards.filter((card) => card.purchasable ?? card.kind === 'SPELL') || [];
  const owned = collection?.cards.filter((card) => card.owned > 0 || card.reserved > 0) || [];
  const ownedTools = tools.filter((card) => card.owned > 0 || card.reserved > 0);
  const shelf = (ownedTools.length ? ownedTools : owned).slice(0, 2);
  const balance = collection?.balance ?? user.auraBalance;
  const received = collection?.trades.filter((trade) => trade.status === 'PENDING' && !trade.mine).length || 0;
  const openCollection = () => onNavigate('arena', { section: 'cards' });

  return <section className="home-play crew-collection" aria-label="Cards and exchanges">
    <div className="home-play-heading"><h2>Your cards</h2><button type="button" onClick={openCollection}>View collection <ArrowRight size={16} aria-hidden="true" /></button></div>
    <p className="home-play-copy">{collection ? `${ownedTools.length} of ${tools.length} tools owned` : 'Your collection'}{Number.isFinite(Number(balance)) && balance != null ? ` · ${Number(balance)} Aura` : ''}</p>
    {received > 0 && <button type="button" className="home-play-offers" onClick={() => onNavigate('arena', { section: 'cards', focusTradeId: collection.trades.find((trade) => trade.status === 'PENDING' && !trade.mine).id })}>{received} offer{received === 1 ? '' : 's'} waiting <ArrowRight size={16} aria-hidden="true" /></button>}
    <div className={`home-play-tiles ${shelf.length === 1 ? 'has-one' : ''}`}>
      {shelf.map((card) => <button type="button" key={card.id} className="home-play-tool" aria-label={`${card.name}. Open your collection`} onClick={openCollection}>
        <span className="home-play-tool-surface"><span className="home-play-tool-number">{String(card.number).padStart(2, '0')} / {card.series}</span><span className="home-play-tool-content"><CardArtwork cardId={card.id} size={72} /><span><strong>{card.name}</strong><small>{card.owned === 0 && card.reserved > 0 ? 'Reserved for trade' : card.kind === 'SPELL' ? 'Single-use tool' : 'Collectible'}</small></span></span></span>
      </button>)}
    </div>
    {!shelf.length && <button type="button" className="home-play-empty" onClick={openCollection}><Layers size={26} strokeWidth={1.5} aria-hidden="true" /><span><strong>{collection ? 'Keep a few tricks.' : 'Open your collection.'}</strong><small>{collection ? 'Earn Aura. Pick your first tool.' : 'Find your tools, collectibles and offers.'}</small></span><ArrowRight size={20} aria-hidden="true" /></button>}
  </section>;
};
