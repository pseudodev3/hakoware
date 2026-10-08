import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, EyeOff, Flame, HelpCircle, MessageCircle, Plus, Radio, RefreshCw, Send, Sparkles, Swords, Users } from 'lucide-react';
import {
  answerAfterHours, createAfterHoursPost, getAfterHours, getAfterHoursReplies,
  joinAfterHoursChallenge, leaveAfterHoursNote, reactAfterHours, replyAfterHours,
  sparkAfterHours, tagInAfterHours, throwAfterHoursChallenge, voteAfterHours
} from '../../services/afterHoursService';
import { Modal } from '../../shared/components/Modal';
import { UserAvatar } from '../../shared/components/UserAvatar';
import './AfterHoursView.css';

const POST_MODES = [
  { id: 'SHOUT', label: 'Shout', placeholder: 'Say something to the room…' },
  { id: 'HOT_TAKE', label: 'Hot take', placeholder: 'Drop a take people can judge…' },
  { id: 'CONFESSION', label: 'Confession', placeholder: 'Say the thing you probably should not…' },
  { id: 'QUESTION', label: 'Ask', placeholder: 'Ask everybody something…' }
];
const SOCIAL_POST_TYPES = new Set(POST_MODES.map((mode) => mode.id));
const personLabel = (person) => person?.displayName || person?.username || 'Someone';
const username = (person) => String(person?.username || '').toLowerCase();
const clean = (text) => text.replace(/\s+/g, ' ').trim();
const relativeTime = (value) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
};
const mergeReplies = (previous, next) => [...new Map([...previous, ...next].map((reply) => [reply.id, reply])).values()]
  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a.id).localeCompare(String(b.id)));
const dialogKey = (dialog) => dialog ? `${dialog.type}:${dialog.postId || dialog.item?.id || dialog.person?.username || ''}:${dialog.replyId || ''}` : '';

// The shared Modal supplies layout and Escape; these intents also trap focus,
// make the background inert, and restore the actual control that opened them.
const AfterHoursDialog = ({ dialog, title, onClose, footer, children, initialSelector }) => {
  const key = dialogKey(dialog);
  const selectorRef = useRef(initialSelector);
  selectorRef.current = initialSelector;
  useEffect(() => {
    if (!key) return undefined;
    const opener = document.activeElement;
    const shell = document.querySelector('.app-layout');
    const wasInert = shell?.inert;
    if (shell) shell.inert = true;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      root.style.setProperty('--after-hours-viewport-height', `${viewport?.height || innerHeight}px`);
      root.style.setProperty('--after-hours-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    const getDialog = () => [...document.querySelectorAll('.modal-content')].find((element) => element.querySelector('.after-hours-dialog-body'));
    const frame = requestAnimationFrame(() => {
      const element = getDialog();
      const initial = element?.querySelector(selectorRef.current || '[autofocus]') || element?.querySelector('.modal-close');
      initial?.focus({ preventScroll: true });
      if (initial?.hasAttribute('data-after-hours-reply')) initial.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const element = getDialog();
      const controls = [...(element?.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]') || [])]
        .filter((control) => control.getBoundingClientRect().width && control.getBoundingClientRect().height && (control.tagName === 'SUMMARY' || !control.closest('details:not([open])')));
      if (!controls.length) return;
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', trap);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      root.style.removeProperty('--after-hours-viewport-height');
      root.style.removeProperty('--after-hours-viewport-top');
      if (shell) shell.inert = Boolean(wasInert);
      if (opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
      else document.querySelector('.after-hours-header h1')?.focus({ preventScroll: true });
    };
  }, [key]);
  return <Modal isOpen title={title} onClose={onClose} footer={footer}><div className="after-hours-dialog-body">{children}</div></Modal>;
};

export const AfterHoursView = ({ user, friendships = [], focusActivityId = null, focusRequestKey = '', onFocusHandled, onStartContract, onOpenFriend, onNavigate, showToast, wallRetired = false, onDismissRetiredWall }) => {
  const headingRef = useRef(null);
  const alive = useRef(true);
  const request = useRef(0);
  const busyRef = useRef(false);
  const focusRef = useRef(focusActivityId);
  focusRef.current = focusActivityId;
  const handledFocus = useRef(null);
  const replyKeys = useRef({});
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState(null);
  const dialogRef = useRef(null);
  dialogRef.current = dialog;
  const [thread, setThread] = useState(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [focusNotice, setFocusNotice] = useState(null);
  const [postType, setPostType] = useState('SHOUT');
  const [postText, setPostText] = useState('');
  const [postAnonymous, setPostAnonymous] = useState(true);
  const [burnAmount, setBurnAmount] = useState(0);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [customChallenge, setCustomChallenge] = useState('');
  const [challengeReplies, setChallengeReplies] = useState({});
  const applyRoom = useCallback((next) => {
    setRoom(next);
    setThread((current) => {
      if (!current) return current;
      const post = next?.feed?.find((item) => item.id === current.post.id);
      if (!post) {
        const unavailableTarget = next?.focus?.status === 'unavailable' && (next.focus.requestedId === current.post.id || current.replies.some((reply) => reply.id === next.focus.requestedId));
        return unavailableTarget ? { ...current, unavailable: true } : current;
      }
      // A disjoint newest page means a long absence may have left a gap. If
      // pages overlap, preserve progress through earlier history instead.
      const newestPage = (post.replies || []).slice(-20);
      const hasOverlap = newestPage.some((reply) => current.replies.some((loaded) => loaded.id === reply.id));
      const refreshCursor = !current.loadedOlder || (post.repliesHasMore && !hasOverlap);
      return { ...current, post, unavailable: false, replies: mergeReplies(current.replies, post.replies || []), ...(refreshCursor ? { hasMore: Boolean(post.repliesHasMore), nextCursor: post.repliesNextCursor || null, loadedOlder: false } : {}) };
    });
  }, []);
  const loadRoom = useCallback(async ({ quiet = false } = {}) => {
    if (quiet && busyRef.current) return;
    const generation = ++request.current;
    try {
      const target = focusRef.current;
      const next = await getAfterHours({ activityId: target && target !== 'room-event' ? target : null });
      if (alive.current && generation === request.current) { applyRoom(next); setError(''); setLoading(false); }
    } catch (err) {
      if (alive.current && generation === request.current) setError(err.message || 'Could not open After Hours');
    } finally { if (alive.current && generation === request.current) setLoading(false); }
  }, [applyRoom]);
  useEffect(() => {
    alive.current = true;
    void loadRoom();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void loadRoom({ quiet: true }); }, 15000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive.current = false; request.current += 1; clearInterval(timer); clearInterval(clock); };
  }, [loadRoom, focusActivityId]);

  const openDialog = useCallback((next) => { setFormError(''); setDialog(next); }, []);
  const closeDialog = () => { setFormError(''); setDialog((current) => current?.previous || null); };
  const openThread = useCallback((post, replyId = null, persist = false) => {
    setThread((current) => current?.post.id === post.id ? { ...current, post, unavailable: false, replies: mergeReplies(current.replies, post.replies || []) } : { post, replies: post.replies || [], hasMore: Boolean(post.repliesHasMore), nextCursor: post.repliesNextCursor || null, loadedOlder: false, error: '', unavailable: false });
    openDialog({ type: 'thread', postId: post.id, replyId });
    if (persist) onNavigate?.('afterHours', { focusActivityId: replyId || post.id, replace: true });
  }, [openDialog, onNavigate]);
  useEffect(() => {
    if (!focusActivityId || loading || !room) return undefined;
    const key = `${focusRequestKey}:${focusActivityId}`;
    if (handledFocus.current === key) return undefined;
    if (focusActivityId !== 'room-event' && room.focus?.requestedId !== focusActivityId) return undefined;
    handledFocus.current = key;
    if (focusActivityId === 'room-event') {
      const frame = requestAnimationFrame(() => {
        const target = document.querySelector('.after-hours-pin');
        target?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        target?.focus({ preventScroll: true });
        onFocusHandled?.();
      });
      return () => cancelAnimationFrame(frame);
    }
    const target = room.feed?.find((item) => item.id === (room.focus?.postId || focusActivityId) || item.replies?.some((reply) => reply.id === focusActivityId));
    if (room.focus?.status === 'unavailable' || !target) {
      setFocusNotice('This post or reply is no longer available.');
      onFocusHandled?.();
      return undefined;
    }
    setFocusNotice(null);
    if (SOCIAL_POST_TYPES.has(target.type)) openThread(target, room.focus?.replyId || (target.id !== focusActivityId ? focusActivityId : null));
    else requestAnimationFrame(() => document.querySelector(`[data-after-hours-activity="${target.id}"]`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
    onFocusHandled?.();
    return undefined;
  }, [room, loading, focusActivityId, focusRequestKey, onFocusHandled, openThread]);

  const event = room?.roomEvent;
  const ownUsername = username(user);
  const postLimit = Number(room?.composer?.socialPostMaxLength) || 160;
  const replyLimit = Number(room?.composer?.replyMaxLength) || 100;
  const challengeLimit = Number(room?.composer?.challengeMaxLength) || 96;
  const burnOptions = room?.composer?.burnOptions || [5, 10, 25];
  const sparkAmount = Number(room?.aura?.sparkAmount) || 1;
  const viewerAuraBalance = Number(room?.viewerAuraBalance) || 0;
  const others = (room?.people || []).filter((person) => !person.isYou && username(person) !== ownUsername);
  const selectedPerson = dialog?.type === 'person' ? dialog.person : null;
  const selectedPresence = selectedPerson ? others.find((person) => username(person) === username(selectedPerson)) : null;
  const existingFriendship = selectedPerson ? friendships.find((friendship) => [friendship.user1, friendship.user2].some((person) => username(person) === username(selectedPerson))) : null;
  const canTagSelected = Boolean(selectedPresence && event?.viewerAnswer && !selectedPresence.answeredCurrent);
  const run = async (key, operation, successMessage, finish) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(key); setFormError(''); request.current += 1;
    try {
      const next = await operation();
      if (!alive.current) return false;
      applyRoom(next); finish?.(next);
      if (successMessage) showToast?.(successMessage, 'SUCCESS');
      return true;
    } catch (err) {
      if (alive.current) { setFormError(err.message || 'Could not complete this action'); if (!dialogRef.current) showToast?.(err.message || 'Could not complete this action', 'ERROR'); }
      return false;
    } finally { busyRef.current = false; if (alive.current) setBusy(null); }
  };
  const openPerson = (person) => {
    if (!person?.username || username(person) === ownUsername) return;
    setNoteOpen(false);
    openDialog({ type: 'person', person, previous: dialog?.type === 'thread' ? dialog : null });
  };
  const submitPost = (eventObject) => {
    eventObject.preventDefault(); const text = clean(postText);
    if (!text) return;
    void run('post', () => createAfterHoursPost({ type: postType, text, anonymous: postType === 'CONFESSION' && postAnonymous, burnAmount }), 'Posted.', () => { setPostText(''); setBurnAmount(0); setDialog(null); });
  };
  const submitReply = (eventObject) => {
    eventObject.preventDefault(); const post = thread?.post; const text = clean(replyDrafts[post?.id] || '');
    if (!post || !text || post.canReply === false || thread.unavailable) return;
    if (replyKeys.current[post.id]?.text !== text) replyKeys.current[post.id] = { text, clientId: crypto.randomUUID() };
    void run('reply', () => replyAfterHours(post.id, text, replyKeys.current[post.id].clientId), null, () => {
      delete replyKeys.current[post.id]; setReplyDrafts((drafts) => ({ ...drafts, [post.id]: '' }));
      requestAnimationFrame(() => document.querySelector('.after-hours-thread-composer textarea')?.focus({ preventScroll: true }));
    });
  };
  const loadReplies = async () => {
    if (!thread?.nextCursor || loadingReplies || thread.unavailable) return;
    const postId = thread.post.id; const cursor = thread.nextCursor; setLoadingReplies(true);
    try {
      const page = await getAfterHoursReplies(postId, { before: cursor });
      if (alive.current) setThread((current) => current?.post.id === postId ? { ...current, replies: mergeReplies(current.replies, page.replies || []), hasMore: Boolean(page.hasMore), nextCursor: page.nextCursor || null, loadedOlder: true, error: '' } : current);
    } catch (err) { if (alive.current) setThread((current) => current?.post.id === postId ? { ...current, error: err.message || 'Could not load earlier replies' } : current); }
    finally { if (alive.current) setLoadingReplies(false); }
  };
  const reactionSummary = (item) => Object.entries(item.reactions?.counts || {}).filter(([, count]) => Number(count) > 0);
  const renderReact = (item, isOwn = item.isOwn, unavailable = false) => {
    const counts = reactionSummary(item);
    if (isOwn) return counts.length ? <span className="after-hours-react-summary" aria-label={`${counts.reduce((sum, [, count]) => sum + Number(count), 0)} reactions`}>{counts.map(([reaction, count]) => <span key={reaction}>{reaction} {count}</span>)}</span> : null;
    return <button type="button" className="after-hours-react-open" onClick={() => openDialog({ type: 'react', item, previous: dialog?.type === 'thread' ? dialog : null })} disabled={Boolean(busy) || unavailable}><span>{item.reactions?.viewerReaction || 'React'}</span>{counts.length > 0 && <span className="after-hours-react-summary">{counts.map(([reaction, count]) => <span key={reaction}>{reaction} {count}</span>)}</span>}</button>;
  };
  const renderSpark = (item, isOwn = item.isOwn, unavailable = false) => isOwn ? (item.spark?.total > 0 && <span className="after-hours-spark-count"><Sparkles size={14} />{item.spark.total} Aura</span>) : <button type="button" className={`after-hours-spark ${item.spark?.viewerSparked ? 'is-sparked' : ''}`} disabled={Boolean(busy) || Boolean(item.spark?.viewerSparked) || unavailable || viewerAuraBalance < sparkAmount} onClick={() => void run(`spark:${item.id}`, () => sparkAfterHours(item.id), `Spark sent · ${sparkAmount} Aura`)} aria-label={item.spark?.viewerSparked ? 'Already Sparked' : `Send Aura Spark · ${sparkAmount} Aura`}><Sparkles size={14} /><span>{item.spark?.viewerSparked ? 'Sparked' : `Spark · ${sparkAmount} Aura`}</span>{item.spark?.total > 0 && <small>{item.spark.total}</small>}</button>;
  const author = (item) => <header className="after-hours-post-header">
    {item.anonymous ? <div className="after-hours-post-author"><span className="after-hours-anonymous-avatar"><EyeOff size={18} /></span><div className="after-hours-feed-meta"><strong>{item.isOwn ? 'Anonymous · you' : 'Anonymous'}</strong><span>Confession</span></div></div> : <button type="button" className="after-hours-post-author" disabled={item.isOwn} onClick={() => openPerson(item.actor)} aria-label={item.isOwn ? 'You' : `Open @${item.actor?.username}`}><UserAvatar person={item.actor} size="md" decorative /><span className="after-hours-feed-meta"><strong>{item.isOwn ? 'You' : personLabel(item.actor)}</strong><span>@{item.actor?.username}</span></span></button>}
    <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
  </header>;
  const renderPost = (item, inThread = false) => <>
    {author(item)}
    {item.type !== 'SHOUT' && !item.anonymous && SOCIAL_POST_TYPES.has(item.type) && <span className="after-hours-post-type">{POST_MODES.find((mode) => mode.id === item.type)?.label}</span>}
    <p className="after-hours-social-post">{item.text}</p>
    {item.burnAmount > 0 && <span className="after-hours-burn-badge"><Flame size={13} />{item.burnAmount} Aura burned</span>}
    {item.type === 'HOT_TAKE' && <div className="after-hours-hot-take-vote" aria-label="Judge this hot take">{['REAL', 'NONSENSE'].map((vote) => <button type="button" key={vote} disabled={item.isOwn || Boolean(busy) || (inThread && thread?.unavailable)} aria-pressed={item.vote?.viewerVote === vote} onClick={() => void run(`vote:${item.id}`, () => voteAfterHours(item.id, vote))}>{vote === 'REAL' ? 'real' : 'nonsense'}{(item.isOwn || item.vote?.viewerVote) && <strong>{Number(vote === 'REAL' ? item.vote?.realPercent : item.vote?.nonsensePercent) || 0}%</strong>}</button>)}</div>}
    {!inThread && (item.replies || []).length > 0 && <button type="button" className="after-hours-reply-preview" onClick={() => openThread(item, null, true)} aria-label={`Read ${item.replyCount ?? item.replies.length} replies to ${item.anonymous ? 'an anonymous post' : personLabel(item.actor) + '’s post'}`}>{item.replies.slice(-2).map((reply) => <span key={reply.id}><strong>{reply.isOwn ? 'You' : personLabel(reply.actor)}</strong> {reply.text}</span>)}</button>}
    <div className="after-hours-social-tools">{renderReact(item, item.isOwn, inThread && thread?.unavailable)}{renderSpark(item, item.isOwn, inThread && thread?.unavailable)}{!inThread && <button type="button" className="after-hours-reply-toggle" onClick={() => openThread(item, null, true)}><MessageCircle size={15} />{item.canReply === false ? 'View replies' : 'Reply'}{Number(item.replyCount) > 0 && <small>{item.replyCount}</small>}</button>}</div>
  </>;
  const renderReply = (reply) => <article key={reply.id} className={`after-hours-reply ${dialog?.replyId === reply.id ? 'is-focused' : ''}`} data-after-hours-reply={reply.id} tabIndex={-1}>
    <button type="button" className="after-hours-reply-person" disabled={reply.isOwn} aria-label={reply.isOwn ? 'You' : `Open @${reply.actor?.username}`} onClick={() => openPerson(reply.actor)}><UserAvatar person={reply.actor} size="sm" decorative /></button>
    <div className="after-hours-reply-copy"><div className="after-hours-reply-meta"><strong>{reply.isOwn ? 'You' : personLabel(reply.actor)}</strong><time dateTime={reply.createdAt}>{relativeTime(reply.createdAt)}</time></div><p>{reply.text}</p><div className="after-hours-reply-tools">{renderReact(reply, reply.isOwn, thread?.unavailable)}{renderSpark(reply, reply.isOwn, thread?.unavailable)}</div></div>
  </article>;
  const secondsLeft = Math.max(0, Math.ceil((new Date(event?.endsAt || 0).getTime() - now) / 1000));
  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const dialogTitle = dialog?.type === 'thread' ? 'Replies' : dialog?.type === 'post' ? 'Share something' : dialog?.type === 'person' ? '@' + selectedPerson?.username : dialog?.type === 'react' ? 'React' : dialog?.type === 'answer' ? 'Answer challenge' : 'Throw a challenge';
  const replyDraft = replyDrafts[thread?.post.id] || '';
  const threadFooter = dialog?.type === 'thread' ? thread?.post.canReply !== false ? <form className="after-hours-thread-composer" onSubmit={submitReply}>
    <textarea rows={2} maxLength={replyLimit} disabled={busy === 'reply' || thread?.unavailable} aria-label="Reply publicly" placeholder="Keep the conversation going…" value={replyDraft} onChange={(eventObject) => { const value = eventObject.target.value.slice(0, replyLimit); if (replyKeys.current[thread.post.id]?.text !== clean(value)) delete replyKeys.current[thread.post.id]; setReplyDrafts((drafts) => ({ ...drafts, [thread.post.id]: value })); }} />
    <div className="after-hours-thread-send"><span>{replyDraft.length}/{replyLimit} · public reply</span><button type="submit" disabled={!clean(replyDraft) || Boolean(busy) || thread?.unavailable} aria-label="Send reply"><Send size={17} /></button></div>
    {thread?.unavailable && <p className="after-hours-compose-note" role="status">This post is no longer available. Your draft is kept until you leave the room.</p>}
    {formError && <p className="after-hours-form-error" role="alert">{formError}</p>}
  </form> : <p className="after-hours-compose-note">{thread?.unavailable ? 'This post is no longer available.' : 'Replies are unavailable on your anonymous confession.'}</p> : dialog?.type === 'post' ? <button form="after-hours-post-form" type="submit" className="after-hours-submit" disabled={!clean(postText) || Boolean(busy)}>{busy === 'post' ? 'Posting…' : 'Post'}<Send size={16} /></button> : null;

  return <>
    <section className="after-hours">
      <header className="after-hours-header"><div><h1 id="after-hours-heading" ref={headingRef} tabIndex={-1}>After Hours</h1><p>A room to cross paths.</p></div><div className="after-hours-presence" aria-label={`${others.length} other ${others.length === 1 ? 'person' : 'people'} here`}><Radio size={15} /><span>{loading ? 'Opening…' : others.length ? `${others.length} ${others.length === 1 ? 'other' : 'others'} here` : 'Just you here'}</span></div></header>
      {wallRetired && <div className="after-hours-retired-notice" role="status"><p>The wall has closed. Your cards are still in your collection.</p><button type="button" onClick={() => { onDismissRetiredWall?.(); requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true })); }}>Dismiss</button></div>}
      {focusNotice && <div className="after-hours-focus-notice" role="status"><p>{focusNotice}</p><button type="button" onClick={() => { setFocusNotice(null); onNavigate?.('afterHours', { replace: true }); requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true })); }}>Return to room</button></div>}
      {loading ? <p role="status" className="after-hours-loading">Opening the room…</p> : !room ? <div className="after-hours-feed-empty" role="status"><p>{error || 'The room did not open.'}</p><button type="button" onClick={() => void loadRoom()}><RefreshCw size={16} />Try again</button></div> : <>
        {others.length > 0 && <section className="after-hours-around" aria-label="Other people here"><div className="after-hours-around-list">{others.map((person) => <button type="button" className="after-hours-person-chip" key={person.username} aria-label={`Open @${person.username}`} onClick={() => openPerson(person)}><UserAvatar person={person} size="sm" decorative /><span>{personLabel(person)}</span></button>)}</div></section>}
        <div className="after-hours-share"><button type="button" className="after-hours-share-open" onClick={() => openDialog({ type: 'post' })}><UserAvatar person={user} size="sm" decorative /><span>{postText ? 'Continue your draft…' : 'Share something…'}</span><Plus size={18} /></button><button type="button" className="after-hours-challenge-toggle" onClick={() => openDialog({ type: 'challenge' })}><Swords size={15} /><span>Challenge</span></button></div>
        <section className="after-hours-feed" aria-label="Room posts"><div className="after-hours-section-label"><span>In the room</span><small>Posts stay for 48h</small></div>
          {!room.feed?.length ? <div className="after-hours-feed-empty"><Users size={22} /><h2>The room is quiet.</h2><p>Leave something for whoever drops in next.</p><button type="button" onClick={() => openDialog({ type: 'post' })}>Share the first post<ArrowRight size={15} /></button></div> : <div className="after-hours-feed-list">{room.feed.map((item) => <article className="after-hours-feed-item" key={item.id} data-after-hours-activity={item.id} tabIndex={-1}>
            {SOCIAL_POST_TYPES.has(item.type) ? renderPost(item) : <>{author(item)}{item.type === 'CHALLENGE' ? <><span className="after-hours-post-type">Challenge</span><p className="after-hours-social-post">{item.text}</p><div className="after-hours-social-tools"><span>{item.joinCount || 0} answered</span>{item.canJoin && !item.viewerJoined && <button type="button" onClick={() => openDialog({ type: 'answer', item })}>Answer<ArrowRight size={14} /></button>}{item.viewerJoined && <span>Answered</span>}{renderReact(item)}</div></> : <><p className="after-hours-social-post">{item.text}</p>{item.type === 'CHALLENGE_JOIN' && item.target?.username && <small>Answered @{item.target.username}’s challenge</small>}{renderReact(item)}</>}</>}
          </article>)}</div>}
        </section>
        {event && <section className="after-hours-pin after-hours-room-question" tabIndex={-1} aria-labelledby="after-hours-question"><div><span><HelpCircle size={14} />Room question</span><h2 id="after-hours-question">{event.text}</h2><small>{event.totalAnswers || 0} answered · {timeLabel}</small></div>{!event.viewerAnswer ? <div className="after-hours-room-question-options">{(event.options || []).map((option) => <button type="button" key={option} disabled={Boolean(busy)} onClick={() => void run('answer', () => answerAfterHours(event.roundKey, option))}>{option}</button>)}</div> : <div className="after-hours-room-question-results">{(event.options || []).map((option) => <div key={option} className={event.viewerAnswer === option ? 'is-yours' : ''}><span>{option}</span><strong>{event.totalAnswers ? Math.round((Number(event.tally?.[option]) || 0) / event.totalAnswers * 100) : 0}%</strong></div>)}</div>}</section>}
      </>}
    </section>
    {dialog && <AfterHoursDialog dialog={dialog} title={dialogTitle} onClose={closeDialog} footer={threadFooter} initialSelector={dialog.type === 'thread' && dialog.replyId ? `[data-after-hours-reply="${dialog.replyId}"]` : dialog.type === 'post' ? '[aria-label="After Hours post"]' : dialog.type === 'thread' ? '.after-hours-thread-composer textarea' : undefined}>
      {dialog.type === 'post' && <form id="after-hours-post-form" onSubmit={submitPost}>
        <div className="after-hours-post-modes" role="group" aria-label="Post type">{POST_MODES.map((mode) => <button type="button" key={mode.id} aria-pressed={postType === mode.id} disabled={busy === 'post'} onClick={() => setPostType(mode.id)}>{mode.label}</button>)}</div>
        <div className="after-hours-compose-input"><textarea rows={4} maxLength={postLimit} disabled={busy === 'post'} value={postText} onChange={(eventObject) => setPostText(eventObject.target.value.slice(0, postLimit))} aria-label="After Hours post" placeholder={POST_MODES.find((mode) => mode.id === postType)?.placeholder} /><span>{postText.length}/{postLimit}</span></div>
        {postType === 'CONFESSION' && <p className="after-hours-compose-note">{postAnonymous ? 'This confession posts anonymously.' : 'Your name will appear on this confession.'}</p>}
        <details className="after-hours-compose-options"><summary>Post options</summary>{postType === 'CONFESSION' && <button type="button" className="after-hours-anonymous" aria-pressed={postAnonymous} disabled={busy === 'post'} onClick={() => setPostAnonymous((value) => !value)}><EyeOff size={15} />{postAnonymous ? 'Anonymous' : 'Use my name'}</button>}<div className="after-hours-burn-picker" aria-label="Optional Aura burn"><span><Flame size={14} />Burn Aura</span>{[0, ...burnOptions].map((amount) => <button type="button" key={amount} aria-pressed={burnAmount === amount} disabled={busy === 'post' || viewerAuraBalance < amount} onClick={() => setBurnAmount(amount)}>{amount || 'None'}</button>)}</div><p className="after-hours-compose-note">A burn spends your Aura and shows on the post.</p></details>
      </form>}
      {dialog.type === 'thread' && thread && <div className="after-hours-thread"><article className="after-hours-thread-post">{renderPost(thread.post, true)}</article><section className="after-hours-thread-replies" aria-label="Public replies">{thread.hasMore && <button type="button" className="after-hours-load-replies" disabled={loadingReplies || thread?.unavailable} onClick={() => void loadReplies()}>{loadingReplies ? 'Loading…' : 'Earlier replies'}</button>}{thread.error && <p className="after-hours-form-error" role="alert">{thread.error}</p>}{!thread.replies.length && <p className="after-hours-compose-note">No replies yet. Start the conversation.</p>}{thread.replies.map(renderReply)}</section></div>}
      {dialog.type === 'react' && <div className="after-hours-reaction-picker">{(room?.reactions || ['💀', '👀', '😭', '🤝']).map((reaction) => <button type="button" key={reaction} aria-label={`React ${reaction}`} aria-pressed={dialog.item.reactions?.viewerReaction === reaction} disabled={Boolean(busy)} onClick={() => void run('reaction', () => reactAfterHours(dialog.item.id, reaction), null, closeDialog)}><span>{reaction}</span><small>{Number(dialog.item.reactions?.counts?.[reaction]) || 0}</small></button>)}</div>}
      {dialog.type === 'person' && selectedPerson && <div className="after-hours-person-sheet"><header><UserAvatar person={selectedPerson} size="lg" decorative /><div><h3>{personLabel(selectedPerson)}</h3><p>@{selectedPerson.username}</p></div></header><div className="after-hours-person-sheet-actions">
        {existingFriendship?.status === 'ACTIVE' ? <button type="button" className="after-hours-submit" onClick={() => { setDialog(null); onOpenFriend?.(existingFriendship); }}>Open conversation<MessageCircle size={16} /></button> : existingFriendship ? <button type="button" className="after-hours-submit" onClick={() => { setDialog(null); onNavigate?.('contracts'); }}>Review invitation<ArrowRight size={16} /></button> : <button type="button" className="after-hours-submit" onClick={() => { setDialog(null); onStartContract?.(selectedPerson); }}>Start contract<ArrowRight size={16} /></button>}
        <button type="button" disabled={!selectedPresence} onClick={() => setNoteOpen((value) => !value)}>Leave a note<MessageCircle size={15} /></button>{!selectedPresence && <p className="after-hours-compose-note">Notes are available while this person is here.</p>}
        {noteOpen && selectedPresence && <form className="after-hours-custom-challenge" onSubmit={(eventObject) => { eventObject.preventDefault(); if (clean(noteText)) void run('note', () => leaveAfterHoursNote(selectedPerson.username, clean(noteText)), 'Note sent.', () => { setNoteText(''); setNoteOpen(false); }); }}><input aria-label={`Leave a note for @${selectedPerson.username}`} placeholder="One short note. No thread." maxLength={60} value={noteText} onChange={(eventObject) => setNoteText(eventObject.target.value.slice(0, 60))} /><button type="submit" disabled={!clean(noteText) || Boolean(busy)} aria-label="Send note"><Send size={16} /></button></form>}
        {canTagSelected && <button type="button" disabled={Boolean(busy)} onClick={() => void run('tag', () => tagInAfterHours(selectedPresence.username), 'Tagged into the room question.', closeDialog)}>Tag into room question</button>}
      </div></div>}
      {dialog.type === 'challenge' && <><form className="after-hours-custom-challenge" onSubmit={(eventObject) => { eventObject.preventDefault(); if (clean(customChallenge)) void run('challenge', () => throwAfterHoursChallenge({ text: clean(customChallenge) }), 'Challenge is live.', () => { setCustomChallenge(''); setDialog(null); }); }}><input aria-label="Custom challenge" maxLength={challengeLimit} placeholder="Write a challenge…" value={customChallenge} onChange={(eventObject) => setCustomChallenge(eventObject.target.value.slice(0, challengeLimit))} /><button type="submit" disabled={!clean(customChallenge) || Boolean(busy)}>Throw</button></form><div className="after-hours-challenge-suggestions">{(room?.composer?.challenges || []).map((challenge) => <button type="button" key={challenge.id} disabled={Boolean(busy)} onClick={() => void run('challenge', () => throwAfterHoursChallenge({ promptId: challenge.id }), 'Challenge is live.', () => setDialog(null))}>{challenge.text}<Swords size={15} /></button>)}</div></>}
      {dialog.type === 'answer' && <form className="after-hours-custom-challenge" onSubmit={(eventObject) => { eventObject.preventDefault(); const text = clean(challengeReplies[dialog.item.id] || ''); if (text) void run('join', () => joinAfterHoursChallenge(dialog.item.id, text), 'Answer sent.', () => { setChallengeReplies((drafts) => ({ ...drafts, [dialog.item.id]: '' })); setDialog(null); }); }}><p>{dialog.item.text}</p><input aria-label="Answer challenge" maxLength={Number(room?.composer?.shoutMaxLength) || 88} value={challengeReplies[dialog.item.id] || ''} onChange={(eventObject) => setChallengeReplies((drafts) => ({ ...drafts, [dialog.item.id]: eventObject.target.value }))} placeholder="Your one-line answer…" /><button type="submit" disabled={!clean(challengeReplies[dialog.item.id] || '') || Boolean(busy)}>Send</button></form>}
      {formError && dialog.type !== 'thread' && <p className="after-hours-form-error" role="alert">{formError}</p>}
    </AfterHoursDialog>}
  </>;
};
