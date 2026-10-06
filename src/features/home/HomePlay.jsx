import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Layers } from 'lucide-react';
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
  }, [user._id, user.uid]);

  const owned = collection?.cards.filter((card) => card.owned > 0) || [];
  const art = owned.length ? owned.slice(0, 3).map((card) => card.id) : ['SIGNAL_FLARE', 'PURIFY', 'CHAOS_TICKET'];
  const tools = collection?.cards.filter((card) => card.purchasable ?? card.kind === 'SPELL') || [];
  const discovered = tools.filter((card) => card.discovered).length;
  const received = collection?.trades.filter((trade) => trade.status === 'PENDING' && !trade.mine).length || 0;

  return <section className="home-play" aria-label="Cards and exchanges">
    <div className="home-play-heading"><h2>Cards & exchanges.</h2><span>Use a tool. Trade a spare.</span></div>
    <div className="home-play-tiles">
      <button type="button" className="home-play-tile home-play-cards" onClick={() => onNavigate('arena', { section: 'cards', ...(received ? { focusTradeId: collection.trades.find((trade) => trade.status === 'PENDING' && !trade.mine).id } : {}) })}>
        <span className="home-play-tile-label"><Layers size={16} /> Your collection <ArrowUpRight size={17} /></span>
        <span className="home-play-art" aria-hidden="true">{art.map((id) => <CardArtwork key={id} cardId={id} size={38} />)}</span>
        <strong>{received ? `${received} offer${received === 1 ? '' : 's'} waiting.` : 'Keep a few tricks.'}</strong>
        <span className="home-play-copy">{collection ? `${discovered} of ${tools.length} tools collected.` : 'Earn Aura. Pick a tool. Trade a spare.'}</span>
        <span className="home-play-link">{received ? 'Check your offers' : 'Open collection'} <ArrowUpRight size={15} /></span>
      </button>
    </div>
  </section>;
};
