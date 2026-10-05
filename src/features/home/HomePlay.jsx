import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Layers, Pencil, Radio } from 'lucide-react';
import { getCardCollection } from '../../services/cardService';
import { getRoomWall } from '../../services/roomWallService';
import { CardArtwork } from '../cards/CardArtwork';
import './HomePlay.css';

export const HomePlay = ({ user, onNavigate }) => {
  const [collection, setCollection] = useState(null);
  const [wall, setWall] = useState(null);
  useEffect(() => {
    let alive = true;
    let running = false;
    const load = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      const results = await Promise.allSettled([getCardCollection(), getRoomWall()]);
      if (alive) {
        if (results[0].status === 'fulfilled') setCollection(results[0].value);
        if (results[1].status === 'fulfilled') setWall(results[1].value);
      }
      running = false;
    };
    void load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [user._id, user.uid]);

  const owned = collection?.cards.filter((card) => card.owned > 0) || [];
  const art = owned.length ? owned.slice(0, 3).map((card) => card.id) : ['ORBIT', 'GHOST', 'SIGNAL_FLARE'];
  const discovered = collection?.cards.filter((card) => card.discovered).length || 0;
  const received = collection?.trades.filter((trade) => trade.status === 'PENDING' && !trade.mine).length || 0;
  const latestNote = wall?.pieces.filter((piece) => piece.kind === 'NOTE').at(-1);
  const marks = wall?.pieces.length;

  return <section className="home-play" aria-label="Things to make and share">
    <div className="home-play-heading"><h2>A little room to play.</h2><span>Even when it’s quiet.</span></div>
    <div className="home-play-tiles">
      <button type="button" className="home-play-tile home-play-cards" onClick={() => onNavigate('arena', { section: 'cards', ...(received ? { focusTradeId: collection.trades.find((trade) => trade.status === 'PENDING' && !trade.mine).id } : {}) })}>
        <span className="home-play-tile-label"><Layers size={16} /> Your collection <ArrowUpRight size={17} /></span>
        <span className="home-play-art" aria-hidden="true">{art.map((id) => <CardArtwork key={id} cardId={id} size={38} />)}</span>
        <strong>{received ? `${received} offer${received === 1 ? '' : 's'} waiting.` : 'Keep a few tricks.'}</strong>
        <span className="home-play-copy">{collection ? `${discovered} of ${collection.cards.length} collected. Find your next favorite.` : 'Collect a card. Stamp the wall. Trade a spare.'}</span>
        <span className="home-play-link">{received ? 'Check your offers' : 'Open collection'} <ArrowUpRight size={15} /></span>
      </button>
      <button type="button" className="home-play-tile home-play-wall" onClick={() => onNavigate('afterHours', { surface: 'wall' })}>
        <span className="home-play-tile-label"><Radio size={16} /> This week’s wall <ArrowUpRight size={17} /></span>
        <span className="home-play-wall-peek" aria-hidden="true">{latestNote ? <><q>{latestNote.text}</q><small>{latestNote.actor?.displayName || 'Someone'}</small></> : <Pencil size={32} strokeWidth={1.5} />}</span>
        <strong>{marks === 0 ? 'First mark is yours.' : 'Leave something behind.'}</strong>
        <span className="home-play-copy">{marks === undefined ? 'A note, a sketch, a stamp. Make it yours.' : marks ? `${marks} mark${marks === 1 ? '' : 's'} so far. There’s room for yours.` : 'A fresh wall. Your doodle could start something.'}</span>
        <span className="home-play-link">Leave your mark <ArrowUpRight size={15} /></span>
      </button>
    </div>
  </section>;
};
