import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowLeft, Check, CheckCheck, ChevronDown, LoaderCircle, MessageCircle, Mic, Palette, ScrollText, Send, Smile, Swords, X } from 'lucide-react';
import { getContractTimeline, sendContractMessage, markContractTimelineRead } from '../../../services/friendshipService';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import { ContractDetails } from './ContractDetails';
import { canCheckin, friendSummary, getContractSides } from '../contractState';
import { VoiceMessage, VoiceMessageComposer } from './VoiceMessage';
import './FriendSpace.css';
import { duoStyle } from '../../../lib/duoIdentity';
import { showGameMoment } from '../../../lib/gameMoments';

const mergeItems = (old, next) => [...new Map([...old, ...next].map((item) => [item.id, item])).values()]
  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a.id).localeCompare(String(b.id)));
const dateLabel = (value) => {
  const date = new Date(value); const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};
const messageTypes = new Set(['MESSAGE', 'CHECKIN_REPLY']);
const routineTypes = new Set(['CHECKIN', 'CHECKIN_REACTION', 'POKE', 'DUO_IDENTITY_CHANGED', 'BANKRUPTCY_RECOVERY_STARTED', 'BANKRUPTCY_RECOVERED', 'CONTRACT_CREATED', 'CONTRACT_ACCEPTED', 'SEASON_STARTED']);
const messagesTogether = (first, second) => {
  if (!first || !second || !messageTypes.has(first.type) || !messageTypes.has(second.type) || first.mine !== second.mine) return false;
  const earlier = new Date(first.createdAt), later = new Date(second.createdAt);
  const gap = later - earlier;
  return gap >= 0 && gap < 5 * 60 * 1000 && earlier.toDateString() === later.toDateString();
};
const EMOJIS = ['❤️', '😂', '🤝', '👀', '✨', '🥹'];
const readDraft = (key) => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const readRetry = (key) => { try { const value = JSON.parse(localStorage.getItem(key)); return /^[a-zA-Z0-9_-]{16,80}$/.test(value?.clientId || '') && typeof value.text === 'string' ? value : null; } catch { return null; } };

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
  const draftKey = `hakoware:message-draft:${currentUserId}:${id}`;
  const [draft, setDraft] = useState(() => readDraft(draftKey).slice(0, 1000));
  const [pendingMessage, setPendingMessage] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [newUpdates, setNewUpdates] = useState(false);
  const listRef = useRef(null);
  const listHeightRef = useRef(null);
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
  const failedSend = useRef(readRetry(`${draftKey}:retry`));
  const pendingReads = useRef(new Set());
  const readBusy = useRef(false);
  const sendBusy = useRef(false);
  const roomRef = useRef(room);
  const milestoneHistory = useRef(null);
  useEffect(() => { milestoneHistory.current = null; }, [id, currentUserId]);
  useEffect(() => {
    if (loading) return;
    const previous = milestoneHistory.current;
    milestoneHistory.current = new Set(room.items.map(item => item.id));
    if (!previous) return;
    const newest = room.items.filter(item => item.milestone && !previous.has(item.id) && Date.now() - new Date(item.createdAt).getTime() < 60000).at(-1);
    if (newest) showGameMoment({ userId: currentUserId, contractId: id, eventId: newest.id, type: newest.type, milestone: newest.milestone, automatic: true });
  }, [room.items, loading, currentUserId, id]);
  roomRef.current = room;
  const conversationTop = useRef(0);
  useEffect(() => {
    try { if (draft) localStorage.setItem(draftKey, draft); else localStorage.removeItem(draftKey); } catch { /* Sending remains available when storage is unavailable. */ }
  }, [draft, draftKey]);
  useLayoutEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    if (nearBottomRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [draft, voiceOpen, contractOpen, pendingMessage]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || contractOpen || !window.ResizeObserver) return undefined;
    const observer = new ResizeObserver(() => {
      listHeightRef.current = list.clientHeight;
      if (nearBottomRef.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [contractOpen]);
  const openContract = (open) => {
    if (open) conversationTop.current = listRef.current?.scrollTop || 0;
    else scrollRef.current = nearBottomRef.current ? { bottom: true } : { restore: conversationTop.current };
    setContractOpen(open);
  };

  const acknowledge = useCallback((items, visibleMessages = false) => {
    const unseen = items.filter((item) => (item.type !== 'MESSAGE' || visibleMessages) && !acknowledged.current.has(item.id));
    if (!unseen.length) return;
    unseen.forEach((item) => acknowledged.current.add(item.id));
    callbacks.current.onActivitySeen?.(unseen);
    unseen.filter((item) => item.type === 'MESSAGE' && !item.mine).forEach((item) => pendingReads.current.add(item.id));
  }, []);
  const syncReads = useCallback(() => {
    const ids = [...pendingReads.current].slice(0, 50);
    if (!ids.length || readBusy.current) return;
    readBusy.current = true;
    void markContractTimelineRead(id, ids).then(() => ids.forEach((eventId) => pendingReads.current.delete(eventId))).catch(() => {}).finally(() => { readBusy.current = false; });
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
  useEffect(() => {
    const list = listRef.current;
    if (!list || contractOpen || loading) return undefined;
    const items = [...room.items, ...(room.focusItem ? [room.focusItem] : [])];
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== 'visible' || list.closest('[inert]')) return;
      const visible = entries.filter((entry) => entry.isIntersecting && entry.intersectionRect.height >= Math.min(entry.boundingClientRect.height, entry.rootBounds?.height || entry.boundingClientRect.height) * .5)
        .map((entry) => items.find((item) => item.id === entry.target.dataset.friendEvent)).filter(Boolean);
      acknowledge(visible, true);
      syncReads();
    }, { root: list, threshold: [0, .1, .25, .5, .6, 1] });
    list.querySelectorAll('[data-friend-event]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [room.items, room.focusItem, contractOpen, loading, acknowledge, syncReads]);
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
  const sendText = async (event, retryText) => {
    event?.preventDefault();
    const text = (retryText ?? draft).trim();
    if (!text || sendBusy.current) return;
    const payload = failedSend.current?.text === text ? failedSend.current : { clientId: crypto.randomUUID(), text };
    failedSend.current = payload; sendBusy.current = true; setSending(true); setSendError('');
    try { localStorage.setItem(`${draftKey}:retry`, JSON.stringify(payload)); } catch { /* The in-memory retry key still prevents duplicate sends. */ }
    setPendingMessage({ id: payload.clientId, text, createdAt: new Date().toISOString(), status: 'SENDING' });
    setEmojiOpen(false);
    try {
      await send(payload);
      if (aliveRef.current) { failedSend.current = null; try { localStorage.removeItem(`${draftKey}:retry`); } catch { /* Optional local storage. */ } setPendingMessage(null); setDraft((value) => value.trim() === text ? '' : value); composerRef.current?.focus({ preventScroll: true }); }
    } catch (err) { if (aliveRef.current) { setSendError(err.message || 'Couldn’t confirm delivery. Retry to send it once.'); setPendingMessage((value) => ({ ...value, status: 'FAILED' })); } }
    finally { sendBusy.current = false; if (aliveRef.current) setSending(false); }
  };
  const insertEmoji = (emoji) => {
    const input = composerRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? start;
    if (draft.length - (end - start) + emoji.length > 1000) return;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(() => { input?.focus({ preventScroll: true }); input?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };
  const shared = socialState?.firstMutualCheckin;
  const moment = socialState?.moment;
  const checkinAvailable = canCheckin(friendship, currentUserId);
  const showHealth = summary.needsAction || checkinAvailable || contractOpen;
  const pendingTimelineItem = pendingMessage && { ...pendingMessage, type: 'MESSAGE', mine: true };
  const renderItem = (item, previous = null, next = null) => {
    const conversation = messageTypes.has(item.type);
    const isFocus = item.id === focusEventId;
    const routine = routineTypes.has(item.type) && !item.milestone && !item.voice && !item.voiceUnavailable && !item.moment;
    return <article key={item.id} data-friend-event={item.id} tabIndex={-1} className={`friend-event ${conversation ? 'conversation' : 'shared-event'} ${routine ? 'is-routine' : ''} ${item.mine ? 'mine' : 'theirs'} ${messagesTogether(previous, item) ? 'is-grouped-before' : ''} ${messagesTogether(item, next) ? 'is-grouped-after' : ''} ${isFocus ? 'is-focused' : ''}`}>
      {conversation ? <>
        <div className={`friend-message-bubble ${item.voice || item.voiceUnavailable ? 'has-voice' : ''}`}>
        {!item.mine && <span className="friend-message-author friend-space-sr-only">{item.actorName}</span>}
        {item.voice ? <VoiceMessage voice={item.voice} /> : <p>{item.text}</p>}
        {item.voiceUnavailable && <small>Audio is no longer available.</small>}
        <span className="friend-message-meta"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>{item.receipt && <span className={`friend-message-receipt ${item.receipt.status === 'READ' ? 'is-read' : ''}`} role="img" aria-label={item.receipt.status === 'READ' ? 'Read by your friend' : 'Sent'} title={item.receipt.status === 'READ' ? 'Read by your friend' : 'Sent'}>{item.receipt.status === 'READ' ? <CheckCheck size={16} /> : <Check size={16} />}</span>}</span>
        {item.mine && item.checkin?.status === 'NEEDS_ACTION' && <span className="friend-message-checkin-note">{item.checkin.reason}</span>}
        </div>
        {item.checkin?.status === 'CHECKED_IN' && <span className="friend-message-checkin"><Check size={13} />Checked in · +{item.checkin.xp} Duo XP</span>}
      </> : <div className="friend-shared-event"><span className="friend-event-label">{item.text}{item.xp > 0 && <small>+{item.xp} Duo XP</small>}</span>
        {item.milestone && <button type="button" className="friend-milestone-replay" onClick={() => showGameMoment({ userId: currentUserId, contractId: id, eventId: item.id, type: item.type, milestone: item.milestone })}>{item.type === 'SEASON_COMPLETED' ? 'Relive the season' : 'A shared win. Take a look.'}</button>}
        {item.voice && <VoiceMessage voice={item.voice} />}
        {item.voiceUnavailable && <small>Older voice check-in · audio isn’t linked here.</small>}
        {item.moment && <div className="friend-moment-reveal"><p>{item.moment.prompt}</p>{item.moment.answers.map((answer, index) => <span key={index}><strong>{answer.name}</strong>{answer.value}</span>)}</div>}
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
        {!item.mine && ['CHECKIN', 'VOICE_CHECKIN'].includes(item.type) && socialState?.latestPartnerCheckin?.eventId === item.id && <div className="friend-event-actions"><button onClick={() => composerRef.current?.focus({ preventScroll: true })}>Reply <MessageCircle size={13} /></button><button onClick={() => openContract(true)}>React </button></div>}
      </div>}
    </article>;
  };
  const focusOutsidePage = room.focusItem && !room.items.some((item) => item.id === room.focusItem.id);
  return <section className="friend-space" style={duoStyle(friendship)} aria-label={`Your space with ${partner?.displayName || 'your friend'}`}>
    <header className="friend-space-header"><button ref={backRef} className="friend-space-back" onClick={onBack} aria-label="Back to your circle"><ArrowLeft size={20} /></button><UserAvatar person={partner} size="sm" decorative /><div className="friend-space-identity"><h1>{friendship.identity?.name || partner?.displayName || 'Your friend'}</h1><span>{friendship.identity?.name ? `With ${partner?.displayName || 'your friend'}` : partner?.username ? '@' + partner.username : 'Your shared space'} · Duo Lv. {friendship.duoLevel || 1}</span></div><button type="button" className="friend-space-style" aria-label="Style your Duo" onClick={() => onAction('SETTINGS', friendship)}><Palette size={18} /></button><button className="friend-space-details" aria-label={contractOpen ? 'Return to conversation' : 'Open contract details'} aria-expanded={contractOpen} onClick={() => openContract(!contractOpen)}><ScrollText size={18} /><span>{contractOpen ? 'Conversation' : 'Contract'}</span><ChevronDown className="friend-details-chevron" size={15} /></button></header>
    {showHealth && <div className={`friend-space-health ${summary.tone}`}><span><i aria-hidden="true" />{summary.label}</span><button onClick={() => onAction(friendship.season?.status === 'COMPLETE' ? 'RECAP' : 'CHECKIN', friendship)} disabled={friendship.season?.status !== 'COMPLETE' && !checkinAvailable}>{friendship.season?.status === 'COMPLETE' ? 'See recap' : checkinAvailable ? 'Check in' : 'Checked in'}<Check size={13} /></button></div>}
    {summary.needsAction && !contractOpen && <button className="friend-space-attention" onClick={() => openContract(true)}><span>{summary.detail}</span></button>}
    {contractOpen ? <div className="friend-space-contract"><ContractDetails friendship={friendship} currentUserId={currentUserId} onAction={onAction} socialState={socialState} onActivitySeen={onActivitySeen} onOpenConversation={() => openContract(false)} /><button className="friend-contract-return" onClick={() => openContract(false)}>Back to conversation <MessageCircle size={16} /></button></div> : <>
      {moment?.status === 'OPEN' && <button className="friend-space-moment" onClick={() => openContract(true)}><span>{moment.type === 'SPLIT_DECISION' ? 'Split Decision' : moment.type === 'DOUBLE_DARE' ? 'Double Dare' : 'Hot Seat'} · {moment.answered ? 'Waiting on them' : 'Your turn'}</span></button>}
      <div className="friend-space-timeline" ref={listRef} onScroll={() => {
        const list = listRef.current;
        // A keyboard resize can emit scroll before ResizeObserver runs. It
        // should not turn following the latest message into reading history.
        if (window.ResizeObserver && listHeightRef.current !== list.clientHeight) return;
        nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 100;
        if (nearBottomRef.current) { setNewUpdates(false); acknowledge(room.items); syncReads(); }
      }}>
        {error && <div className="friend-space-error" role="status"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
        {loading && !room.items.length ? <div className="friend-space-empty" role="status">Opening your space…</div> : <>
          {room.hasMore && <button className="friend-load-older" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Loading…' : 'Earlier messages'}</button>}
          {shared && <div className="friend-first-shared"><span>First check-in together</span><strong>Both showed up.</strong><p>You + {partner?.displayName} · {shared.xp} Duo XP together.</p><button onClick={() => onActivitySeen?.([shared])} aria-label="Dismiss first shared check-in"><X size={16} /></button></div>}
          {focusOutsidePage && <section className="friend-opened-update" aria-label="Opened from Activity"><span>Opened from Activity</span>{renderItem(room.focusItem)}</section>}
          {!room.items.length && !error && <div className="friend-space-empty"><MessageCircle size={28} strokeWidth={1.5} /><strong>Your space with {partner?.displayName}.</strong><p>Leave a message or a voice note. Your check-ins and shared moments stay here.</p></div>}
          {room.items.map((item, index) => <React.Fragment key={item.id}>{(index === 0 || dateLabel(room.items[index - 1].createdAt) !== dateLabel(item.createdAt)) && <div className="friend-timeline-date">{dateLabel(item.createdAt)}</div>}{renderItem(item, room.items[index - 1], room.items[index + 1] || pendingTimelineItem)}</React.Fragment>)}
          {pendingMessage && <article className={`friend-event conversation mine friend-pending-message ${messagesTogether(room.items.at(-1), pendingTimelineItem) ? 'is-grouped-before' : ''} ${pendingMessage.status === 'FAILED' ? 'has-failed' : ''}`}><div className="friend-message-bubble"><p>{pendingMessage.text}</p><span className="friend-message-meta" role="status">{pendingMessage.status === 'SENDING' ? <><LoaderCircle size={14} className="friend-sending-icon" />Sending</> : <><AlertCircle size={14} />Delivery unconfirmed</>}</span></div>{pendingMessage.status === 'FAILED' && <button className="friend-message-retry" type="button" onClick={() => void sendText(null, pendingMessage.text)}>Retry message</button>}</article>}
        </>}
      </div>
      {newUpdates && <button className="friend-new-updates" onClick={() => { listRef.current.scrollTop = listRef.current.scrollHeight; nearBottomRef.current = true; setNewUpdates(false); acknowledge(room.items); syncReads(); }}>New updates <ArrowDown size={15} /></button>}
      <div className="friend-composer-dock">
        {unavailable ? <div className="friend-space-ended" role="status"><p>This contract is no longer available.</p><button onClick={onBack}>Back to your circle</button></div> : <>
        {voiceOpen ? <VoiceMessageComposer friendshipId={id} onCancel={() => { setVoiceOpen(false); composerRef.current?.focus({ preventScroll: true }); }} onSend={async (payload) => { await send(payload); if (aliveRef.current) setVoiceOpen(false); }} /> : <form className={`friend-composer ${draft.trim() ? 'has-draft' : ''}`} onSubmit={sendText}>
          <button type="button" className="friend-compose-voice" onClick={() => setVoiceOpen(true)} disabled={sending} aria-label="Record a voice message"><Mic size={19} /></button>
          <textarea ref={composerRef} aria-label={`Message ${partner?.displayName || 'your friend'}`} placeholder={`Message ${partner?.displayName || 'your friend'}…`} value={draft} maxLength={1000} rows={1} onChange={(event) => { setDraft(event.target.value); if (pendingMessage?.status === 'FAILED' && event.target.value.trim() !== pendingMessage.text) setPendingMessage(null); }} onKeyDown={(event) => { if (event.key === 'Escape') setEmojiOpen(false); if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(pointer:fine)').matches) { event.preventDefault(); void sendText(); } }} />
          <button type="button" className="friend-compose-emoji" aria-label="Add an emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((value) => !value)}><Smile size={19} /></button>
          <button className="friend-compose-send" type="submit" disabled={!draft.trim() || sending} aria-label={sending ? 'Sending message' : 'Send message'}>{sending ? <LoaderCircle size={18} className="friend-sending-icon" /> : <Send size={18} />}</button>
        </form>}
        {emojiOpen && !voiceOpen && <div className="friend-emoji-tray" role="group" aria-label="Message emojis" onKeyDown={(event) => { if (event.key === 'Escape') { setEmojiOpen(false); composerRef.current?.focus({ preventScroll: true }); } }}>{EMOJIS.map((emoji) => <button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}
        {sendError && <p className="friend-send-error" role="status">{sendError} Your message is kept here so you can retry.</p>}
        <div className="friend-composer-context"><span>{sending ? 'Sending…' : room.checkin?.reason || 'Messages stay in your shared space.'}{draft.length >= 850 && <small className="friend-message-count">{draft.length}/1000</small>}</span><button type="button" className="friend-duel-entry" onClick={() => onAction('DUEL', friendship)}><Swords size={14} />Card duel</button></div>
      </>}
      </div>
    </>}
  </section>;
};
