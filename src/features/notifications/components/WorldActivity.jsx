import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Flame, Layers, Radio, RefreshCw, Trophy } from 'lucide-react';
import { getWorldActivity, markWorldActivityRead } from '../../../services/worldActivityService';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import './WorldActivity.css';

const details = event => {
  const name = event.actor?.displayName;
  switch (event.type) {
    case 'SIGNAL_FLARE': return { icon: Flame, label: 'Signal Flare', title: `${name || 'A player'} lit a Signal Flare.`, copy: 'A little pressure. A very visible entrance.', destination: 'cards' };
    case 'DUO_LEVEL_UP': return { icon: Layers, label: 'Duo milestone', title: `A Duo just reached Level ${event.value}.`, copy: 'Two people kept showing up. It adds up.', destination: null };
    case 'SEASON_COMPLETED': return { icon: Trophy, label: 'Season complete', title: `A Duo finished Season ${event.value}.`, copy: 'Another shared story in the books.', destination: null };
    default: return { icon: Trophy, label: 'Arena result', title: `${name || 'A hunter'} claimed a ${event.value} Aura bounty.`, copy: 'Pressure applied. Proof accepted.', destination: 'bounties' };
  }
};
const time = value => { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
export const WorldActivity = ({ onNavigate, onUnreadCountChange, onClose }) => {
  const [feed, setFeed] = useState({ events: [], hasMore: false, nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(null);
  const alive = useRef(true);
  const version = useRef(0);
  const feedRef = useRef(feed); feedRef.current = feed;
  const callback = useRef(onUnreadCountChange); callback.current = onUnreadCountChange;
  const load = useCallback(async (older = false, background = false) => {
    const request = ++version.current;
    try {
      const data = await getWorldActivity(older ? { before: feedRef.current.nextCursor } : {});
      if (!alive.current || request !== version.current) return;
      callback.current?.(data.unreadCount);
      if (background) { if (data.events.some(event => !feedRef.current.events.some(old => old.id === event.id))) setFresh(data); return; }
      setFeed(previous => older ? { ...data, events: [...new Map([...previous.events, ...data.events].map(event => [event.id, event])).values()] } : data); setFresh(null); setError('');
    } catch (failure) { if (alive.current && request === version.current && !background) setError(failure.message); }
    finally { if (alive.current && request === version.current && !background) setLoading(false); }
  }, []);
  useEffect(() => { alive.current = true; void load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(false, true); }, 60000); return () => { alive.current = false; version.current += 1; clearInterval(timer); }; }, [load]);
  useEffect(() => {
    if (!feed.events.length || document.visibilityState !== 'visible') return undefined;
    let active = true;
    void markWorldActivityRead(feed.events.map(event => event.id).slice(0, 50)).then(() => { window.dispatchEvent(new Event('hakoware-world-read')); return getWorldActivity({ limit: 1 }); }).then(data => { if (active) callback.current?.(data.unreadCount); }).catch(() => {});
    return () => { active = false; };
  }, [feed.events]);
  return <section className="world-activity" aria-label="Around Hakoware"><header><span><Radio size={16} />Around Hakoware</span><small>Last 7 days</small><button type="button" aria-label="Refresh world activity" disabled={loading} onClick={() => void load()}><RefreshCw size={16} /></button></header>
    <p className="world-activity-intro">The big little moments happening across the game.</p>
    {fresh && <button className="world-new" type="button" onClick={() => { setFeed(fresh); setFresh(null); }}>New things happening <ArrowRight size={15} /></button>}
    {error && <div className="activity-sync-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}
    {loading && !feed.events.length && <p className="world-loading" role="status">Opening the board…</p>}
    {!loading && !error && !feed.events.length && <div className="world-empty"><Radio size={30} /><h3>A quiet moment.</h3><p>Signal Flares, Duo milestones, and Arena results will appear here as they happen.</p></div>}
    <div className="world-event-list">{feed.events.map(event => { const item = details(event); const Icon = item.icon; return <article key={event.id} className={`world-event ${event.type === 'SIGNAL_FLARE' ? 'is-flare' : ''}`}><div className="world-event-top"><span className="world-event-icon"><Icon size={19} /></span><span>{item.label}</span><time dateTime={event.createdAt}>{time(event.createdAt)}</time></div>{event.actor && <div className="world-event-actor"><UserAvatar person={event.actor} size="sm" decorative /><span>{event.actor.username ? '@'+event.actor.username : event.actor.displayName}</span></div>}<h3>{item.title}</h3><p>{item.copy}</p>{item.destination && <button type="button" onClick={() => { onNavigate?.('arena', { section: item.destination }); onClose?.(); }}>{item.destination === 'cards' ? 'Find your next move' : 'Open the Arena'}<ArrowRight size={15} /></button>}</article>; })}</div>
    {feed.hasMore && <button className="world-older" type="button" disabled={loading} onClick={() => { setLoading(true); void load(true); }}>Earlier activity <ArrowRight size={15} /></button>}
    {!loading && feed.events.length > 0 && !feed.hasMore && <p className="world-caught-up">You’re caught up with the week.</p>}
  </section>;
};
