import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronDown, MessageCircle, Mic, Send, X } from 'lucide-react';
import { getContractTimeline, sendContractMessage, markContractTimelineRead } from '../../../services/friendshipService';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import { ContractCard } from './ContractCard';
import { canCheckin, friendSummary, getContractSides } from '../contractState';
import { VoiceMessage, VoiceMessageComposer } from './VoiceMessage';
import './FriendSpace.css';

const mergeItems = (old, next) => [...new Map([...old, ...next].map((item) => [item.id, item])).values()]
  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a.id).localeCompare(String(b.id)));
const dateLabel = (value) => {
  const date = new Date(value); const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};
const messageTypes = new Set(['MESSAGE', 'CHECKIN_REPLY']);

export const FriendSpace = ({ friendship, currentUserId, socialState, focusEventId, initialContract = false, onBack, onAction, onRefresh, onActivitySeen }) => {
  const id = friendship._id || friendship.id;
  const { partner } = getContractSides(friendship, currentUserId);
  const summary = friendSummary(friendship, currentUserId);
  const [contractOpen, setContractOpen] = useState(initialContract);
  const contractOpenRef = useRef(contractOpen);
  contractOpenRef.current = contractOpen;
  const [room, setRoom] = useState({ items: [], nextCursor: null, hasMore: false, focusItem: null, checkin: null });
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [newUpdates, setNewUpdates] = useState(false);
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const backRef = useRef(null);
  const callbacks = useRef({ onAction, onRefresh, onActivitySeen });
  callbacks.current = { onAction, onRefresh, onActivitySeen };
  const aliveRef = useRef(true);
  const requestRef = useRef(0);
  const initialRef = useRef(true);
  const nearBottomRef = useRef(true);
  const scrollRef = useRef(null);
  const acknowledged = useRef(new Set());
  const failedSend = useRef(null);
  const pendingReads = useRef(new Set());
  const sendBusy = useRef(false);
  const roomRef = useRef(room);
  roomRef.current = room;
  const conversationTop = useRef(0);
  const openContract = (open) => {
    if (open) conversationTop.current = listRef.current?.scrollTop || 0;
    else scrollRef.current = nearBottomRef.current ? { bottom: true } : { restore: conversationTop.current };
    setContractOpen(open);
  };

  const acknowledge = useCallback((items) => {
    const unseen = items.filter((item) => !acknowledged.current.has(item.id));
    if (!unseen.length) return;
    unseen.forEach((item) => acknowledged.current.add(item.id));
    callbacks.current.onActivitySeen?.(unseen);
    unseen.filter((item) => item.type === 'MESSAGE' && !item.mine).forEach((item) => pendingReads.current.add(item.id));
  }, []);
  const syncReads = useCallback(() => {
    const ids = [...pendingReads.current].slice(0, 50);
    if (!ids.length) return;
    void markContractTimelineRead(id, ids).then(() => ids.forEach((eventId) => pendingReads.current.delete(eventId))).catch(() => {});
  }, [id]);
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const data = await getContractTimeline(id, { focus: focusEventId });
      if (!aliveRef.current || request !== requestRef.current) return;
      if (initialRef.current) {
        scrollRef.current = { initial: true };
        initialRef.current = false;
      } else if (nearBottomRef.current) scrollRef.current = { bottom: true };
      setRoom((previous) => ({ ...data, items: mergeItems(previous.items, data.items), nextCursor: previous.hasMore ? previous.nextCursor : data.nextCursor, hasMore: previous.hasMore || data.hasMore }));
      if (!nearBottomRef.current && data.items.some((item) => !roomRef.current.items.some((old) => old.id === item.id))) setNewUpdates(true);
      if (nearBottomRef.current && !contractOpenRef.current) acknowledge([...data.items, ...(data.focusItem ? [data.focusItem] : [])]);
      syncReads();
      setError('');
    } catch (err) { if (aliveRef.current && request === requestRef.current) { setError(err.message || 'Could not load your conversation'); if (err.status === 404 || err.status === 403) setUnavailable(true); } }
    finally { if (aliveRef.current && request === requestRef.current) setLoading(false); }
  }, [id, focusEventId, acknowledge, syncReads]);
  useEffect(() => {
    initialRef.current = true;
    nearBottomRef.current = true;
    setContractOpen(initialContract);
  }, [focusEventId, initialContract]);
  useEffect(() => {
    aliveRef.current = true; backRef.current?.focus({ preventScroll: true });
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { aliveRef.current = false; requestRef.current += 1; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  useEffect(() => { if (!initialRef.current) void load(); }, [friendship.duoXP, friendship.user1Perspective?.lastInteraction, friendship.user2Perspective?.lastInteraction, load]);
  useLayoutEffect(() => {
    const list = listRef.current; const pending = scrollRef.current;
    if (!list || !pending || contractOpen) return;
    if (pending.prepend) list.scrollTop = pending.top + list.scrollHeight - pending.height;
    else if (pending.restore !== undefined) list.scrollTop = pending.restore;
    else list.scrollTop = list.scrollHeight;
    scrollRef.current = null;
    if (pending.initial && focusEventId) {
      const target = Array.from(list.querySelectorAll('[data-friend-event]')).find((element) => element.dataset.friendEvent === focusEventId);
      if (target) { target.scrollIntoView({ block: 'center', behavior: 'instant' }); target.focus({ preventScroll: true }); }
    }
  }, [room.items, room.focusItem, contractOpen, focusEventId]);
  const older = async () => {
    if (!room.nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await getContractTimeline(id, { before: room.nextCursor });
      if (!aliveRef.current) return;
      const list = listRef.current;
      if (list) scrollRef.current = { prepend: true, top: list.scrollTop, height: list.scrollHeight };
      setRoom((previous) => ({ ...previous, items: mergeItems(data.items, previous.items), hasMore: data.hasMore, nextCursor: data.nextCursor }));
      acknowledge(data.items);
      setError('');
    } catch (err) { if (aliveRef.current) setError(err.message || 'Could not load older messages'); }
    finally { if (aliveRef.current) setLoadingOlder(false); }
  };
  useEffect(() => {
    if (!contractOpen && !loading) { acknowledge(roomRef.current.items); syncReads(); }
  }, [contractOpen, loading, acknowledge, syncReads]);
  const send = async (payload) => {
    let result;
    try { result = await sendContractMessage(id, payload); }
    catch (err) { if (aliveRef.current && (err.status === 404 || err.status === 403)) setUnavailable(true); throw err; }
    if (!aliveRef.current) return;
    scrollRef.current = { bottom: true }; nearBottomRef.current = true;
    setRoom((previous) => ({ ...previous, items: mergeItems(previous.items, [result.item]) }));
    setSendError(''); setNewUpdates(false);
    void load(); void callbacks.current.onRefresh?.();
  };
  const sendText = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sendBusy.current) return;
    const payload = failedSend.current?.text === text ? failedSend.current : { clientId: crypto.randomUUID(), text };
    failedSend.current = payload; sendBusy.current = true; setSending(true); setSendError('');
    try {
      await send(payload);
      if (aliveRef.current) { failedSend.current = null; setDraft((value) => value.trim() === text ? '' : value); composerRef.current?.focus({ preventScroll: true }); }
    } catch (err) { if (aliveRef.current) setSendError(err.message || 'Couldn’t confirm delivery. Retry to send it once.'); }
    finally { sendBusy.current = false; if (aliveRef.current) setSending(false); }
  };
  const shared = socialState?.firstMutualCheckin;
  const moment = socialState?.moment;
  const canPoke = socialState?.canPoke !== false;
  const [poking, setPoking] = useState(false);
  const poke = async () => {
    if (poking || !canPoke) return;
    setPoking(true);
    try { await callbacks.current.onAction?.('POKE', friendship); void load(); }
    finally { if (aliveRef.current) setPoking(false); }
  };
  const renderItem = (item) => {
    const conversation = messageTypes.has(item.type);
    const isFocus = item.id === focusEventId;
    return <article key={item.id} data-friend-event={item.id} tabIndex={-1} className={`friend-event ${conversation ? 'conversation' : 'shared-event'} ${item.mine ? 'mine' : 'theirs'} ${isFocus ? 'is-focused' : ''}`}>
      {conversation ? <div className="friend-message-bubble">
        {!item.mine && <span className="friend-message-author">{item.actorName}</span>}
        {item.voice ? <VoiceMessage voice={item.voice} /> : <p>{item.text}</p>}
        {item.voiceUnavailable && <small>Audio is no longer available.</small>}
        <span className="friend-message-meta"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>{item.checkin?.status === 'CHECKED_IN' && <span><Check size={11} /> Checked in · +{item.checkin.xp} XP</span>}</span>
        {item.mine && item.checkin?.status === 'NEEDS_ACTION' && <span className="friend-message-checkin-note">{item.checkin.reason}</span>}
      </div> : <div className="friend-shared-event"><span className="friend-event-label">{item.text}{item.xp > 0 && <small>+{item.xp} Duo XP</small>}</span>
        {item.voice && <VoiceMessage voice={item.voice} />}
        {item.voiceUnavailable && <small>Older voice check-in · audio isn’t linked here.</small>}
        {item.moment && <div className="friend-moment-reveal"><p>{item.moment.prompt}</p>{item.moment.answers.map((answer, index) => <span key={index}><strong>{answer.name}</strong>{answer.value}</span>)}</div>}
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
        {!item.mine && ['CHECKIN', 'VOICE_CHECKIN'].includes(item.type) && socialState?.latestPartnerCheckin?.eventId === item.id && <div className="friend-event-actions"><button onClick={() => composerRef.current?.focus()}>Reply <MessageCircle size={13} /></button><button onClick={() => openContract(true)}>React <ArrowUpRight size={13} /></button></div>}
      </div>}
    </article>;
  };
  const focusOutsidePage = room.focusItem && !room.items.some((item) => item.id === room.focusItem.id);
  return <section className="friend-space" aria-label={`Your space with ${partner?.displayName || 'your friend'}`}>
    <header className="friend-space-header"><button ref={backRef} className="friend-space-back" onClick={onBack} aria-label="Back to your circle"><ArrowLeft size={20} /></button><UserAvatar person={partner} size="sm" decorative /><div className="friend-space-identity"><h1>{partner?.displayName || 'Your friend'}</h1><span>{partner?.username ? '@' + partner.username : 'Your shared space'}</span></div><button className="friend-space-details" aria-expanded={contractOpen} onClick={() => openContract(!contractOpen)}>{contractOpen ? 'Conversation' : 'Contract'}<ChevronDown size={15} /></button></header>
    <div className={`friend-space-health ${summary.tone}`}><span><i aria-hidden="true" />{summary.label}</span><button onClick={() => onAction(friendship.season?.status === 'COMPLETE' ? 'RECAP' : 'CHECKIN', friendship)} disabled={friendship.season?.status !== 'COMPLETE' && !canCheckin(friendship, currentUserId)}>{friendship.season?.status === 'COMPLETE' ? 'See recap' : canCheckin(friendship, currentUserId) ? 'Check in' : 'Checked in'}<Check size={13} /></button></div>
    {summary.needsAction && !contractOpen && <button className="friend-space-attention" onClick={() => openContract(true)}><span>{summary.detail}</span><ArrowUpRight size={15} /></button>}
    {contractOpen ? <div className="friend-space-contract"><ContractCard friendship={friendship} currentUserId={currentUserId} onAction={onAction} referenceLayout socialState={socialState} onActivitySeen={onActivitySeen} /><button className="friend-contract-return" onClick={() => openContract(false)}>Back to conversation <MessageCircle size={16} /></button></div> : <>
      {moment?.status === 'OPEN' && <button className="friend-space-moment" onClick={() => openContract(true)}><span>{moment.type === 'SPLIT_DECISION' ? 'Split Decision' : moment.type === 'DOUBLE_DARE' ? 'Double Dare' : 'Hot Seat'} · {moment.answered ? 'Waiting on them' : 'Your turn'}</span><ArrowUpRight size={15} /></button>}
      <div className="friend-space-timeline" ref={listRef} onScroll={() => { const list = listRef.current; nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 100; if (nearBottomRef.current) { setNewUpdates(false); acknowledge(room.items); syncReads(); } }}>
        {error && <div className="friend-space-error" role="status"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
        {loading && !room.items.length ? <div className="friend-space-empty" role="status">Opening your space…</div> : <>
          {room.hasMore && <button className="friend-load-older" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Loading…' : 'Earlier messages'}</button>}
          {shared && <div className="friend-first-shared"><span>First check-in together</span><strong>Both showed up.</strong><p>You + {partner?.displayName} · {shared.xp} Duo XP together.</p><button onClick={() => onActivitySeen?.([shared])} aria-label="Dismiss first shared check-in"><X size={16} /></button></div>}
          {focusOutsidePage && <section className="friend-opened-update" aria-label="Opened from Activity"><span>Opened from Activity</span>{renderItem(room.focusItem)}</section>}
          {!room.items.length && !error && <div className="friend-space-empty"><MessageCircle size={28} strokeWidth={1.5} /><strong>Your space with {partner?.displayName}.</strong><p>Leave a message or a voice note. Your check-ins and shared moments stay here.</p></div>}
          {room.items.map((item, index) => <React.Fragment key={item.id}>{(index === 0 || dateLabel(room.items[index - 1].createdAt) !== dateLabel(item.createdAt)) && <div className="friend-timeline-date">{dateLabel(item.createdAt)}</div>}{renderItem(item)}</React.Fragment>)}
        </>}
      </div>
      {newUpdates && <button className="friend-new-updates" onClick={() => { listRef.current.scrollTop = listRef.current.scrollHeight; nearBottomRef.current = true; setNewUpdates(false); acknowledge(room.items); syncReads(); }}>New updates <ArrowDown size={15} /></button>}
      <div className="friend-composer-dock">
        {unavailable ? <div className="friend-space-ended" role="status"><p>This contract is no longer available.</p><button onClick={onBack}>Back to your circle</button></div> : <>
        {voiceOpen ? <VoiceMessageComposer friendshipId={id} onCancel={() => { setVoiceOpen(false); composerRef.current?.focus(); }} onSend={async (payload) => { await send(payload); if (aliveRef.current) setVoiceOpen(false); }} /> : <form className="friend-composer" onSubmit={sendText}>
          <button type="button" className="friend-compose-voice" onClick={() => setVoiceOpen(true)} disabled={sending} aria-label="Record a voice message"><Mic size={19} /></button>
          <textarea ref={composerRef} aria-label={`Message ${partner?.displayName || 'your friend'}`} placeholder={`Message ${partner?.displayName || 'your friend'}…`} value={draft} maxLength={1000} rows={1} onChange={(event) => setDraft(event.target.value)} />
          <button className="friend-compose-send" type="submit" disabled={!draft.trim() || sending} aria-label={sending ? 'Sending message' : 'Send message'}><Send size={18} /></button>
        </form>}
        {sendError && <p className="friend-send-error" role="status">{sendError} Your message is kept here so you can retry.</p>}
        <div className="friend-composer-context"><span>{sending ? 'Sending…' : room.checkin?.reason || 'Messages stay in your shared space.'}</span><button type="button" onClick={() => void poke()} disabled={poking || !canPoke}>{poking ? 'Poking…' : socialState?.pokeBackAvailable ? 'Poke back' : 'Poke'}</button></div>
      </>}
      </div>
    </>}
  </section>;
};
