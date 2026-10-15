import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Copy, Eye, Shield, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { PlayingCardBack } from '../cards/PlayingCardBack';
import { TableConnection } from './TableConnection';
import { useTableConnection } from './useTableConnection';
import { AuraMoment, RoundFinish, PlaySomeoneNew } from './RoundFinish';
import { CardArtwork } from '../cards/CardArtwork';
import { PersonActions } from '../people/PersonActions';
import { DuelConnection } from '../people/DuelConnection';
import { getTable, joinTable, markTableSeen, tableAction } from '../../services/tableService';
import { playGameSound } from '../../lib/gameSounds';
import { RoundReward } from './PlayRewards';

const moveCopy = (move, names, cards) => {
  const actor = names[move.actorId] || 'A player', target = names[move.targetId] || 'a player';
  if (move.outcome === 'FORFEIT') return `${actor} left the round.`;
  const prefix = `${actor} played ${cards[move.cardId]?.name}.`;
  if (move.blocked) return `${prefix} ${target} was protected by Ghost.`;
  return `${prefix} ${move.outcome === 'PEEK' ? `A private peek at ${target}’s card.` : move.outcome === 'PROTECTED' ? 'Protected until their next turn.' : move.outcome === 'SWAPPED' ? `Swapped hidden cards with ${target}.` : move.outcome === 'OATH_PLAYED' ? `${actor} is out.` : move.outcome === 'REDRAW' ? `${target} discarded ${cards[move.discardedCardId]?.name} and drew again.` : move.outcome === 'OATH_DISCARDED' ? `${target} discarded Oath and is out.` : `Guessed ${cards[move.guess]?.name}. ${move.outcome === 'CORRECT_GUESS' ? `${target} is out.` : 'A miss.'}`}`;
};

export const GroupTableSpace = ({ code, onNavigate }) => {
  const { user, refreshUser } = useAuth(), userId = String(user.uid || user.id || user._id);
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState(null), [target, setTarget] = useState(''), [guess, setGuess] = useState(''), [rules, setRules] = useState(false), [leaving, setLeaving] = useState(false), [copied, setCopied] = useState(false);
  const [synced,setSynced] = useState(false);
  const alive = useRef(false), sequence = useRef(0), locked = useRef(false), previous = useRef(null), acknowledged = useRef(''), controls = useRef(null), title = useRef(null), root = useRef(null);
  const refresh = useRef(refreshUser); refresh.current = refreshUser;
  const receive = useCallback((result, action = null) => {
    const prior = previous.current; previous.current = result; setData(result); setError(''); setSynced(true);
    if (action === 'PLAY' || prior?.status === 'ACTIVE' && result.status === 'FINISHED' && prior.matchId === result.matchId) playGameSound(result.status === 'FINISHED' ? result.winner === 'YOU' ? 'duel_win' : 'duel_end' : 'card', userId, `${result.matchId}:${result.revision}`);
    if (action !== 'PLAY' && prior?.status === 'ACTIVE' && result.status === 'ACTIVE' && prior.matchId === result.matchId && result.moves?.length > prior.moves?.length) playGameSound('card', userId, `${result.matchId}:${result.revision}`);
    if (result.status === 'FINISHED' && (prior?.matchId !== result.matchId || prior?.status !== 'FINISHED')) void refresh.current().catch(() => {});
    const key = `${result.matchId}:${result.revision}`;
    if (result.matchId && key !== acknowledged.current) {
      acknowledged.current = key;
      void markTableSeen(result).catch(() => { if (acknowledged.current === key) acknowledged.current = ''; });
    }
  }, [userId]);
  const load = useCallback(async () => {
    if (locked.current) return; const request = ++sequence.current;
    try { const result = await getTable(code); if (alive.current && request === sequence.current) receive(result); }
    catch (err) { if (alive.current && request === sequence.current) { setSynced(false); setError(err.message); if ([403, 404].includes(err.status)) setData(null); } }
  }, [code, receive]);
  const connection = useTableConnection(load, `${userId}:table:${code}`);
  const canAct = !busy && !connection.offline && synced;
  useEffect(() => {
    alive.current = true; previous.current = null; root.current?.closest('.scroll-content')?.scrollTo({ top: 0, behavior: 'instant' }); void load();
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    const interval = setInterval(visible, 6000); document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible);
    return () => { alive.current = false; sequence.current += 1; clearInterval(interval); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible); };
  }, [load]);
  useEffect(() => { setSelected(null); setTarget(''); setGuess(''); }, [data?.revision, data?.matchId]);
  useEffect(() => { if (selected !== null) controls.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [selected, target, guess]);
  const hasData = Boolean(data);
  useEffect(() => { if (hasData) title.current?.focus({ preventScroll: true }); }, [hasData]);
  useEffect(() => {
    if (data?.status === 'FINISHED' || data?.status === 'WAITING') {
      root.current?.closest('.scroll-content')?.scrollTo({ top: 0, behavior: 'instant' });
      if (!document.querySelector('dialog[open]')) title.current?.focus({ preventScroll: true });
    }
  }, [data?.status]);
  const back = () => onNavigate('arena', { section: 'duels' });
  const act = async (action, values = {}) => {
    if (locked.current || !data) return;
    locked.current = true; setBusy(true); setError(''); const request = ++sequence.current;
    try {
      const result = await (action === 'JOIN' ? joinTable(userId, code) : tableAction(userId, data, action, values));
      if (!alive.current || request !== sequence.current) return;
      setLeaving(false);
      if (action === 'LEAVE') { back(); return; }
      receive(result, action);
    } catch (err) {
      if (alive.current && request === sequence.current) {
        if (!err.status || err.status >= 500) setSynced(false);
        setError(err.message); if ([403, 404].includes(err.status)) setData(null);
        if (err.status === 409) {
          try { const latest = await getTable(code); if (alive.current && request === sequence.current) receive(latest); }
          catch { /* Keep the explicit refresh action if recovery is unavailable. */ }
        }
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?view=arena&section=duels&duel=table_${data.id}`); if (alive.current) setCopied(true); }
    catch { if (alive.current) setError('Copy the table code below and send it to your friends.'); }
  };
  const errorNotice = error && <div className="duel-error" role="alert"><p>{error}</p><button type="button" disabled={!canAct} onClick={() => void load()}>Refresh table</button></div>;
  if (!data) return <section ref={root} className="duel-space"><button type="button" className="duel-text-action" onClick={back}><ArrowLeft size={16} />All tables</button>{errorNotice}{!error && <p className="duel-loading" role="status">Opening your table…</p>}</section>;
  const waiting = data.status === 'WAITING', active = data.status === 'ACTIVE', finished = data.status === 'FINISHED';
  const players = data.players || [], me = players.find(player => player.me), current = players.find(player => player.id === data.currentPlayerId);
  const names = Object.fromEntries(players.map(player => [player.id, player.me ? 'You' : player.displayName])), cards = Object.fromEntries((data.cards || []).map(card => [card.id, card]));
  const cardId = selected === null ? null : data.hand?.[selected], card = cards[cardId];
  const targeted = ['SIGNAL_FLARE', 'WATCHER', 'PURIFY', 'ORBIT'].includes(cardId), targets = players.filter(player => !player.eliminated && (!player.me || cardId === 'PURIFY'));
  const targetPlayer = players.find(player => player.id === target), blocked = targetPlayer?.protected && !targetPlayer.me;
  const ready = card && (!targeted || target) && (cardId !== 'SIGNAL_FLARE' || guess);
  const winners = players.filter(player => player.winner).map(player => player.me ? 'You' : player.displayName).join(' & ');
  const headline = data.canJoin ? 'There’s a seat for you.' : waiting ? 'Who’s coming to the table?' : active ? me?.eliminated ? 'You’re out. Stay for the finish.' : data.myTurn ? 'Your turn. Choose your move.' : current?.atTable ? `${current.displayName} is thinking.` : `Waiting for ${current?.displayName || 'a player'}.` : finished ? data.reason === 'DRAW' ? 'A shared finish.' : data.winner === 'YOU' ? 'You took the table.' : `${winners} won.` : 'This table has closed.';
  const seatList = <div className="group-seats" aria-label="Players at the table">{players.map(player => <article className={`group-seat ${player.eliminated ? 'is-out' : ''} ${active && player.id === data.currentPlayerId ? 'is-playing' : ''}`} key={player.id}><div className="group-seat-top"><UserAvatar person={player} size="sm" decorative />{active && !player.me && !player.eliminated && <PlayingCardBack backId={player.cardBack} size={30} decorative />}{!player.me && player.username && <PersonActions person={player} onBlocked={back} />}</div><strong>{player.me ? 'You' : player.displayName}</strong><small>{waiting ? `${player.host ? 'Host · ' : ''}${player.ready ? 'Ready' : 'Getting ready'}` : player.forfeited ? 'Left the round' : player.eliminated ? 'Knocked out' : finished ? player.winner ? data.reason === 'DRAW' ? 'Shared win' : 'Winner' : 'Good game' : player.id === data.currentPlayerId ? 'Playing now' : player.protected ? 'Protected by Ghost' : 'Card kept hidden'}</small>{!finished && <span className={`seat-presence ${player.atTable ? 'is-present' : ''}`}>{player.atTable ? 'At the table' : 'Away'}</span>}{finished && <div className="group-revealed-hand">{player.hand.map((value, index) => <span key={`${value}:${index}`}><CardArtwork cardId={value} size={48} /><small>{cards[value]?.name} · {cards[value]?.rank}</small></span>)}{!player.hand.length && <small>Oath discarded</small>}</div>}</article>)}{waiting && Array.from({ length: 4 - players.length }, (_, index) => <article key={`empty:${index}`} className="group-seat is-empty"><Users size={23} aria-hidden="true" /><strong>Open seat</strong><small>Send a friend the code</small></article>)}</div>;
  return <section ref={root} className={`duel-space group-table-space ${active ? 'is-active' : ''}`} aria-label="Group card table">
    <div className="duel-toolbar"><button type="button" className="duel-text-action" onClick={back}><ArrowLeft size={16} />All tables</button>{!data.canJoin && <button type="button" className="duel-text-action" onClick={() => setRules(true)}><BookOpen size={16} />Rules</button>}</div>
    <TableConnection {...connection} synced={synced} onRefresh={() => void load()} />
    <h1 className="duel-title" ref={title} tabIndex={-1}>{headline}</h1>
    <p className="duel-state-copy" role="status" aria-live="polite">{data.canJoin ? `${data.count} of 4 seats taken. Join, then mark yourself ready.` : waiting ? 'Share the code. Everyone gets ready. The host starts when the crew is here.' : active ? `Turn ${data.turn} · ${data.remaining} cards left` : finished ? data.reason === 'HIGH_CARD' || data.reason === 'DRAW' ? 'The deck is empty. Highest surviving rank takes the round.' : 'Last player standing. Well played.' : 'Start a fresh table when you’re ready.'}</p>
    {errorNotice}
    {data.canJoin ? <button type="button" className="duel-primary" disabled={!canAct || data.count >= 4} onClick={() => void act('JOIN')}>{data.count >= 4 ? 'Table full' : busy ? 'Joining…' : 'Join this table'}</button> : <>
      {waiting && <div className="group-share-code"><div><small>Table code</small><strong>{data.id}</strong></div><button type="button" className="duel-text-action" onClick={() => void copy()}><Copy size={15} />{copied ? 'Link copied' : 'Copy invite link'}</button></div>}
      {finished ? <RoundFinish won={data.winner === 'YOU'} matchId={data.matchId}>{seatList}<div className="round-aura-moments">{data.auraMoments?.filter(moment => !(moment.playerId === userId && data.rewards?.round?.status === 'EARNED' && data.rewards.round.breakdown?.moment?.kind === moment.kind)).map(moment => <AuraMoment key={`${moment.playerId}:${moment.kind}`} moment={moment} name={names[moment.playerId]} />)}</div><RoundReward data={data.rewards} /></RoundFinish> : seatList}
      {waiting && <div className="group-ready-actions"><button type="button" className={me?.ready ? 'duel-text-action' : 'duel-primary'} disabled={!canAct} onClick={() => void act('READY', { ready: !me.ready })}>{me?.ready ? 'Not ready yet' : 'I’m ready'}</button>{data.host && <button type="button" className="duel-primary" disabled={!canAct || players.length < 2 || players.some(player => !player.ready)} onClick={() => void act('START')}>{busy ? 'Starting…' : 'Start round'}</button>}<p>{players.length < 2 ? 'You need at least one more player.' : players.every(player => player.ready) ? data.host ? 'Everyone is ready. Your call.' : 'Everyone is ready. Waiting for the host.' : 'Waiting for everyone to get ready.'}</p></div>}
      {active && <>
        {data.moves.length > 0 && <div className={`duel-last-move ${data.moves.at(-1).blocked ? 'is-blocked' : ''}`} key={`${data.matchId}:${data.moves.length}`}>{data.moves.at(-1).cardId && <CardArtwork cardId={data.moves.at(-1).cardId} size={36} />}<div><p>{moveCopy(data.moves.at(-1), names, cards)}</p><AuraMoment moment={data.auraMoments?.find(moment => moment.turn === data.moves.at(-1).turn)} /></div></div>}
        {data.peek && <aside className="duel-peek"><Eye size={16} /><div><strong>{names[data.peek.targetId]} held {cards[data.peek.cardId]?.name}</strong><small>Turn {data.peek.turn} · {data.peek.stale ? 'Their card may have changed.' : 'A private memory, not a live view.'}</small></div></aside>}
        <div className="duel-table"><div className="duel-hand-label"><span>{data.myTurn ? 'Play one. Keep one.' : 'Your hidden card'}</span>{me?.protected && <small><Shield size={12} />Ghost protection</small>}</div><div key={`${data.matchId}:${data.turn}:${data.myTurn}`} className="duel-hand" role="group" aria-label="Your group game hand">{data.hand.map((value, index) => <button type="button" className={`duel-hand-card ${selected === index ? 'is-selected' : selected !== null ? 'is-kept' : ''}`} key={`${value}:${index}`} disabled={!data.myTurn || !canAct} aria-pressed={selected === index} aria-label={`Play ${cards[value].name}, rank ${cards[value].rank}`} onClick={() => { setSelected(index); setTarget(''); setGuess(''); }}><span className="duel-card-label"><small>{selected === null ? 'Your hand' : selected === index ? 'Playing' : 'Keeping'}</small><b>{cards[value].rank}</b></span><CardArtwork cardId={value} size={104} /><strong>{cards[value].name}</strong></button>)}</div></div>
        {data.myTurn && <div className="duel-move-controls" ref={controls}>{card ? <><div className="duel-chosen-effect"><strong>{card.name}</strong><p>{card.effect}</p></div>{targeted && <fieldset className="duel-choices"><legend>{cardId === 'PURIFY' ? 'Who redraws?' : 'Choose your target'}</legend>{targets.map(player => <button type="button" key={player.id} disabled={!canAct} aria-pressed={target === player.id} onClick={() => setTarget(player.id)}>{player.me ? 'Me' : player.displayName}{player.protected && !player.me && <Shield size={12} />}</button>)}</fieldset>}{cardId === 'SIGNAL_FLARE' && <fieldset className="duel-choices"><legend>What are they holding?</legend>{Object.values(cards).filter(value => value.id !== 'SIGNAL_FLARE').map(value => <button type="button" key={value.id} disabled={!canAct} aria-pressed={guess === value.id} onClick={() => setGuess(value.id)}>{value.name}<small>{value.rank}</small></button>)}</fieldset>}{targeted && blocked && <p className="duel-warning">Ghost will block this effect. You can still discard the card.</p>}<button type="button" className={`duel-primary ${cardId === 'OATH' ? 'is-danger' : ''}`} disabled={!ready || !canAct} onClick={() => void act('PLAY', { cardId, ...(targeted ? { targetId: target } : {}), ...(cardId === 'SIGNAL_FLARE' ? { guess } : {}) })}>{busy ? 'Playing…' : cardId === 'OATH' ? 'Play Oath and get knocked out' : `Play ${card.name}`}</button></> : <p className="duel-choice-hint">Choose one of your two cards to see its move.</p>}</div>}
      </>}
      {finished && <><div className="duel-result-actions">{data.host ? <button className="duel-primary" type="button" disabled={!canAct} onClick={() => void act('REMATCH')}>Set up another round</button> : <p className="duel-state-copy">The host can open another round. Everyone gets ready again.</p>}<PlaySomeoneNew userId={userId} onNavigate={onNavigate} /></div>{!me?.forfeited && players.some(player => !player.me && !player.forfeited && player.username) && <section className="group-connections" aria-label="Connect after your game"><h2>Keep the company.</h2><p>Good game? Keep talking. Chat opens when you both accept.</p>{players.filter(player => !player.me && !player.forfeited && player.username).map(player => <DuelConnection key={player.id} person={player} onNavigate={onNavigate} compact />)}</section>}</>}
      {data.moves?.length > 0 && <details className="duel-move-history"><summary>{finished ? 'The deciding moves' : 'Moves so far'}<span>{data.moves.length}</span></summary><ol>{data.moves.map((move, index) => <li key={`${move.turn}:${index}`}>{move.cardId && <CardArtwork cardId={move.cardId} size={28} />}<div><p>{moveCopy(move, names, cards)}</p><small>Turn {move.turn}</small></div></li>)}</ol></details>}
      {(waiting || active && !me?.eliminated) && <div className="duel-quiet-actions"><button type="button" className="duel-text-action" onClick={() => setLeaving(true)} disabled={!canAct}>Leave {waiting ? 'table' : 'round'}</button></div>}
    </>}
    {leaving && <ActionSheet title="Leave the table?" onClose={() => { if (!busy) setLeaving(false); }} footer={<button className="duel-primary is-danger" type="button" disabled={!canAct} onClick={() => void act('LEAVE')}>{busy ? 'Leaving…' : 'Leave table'}</button>}><p className="duel-rules-intro">{waiting ? 'Your seat opens for someone else. If you host, the next player takes over.' : 'You’ll be out of this round. The other players continue, and you won’t earn a round reward.'}</p>{error && <p role="alert" className="duel-warning">{error}</p>}</ActionSheet>}
    {rules && <ActionSheet title="How group tables work" onClose={() => setRules(false)}><p className="duel-rules-intro">Two to four players. Eighteen cards. Draw one, play one, keep one hidden. Choose a target for Flare, Watcher, Clean Slate and Orbit.</p><div className="duel-rule-cards">{Object.values(cards).map(value => <article key={value.id}><CardArtwork cardId={value.id} size={42} /><div><strong>{value.rank} · {value.name}</strong><small>{value.copies} in the deck</small><p>{value.effect}</p></div></article>)}</div><p className="duel-rules-note">A correct guess knocks your target out. Discarding Oath knocks its owner out. Everyone else keeps playing. Last player standing wins; if the deck runs out, compare surviving hidden cards. Equal top ranks share the finish.</p><p className="duel-rules-note">The deck is free. Play two turns and finish to qualify for +5 Aura, with +5 more for a sole win and +2 for an Aura moment. Your first three qualifying rounds per day count across all tables and duels. Leaving earns no Aura. Waiting tables close after three hours without activity; rounds after seven days.</p></ActionSheet>}
  </section>;
};
