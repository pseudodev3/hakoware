import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Eye, Shield, Swords, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { CardArtwork } from '../cards/CardArtwork';
import { getDuel, getDuels, makeDuelMove, markDuelSeen } from '../../services/duelService';
import { playGameSound } from '../../lib/gameSounds';
import { duelResultCopy } from '../../lib/duelFeedback';
import { PersonActions } from '../people/PersonActions';
import { DuelConnection } from '../people/DuelConnection';
import './Duels.css';

const time = value => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
const stateCopy = room => room.status === 'INVITED' ? room.invitedByMe ? 'Invitation sent' : 'Invited you' : room.status === 'ACTIVE' ? room.myTurn ? 'Your turn' : 'Their turn' : room.status === 'FINISHED' ? room.winner === 'YOU' ? 'You won' : room.winner === 'PARTNER' ? 'They won' : 'A draw' : { DECLINED: 'Invitation declined', CANCELLED: 'Invitation cancelled', ABANDONED: 'Round ended', EXPIRED: 'Round expired' }[room.status] || 'Start a round';
const moveCopy = (move, cards, partner) => {
  const actor = move.actor === 'YOU' ? 'You' : partner, name = cards[move.cardId]?.name || 'a card';
  const prefix = `${actor} played ${name}.`;
  if (move.blocked) return `${prefix} Ghost blocked the effect.`;
  if (move.outcome === 'PEEK') return `${prefix} A private peek.`;
  if (move.outcome === 'PROTECTED') return `${prefix} Protected until their next turn.`;
  if (move.outcome === 'SWAPPED') return `${prefix} Hidden cards swapped.`;
  if (move.outcome === 'REDRAW' || move.outcome === 'OATH_DISCARDED') return `${prefix} ${move.target === 'YOU' ? 'You' : partner} discarded ${cards[move.discardedCardId]?.name}.`;
  if (move.guess) return `${prefix} Guessed ${cards[move.guess]?.name}${move.outcome === 'CORRECT_GUESS' ? ' and won' : ' and missed'}.`;
  return `${prefix} Oath leaves the hand. Round over.`;
};

export const DuelSpace = ({ focusDuelId, onNavigate }) => {
  const { user } = useAuth(), userId = String(user.uid || user.id || user._id);
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [selected, setSelected] = useState(null), [guess, setGuess] = useState(''), [target, setTarget] = useState('');
  const [rules, setRules] = useState(false), [leaving, setLeaving] = useState(false);
  const alive = useRef(false), sequence = useRef(0), busyRef = useRef(false), acknowledged = useRef(''), title = useRef(null), context = useRef(''), root = useRef(null), controls = useRef(null);
  const acknowledge = useCallback(view => {
    const key = `${view.matchId}:${view.revision}`;
    if (!view.matchId || acknowledged.current === key) return;
    acknowledged.current = key;
    void markDuelSeen(view).catch(() => { if (acknowledged.current === key) acknowledged.current = ''; });
  }, []);
  const load = useCallback(async ({ quiet = false } = {}) => {
    const request = ++sequence.current;
    if (!quiet) setLoading(true);
    try {
      const result = await (focusDuelId ? getDuel(focusDuelId) : getDuels());
      if (!alive.current || request !== sequence.current) return;
      setData(result); setError('');
      if (focusDuelId) acknowledge(result);
    } catch (err) {
      if (alive.current && request === sequence.current) { setError(err.message || 'Could not load your duels.'); if ([403, 404].includes(err.status)) setData(null); }
    } finally { if (alive.current && request === sequence.current) setLoading(false); }
  }, [focusDuelId, acknowledge]);
  useEffect(() => {
    alive.current = true; context.current = `${userId}:${focusDuelId || 'lobby'}`;
    busyRef.current = false; setBusy(false); setData(null); setSelected(null); setError(''); acknowledged.current = '';
    root.current?.closest('.scroll-content')?.scrollTo({ top: 0, behavior: 'instant' });
    void load();
    const visible = () => { if (document.visibilityState === 'visible' && !busyRef.current) void load({ quiet: true }); };
    const interval = setInterval(visible, focusDuelId ? 6000 : 30000);
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible);
    return () => { alive.current = false; sequence.current += 1; clearInterval(interval); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible); };
  }, [load, userId, focusDuelId]);
  useEffect(() => { setSelected(null); setGuess(''); setTarget(''); }, [data?.revision, data?.matchId]);
  useEffect(() => {
    if (selected === null) return undefined;
    const frame = requestAnimationFrame(() => controls.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [selected, guess, target]);
  const hasData = Boolean(data);
  useEffect(() => { if (focusDuelId && hasData) title.current?.focus({ preventScroll: true }); }, [focusDuelId, hasData]);
  const act = async (action, values = {}) => {
    if (busyRef.current || !data) return;
    const requestContext = context.current;
    busyRef.current = true; setBusy(true); setError(''); sequence.current += 1;
    try {
      const result = await makeDuelMove(userId, data, action, values);
      if (!alive.current || requestContext !== context.current) return;
      setData(result); acknowledge(result); setLeaving(false);
      if (action === 'PLAY') playGameSound('card', userId, `${result.matchId}:${result.revision}`);
    } catch (err) {
      if (alive.current && requestContext === context.current) {
        setError(err.message || 'Could not confirm your move. Your choice is kept so you can retry.');
        if ([403, 404].includes(err.status)) setData(null);
        if (err.status === 409) await load({ quiet: true });
      }
    } finally { if (requestContext === context.current) { busyRef.current = false; if (alive.current) setBusy(false); } }
  };
  const open = room => onNavigate('arena', { section: 'duels', duelId: room.id });
  const back = () => onNavigate('arena', { section: 'duels' });
  const cards = Object.fromEntries((data?.cards || []).map(card => [card.id, card]));
  const rulesSheet = rules && <ActionSheet title="How duels work" onClose={() => setRules(false)}>
    <p className="duel-rules-intro">Two cards in hand. Play one, keep one hidden. A correct Flare guess wins; otherwise, the higher held rank wins when the deck runs out.</p>
    <div className="duel-rule-cards">{Object.values(cards).map(card => <article key={card.id}><CardArtwork cardId={card.id} size={42} /><div><strong>{card.rank} · {card.name}</strong><small>{card.copies} in the deck</small><p>{card.effect}</p></div></article>)}</div>
    <p className="duel-rules-note">Ghost blocks moves aimed at its owner until their next turn. Equal final ranks draw. A round takes at most eight turns; you can return later to play yours.</p>
    <p className="duel-rules-note">The twelve-card deck is free. Your collection, Aura and contract progress stay untouched. Invitations and idle rounds expire after seven days.</p>
  </ActionSheet>;
  const errorNotice = error && !leaving && <div className="duel-error" role="alert"><p>{error}</p><button type="button" disabled={busy || loading} onClick={() => void load({ quiet: Boolean(data) })}>Refresh duels</button></div>;
  if (!focusDuelId) {
    const rooms = data?.rooms || [], partners = data?.partners || [];
    const live = rooms.filter(room => ['INVITED', 'ACTIVE'].includes(room.status)).sort((a, b) => Number(b.myTurn || !b.invitedByMe && b.status === 'INVITED') - Number(a.myTurn || !a.invitedByMe && a.status === 'INVITED'));
    const recent = rooms.filter(room => room.status === 'FINISHED').slice(0, 6);
    const available = partners.filter(partner => !['INVITED', 'ACTIVE'].includes(partner.status));
    return <section ref={root} className="duel-lobby" aria-label="Friend duels">
      <div className="duel-lobby-intro"><div><p className="duel-kicker">Twelve cards. Two people.</p><h2>A little friendly trouble.</h2><p>Peek, protect, swap. Keep your best card close.</p></div><button className="duel-text-action" type="button" onClick={() => setRules(true)} disabled={!data}><BookOpen size={16} />How to play</button></div>
      {errorNotice}{loading && !data && <p role="status" className="duel-loading">Finding your table…</p>}
      {live.length > 0 && <section className="duel-lobby-section"><h3>At the table</h3>{live.map(room => <button type="button" className="duel-room-row" key={room.id} onClick={() => open(room)}><UserAvatar person={room.partner} size="sm" decorative /><span><strong>{room.partner.displayName}</strong><small>{stateCopy(room)}</small></span><span className={room.myTurn || room.status === 'INVITED' && !room.invitedByMe ? 'duel-row-ready' : ''}>{room.status === 'INVITED' ? room.invitedByMe ? 'View' : 'Review' : room.myTurn ? 'Play' : 'Open'}</span></button>)}</section>}
      {!loading && data && <section className="duel-lobby-section"><h3>{live.length ? 'Another table' : 'Choose your opponent'}</h3>{available.length ? available.map(room => <button type="button" className="duel-room-row" key={room.id} onClick={() => open(room)}><UserAvatar person={room.partner} size="sm" decorative /><span><strong>{room.partner.displayName}</strong><small>{room.score.you || room.score.partner ? `${room.score.you} wins · ${room.score.partner} losses` : 'One short round. Your call.'}</small></span><Swords size={19} aria-hidden="true" /></button>) : <p className="duel-empty">{partners.length ? 'Your friends already have a place at the table.' : 'Your next opponent could be someone new.'}</p>}</section>}
      {recent.length > 0 && <section className="duel-lobby-section"><h3>Last rounds</h3>{recent.map(room => <button type="button" className="duel-room-row" key={room.id} onClick={() => open(room)}><Trophy size={21} aria-hidden="true" /><span><strong>{room.partner.displayName}</strong><small>{stateCopy(room)}</small></span><span>Rematch</span></button>)}</section>}
      <button type="button" className="duel-text-action" onClick={() => onNavigate('contracts', { section: 'discover' })}>Find someone to play</button>
      {rulesSheet}
    </section>;
  }
  if (!data) return <section ref={root} className="duel-space"><button type="button" className="duel-text-action" onClick={back}><ArrowLeft size={16} />All duels</button>{errorNotice}{loading && <p role="status" className="duel-loading">Opening your table…</p>}</section>;
  const partner = data.partner.displayName, cardId = selected === null ? null : data.hand[selected], card = cards[cardId];
  const completed = data.status === 'FINISHED', active = data.status === 'ACTIVE', invited = data.status === 'INVITED';
  const headline = active ? data.myTurn ? 'Your turn. Play one.' : `${partner} is thinking.` : completed ? data.winner === 'YOU' ? 'You won.' : data.winner === 'PARTNER' ? `${partner} won.` : 'A draw.' : invited ? data.invitedByMe ? 'The invitation is out.' : 'A duel with your name on it.' : data.status === 'NONE' ? 'Settle it with cards.' : stateCopy(data) + '.';
  const blocked = data.protected.partner && ['SIGNAL_FLARE', 'WATCHER', 'ORBIT'].includes(cardId) || data.protected.partner && cardId === 'PURIFY' && target === 'OPPONENT';
  const choiceReady = card && (cardId !== 'SIGNAL_FLARE' || guess) && (cardId !== 'PURIFY' || target);
  const conversation = () => data.casual ? onNavigate('contracts', { section: data.connectionStatus === 'CONNECTED' ? 'connections' : 'discover', ...(data.connectionStatus === 'CONNECTED' ? { connectionId: data.connectionId } : {}) }) : onNavigate('friend', { contractKey: data.contractKey });
  return <section ref={root} className="duel-space" aria-label={`Duel with ${partner}`}>
    <div className="duel-toolbar"><button type="button" className="duel-text-action" onClick={back}><ArrowLeft size={16} />All duels</button><button type="button" className="duel-text-action" onClick={() => setRules(true)}><BookOpen size={16} />Rules</button>{data.casual && <PersonActions person={data.partner} onBlocked={() => onNavigate('contracts', { section: 'discover' })} />}</div>
    <div className="duel-opponents"><UserAvatar person={data.partner} size="sm" decorative /><div><strong>You &amp; {partner}</strong><span>{data.score.you}–{data.score.partner} <small>· {data.score.draws} draws</small></span></div>{active && <span className="duel-round-meta">Turn {data.turn}<small>{data.remaining} in the deck</small></span>}</div>
    <h1 className="duel-title" ref={title} tabIndex={-1}>{headline}</h1>
    <p className="duel-state-copy" role="status" aria-live="polite">{active ? data.myTurn ? 'Keep the other card hidden.' : 'Your card stays hidden. Come back for your next move.' : completed ? duelResultCopy(data, cards) : invited ? data.invitedByMe ? `Waiting for ${partner} to accept.` : 'A free deck, a few clever moves, and room for a rematch.' : data.status === 'NONE' ? `Invite ${partner} to one short round.` : 'No cards or Aura were spent. Invite them when you feel like another round.'}</p>
    {errorNotice}
    {active && <>
      {data.moves.length > 0 && <div className="duel-last-move" key={`${data.matchId}:${data.moves.at(-1).turn}`}><CardArtwork cardId={data.moves.at(-1).cardId} size={36} /><p>{moveCopy(data.moves.at(-1), cards, partner)}</p></div>}
      <div className="duel-table">
        <div className="duel-opponent-hand"><div className="duel-card-back" aria-label="Your friend’s card is hidden"><span>H</span><i /></div><p>{partner}<small>{data.protected.partner ? <><Shield size={12} />Protected by Ghost</> : 'One card kept secret'}</small></p></div>
        {data.peek && <aside className={`duel-peek ${data.peek.stale ? 'is-stale' : ''}`}><Eye size={15} aria-hidden="true" /><div><strong>You saw {cards[data.peek.cardId]?.name}</strong><small>Turn {data.peek.turn} · {data.peek.stale ? 'Their hand may have changed since.' : 'A memory, not a live view of their hand.'}</small></div></aside>}
        <div className="duel-hand-label"><span>{data.myTurn ? 'Choose a card to play' : 'Your hidden card'}</span>{data.protected.you && <small><Shield size={12} />Protected by Ghost</small>}</div>
        <div key={`${data.matchId}:${data.turn}:${data.myTurn}`} className="duel-hand" role="group" aria-label="Your duel hand">{data.hand.map((value, index) => <button type="button" key={`${value}-${index}`} className={`duel-hand-card ${selected === index ? 'is-selected' : ''}`} aria-pressed={selected === index} aria-label={`Play ${cards[value].name}, rank ${cards[value].rank}`} disabled={!data.myTurn || busy} onClick={() => { setSelected(index); setGuess(''); setTarget(''); }}><span className="duel-card-label"><small>Duel</small><b>{cards[value].rank}</b></span><CardArtwork cardId={value} size={112} /><strong>{cards[value].name}</strong></button>)}</div>
      </div>
      {data.myTurn && <div ref={controls} className="duel-move-controls">
        {card ? <><div className="duel-chosen-effect"><strong>{card.name}</strong><p>{card.effect}</p></div>
          {cardId === 'SIGNAL_FLARE' && <fieldset className="duel-choices"><legend>What are they holding?</legend>{Object.values(cards).filter(value => value.id !== 'SIGNAL_FLARE').map(value => <button type="button" key={value.id} disabled={busy} aria-pressed={guess === value.id} onClick={() => setGuess(value.id)}>{value.name}<small>{value.rank}</small></button>)}</fieldset>}
          {cardId === 'PURIFY' && <fieldset className="duel-choices"><legend>Who redraws?</legend>{[['SELF', 'Me'], ['OPPONENT', partner]].map(([value, label]) => <button type="button" key={value} disabled={busy} aria-pressed={target === value} onClick={() => setTarget(value)}>{label}</button>)}</fieldset>}
          {blocked && <p className="duel-warning">Ghost will block this effect. You can still discard the card.</p>}
          <button type="button" className={`duel-primary ${cardId === 'OATH' ? 'is-danger' : ''}`} disabled={!choiceReady || busy} onClick={() => void act('PLAY', { cardId, ...(cardId === 'SIGNAL_FLARE' ? { guess } : {}), ...(cardId === 'PURIFY' ? { target } : {}) })}>{busy ? 'Playing…' : cardId === 'OATH' ? 'Play Oath and lose' : `Play ${card.name}`}</button>
        </> : <p className="duel-choice-hint">Pick one of your two cards to see its move.</p>}
      </div>}
      {data.moves.length > 0 && <details className="duel-move-history"><summary>Moves so far <span>{data.moves.length}</span></summary><ol>{data.moves.map(move => <li key={move.turn}><CardArtwork cardId={move.cardId} size={28} /><div><p>{moveCopy(move, cards, partner)}</p><time dateTime={move.createdAt}>Turn {move.turn} · {time(move.createdAt)}</time></div></li>)}</ol></details>}
      <div className="duel-quiet-actions"><button type="button" className="duel-text-action" onClick={conversation}>{data.casual ? data.connectionStatus === 'CONNECTED' ? 'Open conversation' : 'Back to Discover' : 'Back to conversation'}</button><button type="button" className="duel-text-action" onClick={() => setLeaving(true)} disabled={busy}>Leave round</button></div>
    </>}
    {!active && <>
      {completed ? <div className="duel-final-hands">{[['you', 'You'], ['partner', partner]].map(([role, label]) => <div key={role}><span>{label}</span>{data.result[role].length ? data.result[role].map(value => <div key={value}><CardArtwork cardId={value} size={92} /><strong>{cards[value].name}</strong><small>Held rank {cards[value].rank}</small></div>) : <p>Oath discarded</p>}</div>)}</div> : <div className="duel-invitation-art" aria-hidden="true"><CardArtwork cardId="WATCHER" size={86} /><CardArtwork cardId="GHOST" size={86} /><CardArtwork cardId="ORBIT" size={86} /></div>}
      <div className="duel-result-actions">{invited ? data.invitedByMe ? <button type="button" className="duel-text-action" disabled={busy} onClick={() => void act('CANCEL')}>Cancel invitation</button> : <><button type="button" className="duel-primary" disabled={busy} onClick={() => void act('ACCEPT')}>{busy ? 'Opening the table…' : 'Accept duel'}</button><button type="button" className="duel-text-action" disabled={busy} onClick={() => void act('DECLINE')}>Decline</button></> : <button type="button" className="duel-primary" disabled={busy} onClick={() => void act('INVITE')}>{busy ? 'Inviting…' : completed ? 'Rematch' : `Invite ${partner}`}</button>}<button type="button" className="duel-text-action" onClick={conversation}>{data.casual ? data.connectionStatus === 'CONNECTED' ? 'Open conversation' : 'Back to Discover' : 'Back to conversation'}</button></div>
      {completed && data.casual && <DuelConnection person={data.partner} onNavigate={onNavigate} />}
      {completed && <details className="duel-move-history"><summary>The deciding moves</summary><ol>{data.moves.map(move => <li key={move.turn}><CardArtwork cardId={move.cardId} size={28} /><div><p>{moveCopy(move, cards, partner)}</p><small>Turn {move.turn}</small></div></li>)}</ol></details>}
      {!invited && data.history.length > 1 && <details className="duel-move-history"><summary>Your rivalry <span>{data.history.length} recent rounds</span></summary><ol>{data.history.map(round => <li key={round.matchId}><Trophy size={16} /><div><p>{round.winner === 'YOU' ? 'You won' : round.winner === 'PARTNER' ? `${partner} won` : 'A draw'}</p><time dateTime={round.endedAt}>{new Date(round.endedAt).toLocaleDateString()}</time></div></li>)}</ol></details>}
    </>}
    {leaving && <ActionSheet title="Leave this round?" onClose={() => { if (!busy) setLeaving(false); }} footer={<button type="button" className="duel-primary is-danger" disabled={busy} onClick={() => void act('ABANDON')}>{busy ? 'Leaving…' : 'Leave round'}</button>}><p className="duel-rules-intro">The round ends for both of you. Neither player gets a win, and your contract stays as it is.</p>{error && <p className="duel-warning" role="alert">{error}</p>}</ActionSheet>}
    {rulesSheet}
  </section>;
};
