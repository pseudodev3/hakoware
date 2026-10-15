import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { PageHeading } from '../../shared/components/PageHeading';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { createSpark, deleteSpark, fetchSparkPhoto, getPreviousActivity, getSpark, getSparks, reactSpark, replySpark } from '../../services/sparkService';
import { prepareSparkPhoto } from '../../lib/sparkPhoto';
import { sparkFailure } from '../../lib/sparkAvailability';
import './SparksView.css';

const REACTIONS = ['❤️', '😂', '👀', '🤝', '✨'];
const label = person => person?.displayName || person?.username || 'Your friend';
const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const save = (key, value) => { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* Draft storage is optional. */ } };
const merge = (previous, next) => [...new Map([...previous, ...next].map(item => [item.id, item])).values()];
const time = value => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const SparkPhoto = ({ src, author }) => {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true; let objectUrl;
    setUrl(null); setError(false);
    void fetchSparkPhoto(src).then(blob => {
      if (!alive) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, attempt]);
  return <div className={`spark-photo ${!url ? 'is-loading' : ''}`}>
    {url ? <img src={url} alt={`${label(author)}’s shared photo`} onError={() => { setUrl(null); setError(true); }} /> : error ? <button type="button" onClick={() => setAttempt(value => value + 1)}>Photo unavailable · Retry</button> : <span role="status"><LoaderCircle size={20} className="spark-spinner" />Opening photo…</span>}
  </div>;
};

const SparkCard = ({ post, onOpen, onReact, busy = false, children }) => <article className={`spark-card ${post.imageUrl ? 'has-photo' : 'is-thought'}`}>
  <header className="spark-card-header"><UserAvatar person={post.author} size="sm" decorative /><div><strong>{label(post.author)}{post.mine && <small>you</small>}</strong><time dateTime={post.createdAt}>{time(post.createdAt)}</time></div>{children}</header>
  {post.imageUrl && <SparkPhoto src={post.imageUrl} author={post.author} />}
  {post.text && <p className="spark-card-thought">{post.text}</p>}
  <footer className="spark-card-footer"><div className="spark-reactions" role="group" aria-label={`Reactions to ${label(post.author)}’s Spark`}>
    {REACTIONS.map(emoji => <button type="button" key={emoji} aria-label={`React ${emoji}`} aria-pressed={post.viewerReaction === emoji} disabled={busy} onClick={() => onReact(post, post.viewerReaction === emoji ? null : emoji)}><span aria-hidden="true">{emoji}</span>{post.reactions?.find(reaction => reaction.emoji === emoji)?.count > 0 && <small>{post.reactions.find(reaction => reaction.emoji === emoji).count}</small>}</button>)}
  </div><button className="spark-open-replies" type="button" onClick={() => onOpen(post.id)}><MessageCircle size={16} />{post.replyCount ? `${post.replyCount} repl${post.replyCount === 1 ? 'y' : 'ies'}` : 'Reply'}</button></footer>
</article>;

const SparkComposer = ({ user, onClose, onShared }) => {
  const key = `hakoware:spark-draft:${user.uid || user.id || user._id}`;
  const [text, setText] = useState(() => read(key).slice(0, 280));
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const retry = useRef(read(`${key}:retry`) || crypto.randomUUID());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { save(key, text); }, [key, text]);
  useEffect(() => { if (!photo) { setPreview(null); return undefined; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  const selectPhoto = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busyRef.current) return;
    setPreparing(true); setError('');
    try { const value = await prepareSparkPhoto(file); if (alive.current) { setPhoto(value); retry.current = crypto.randomUUID(); save(`${key}:retry`, ''); } }
    catch (failure) { if (alive.current) setError(failure.message); }
    finally { if (alive.current) setPreparing(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (busyRef.current || preparing || (!text.trim() && !photo)) return;
    busyRef.current = true; setBusy(true); setError(''); save(`${key}:retry`, retry.current);
    try {
      const result = await createSpark({ text: text.trim(), photo, clientId: retry.current });
      save(key, ''); save(`${key}:retry`, '');
      if (alive.current) onShared(result.post);
    } catch (failure) { if (alive.current) setError(sparkFailure(failure).paused ? 'Sharing is temporarily unavailable. Your draft is saved for later.' : failure.message || 'Couldn’t confirm this Spark. Try again.'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  return <Modal isOpen title="Drop a Spark" onClose={() => { if (!busy) onClose(); }} initialFocusSelector="textarea"><form className="spark-compose" onSubmit={submit}>
    <div className="spark-compose-person"><UserAvatar person={user} size="sm" decorative /><div><strong>{label(user)}</strong><span><ShieldCheck size={13} />Shared with your accepted friends</span></div></div>
    <textarea aria-label="Your Spark" placeholder="A tiny win. A photo from your day. Something they’d get." value={text} maxLength={280} disabled={busy} onChange={event => { setText(event.target.value); retry.current = crypto.randomUUID(); save(`${key}:retry`, ''); }} />
    {preview && <div className="spark-photo-preview"><img src={preview} alt="Photo to share" /><button type="button" aria-label="Remove selected photo" disabled={busy} onClick={() => { setPhoto(null); retry.current = crypto.randomUUID(); save(`${key}:retry`, ''); }}><X size={18} /></button></div>}
    <input className="spark-file-input" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={selectPhoto} tabIndex={-1} aria-label="Choose a Spark photo" />
    {error && <p className="spark-error" role="alert">{error}</p>}
    <div className="spark-compose-actions"><button type="button" className="spark-add-photo" onClick={() => fileRef.current?.click()} disabled={busy || preparing}><ImagePlus size={20} />{preparing ? 'Preparing…' : photo ? 'Change photo' : 'Add a photo'}</button><span>{text.length}/280</span><Button variant="aura" type="submit" loading={busy} disabled={preparing || (!text.trim() && !photo)}>Share Spark</Button></div>
  </form></Modal>;
};

const SparkThread = ({ id, focusReplyId, user, onClose, onUpdate, onChat, onReact, reacting }) => {
  const [thread, setThread] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const key = `hakoware:spark-reply:${user.uid || user.id || user._id}:${id}`;
  const [draft, setDraft] = useState(() => read(key).slice(0, 280));
  const retry = useRef({ text: read(key), id: read(`${key}:retry`) || crypto.randomUUID() });
  const alive = useRef(true);
  const busyRef = useRef(false);
  const request = useRef(0);
  const inputRef = useRef(null);
  const reactionBusy = useRef(false);
  const threadPostId = thread?.post?.id;
  const focusedReply = thread?.focusReply?.id;
  useLayoutEffect(() => { const input = inputRef.current; if (input) { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; } }, [draft, threadPostId]);
  const load = useCallback(async () => {
    const version = ++request.current;
    try {
      const data = await getSpark(id, { reply: focusReplyId });
      if (alive.current && version === request.current) { setThread(previous => ({ ...data, replies: merge(previous?.replies || [], data.replies), hasMore: previous?.hasMore ?? data.hasMore, nextCursor: previous?.nextCursor || data.nextCursor })); setError(''); }
    } catch (failure) { if (alive.current && version === request.current) setError(sparkFailure(failure).paused ? sparkFailure(failure).message : failure.message); }
  }, [id, focusReplyId]);
  useEffect(() => { alive.current = true; void load(); const interval = setInterval(() => { if (document.visibilityState === 'visible' && !busyRef.current && !reactionBusy.current) void load(); }, 15000); return () => { alive.current = false; request.current += 1; clearInterval(interval); }; }, [load]);
  useEffect(() => { save(key, draft); }, [key, draft]);
  useEffect(() => { if (threadPostId && !focusReplyId) inputRef.current?.focus({ preventScroll: true }); }, [threadPostId, focusReplyId]);
  useEffect(() => {
    if (!focusedReply || !focusReplyId) return;
    const frame = requestAnimationFrame(() => { const element = [...document.querySelectorAll('[data-spark-reply]')].find(item => item.dataset.sparkReply === focusReplyId); element?.scrollIntoView({ block: 'center', behavior: 'instant' }); element?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [focusedReply, focusReplyId]);
  const send = async event => {
    event.preventDefault(); const text = draft.trim(); if (!text || busyRef.current) return;
    if (retry.current.text !== text) retry.current = { text, id: crypto.randomUUID() };
    save(`${key}:retry`, retry.current.id);
    busyRef.current = true; request.current += 1; setBusy(true); setError('');
    try {
      const result = await replySpark(id, text, retry.current.id);
      if (!alive.current) return;
      setThread(previous => ({ ...previous, post: result.post, replies: merge(previous.replies, [result.reply]) })); onUpdate(result.post);
      setDraft(''); save(`${key}:retry`, ''); retry.current = { text: '', id: crypto.randomUUID() }; inputRef.current?.focus();
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const older = async () => {
    if (loadingOlder || !thread?.nextCursor) return;
    setLoadingOlder(true);
    try { const data = await getSpark(id, { before: thread.nextCursor }); if (alive.current) setThread(previous => ({ ...previous, replies: merge(data.replies, previous.replies), hasMore: data.hasMore, nextCursor: data.nextCursor })); }
    catch (failure) { if (alive.current) setError(failure.message); }
    finally { if (alive.current) setLoadingOlder(false); }
  };
  const renderReply = reply => <article key={reply.id} data-spark-reply={reply.id} tabIndex={-1} className={`spark-reply ${reply.id === focusReplyId ? 'is-focused' : ''}`}><UserAvatar person={reply.author} size="sm" decorative /><div><strong>{label(reply.author)}<time dateTime={reply.createdAt}>{time(reply.createdAt)}</time></strong><p>{reply.text}</p></div></article>;
  return <Modal isOpen title="A Spark, a conversation" size="lg" onClose={() => { if (!busy) onClose(); }} initialFocusSelector="textarea" footer={thread && <form className="spark-reply-compose" onSubmit={send}><textarea ref={inputRef} aria-label="Reply to this Spark" placeholder="Leave a reply…" rows={1} maxLength={280} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} /><button type="submit" disabled={busy || !draft.trim()} aria-label={busy ? 'Sending reply' : 'Send reply'}>{busy ? <LoaderCircle className="spark-spinner" size={18} /> : <Send size={18} />}</button></form>}><div className="spark-thread">
    {error && <div className="spark-error" role="alert"><p>{error}</p>{!thread && <button type="button" onClick={() => void load()}>Try again</button>}</div>}
    {!thread && !error && <p className="spark-loading" role="status">Opening the conversation…</p>}
    {thread && <><SparkCard post={thread.post} onOpen={() => inputRef.current?.focus()} onReact={async (post, reaction) => { request.current += 1; reactionBusy.current = true; try { const updated = await onReact(post, reaction); if (updated && alive.current) setThread(previous => ({ ...previous, post: updated })); } finally { reactionBusy.current = false; } }} busy={reacting || busy} />
      {!thread.post.mine && <button className="spark-chat-link" type="button" disabled={busy} onClick={() => { onClose(); onChat(thread.post.author); }}><MessageCircle size={17} />Keep it between you and {label(thread.post.author)}</button>}
      <div className="spark-thread-replies"><h3>{thread.post.replyCount ? `${thread.post.replyCount} repl${thread.post.replyCount === 1 ? 'y' : 'ies'}` : 'Be the first to reply'}</h3>{thread.hasMore && <button className="spark-older" type="button" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Opening…' : 'Earlier replies'}</button>}{thread.focusReply && !thread.replies.some(reply => reply.id === thread.focusReply.id) && <section aria-label="Reply opened from Activity">{renderReply(thread.focusReply)}</section>}{thread.replies.map(renderReply)}</div>
    </>}
  </div></Modal>;
};

export const SparksView = ({ user, friendships, onOpenFriend, onNavigate, showToast, focusPostId, focusReplyId, legacyActivityId, legacy = false }) => {
  const [feed, setFeed] = useState({ posts: [], hasMore: false, nextCursor: null, circleSize: friendships.length });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState(focusPostId || null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [fresh, setFresh] = useState(null);
  const [previous, setPrevious] = useState(null);
  const alive = useRef(true);
  const request = useRef(0);
  const busyRef = useRef(false);
  const feedRef = useRef(feed); feedRef.current = feed;
  const foregroundRequest = useRef(0);
  const headingRef = useRef(null);
  useEffect(() => {
    if ((!composing && !selected) || !window.visualViewport) return undefined;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => { if (viewport.scale === 1) { root.style.setProperty('--spark-viewport-height', `${viewport.height}px`); root.style.setProperty('--spark-viewport-top', `${viewport.offsetTop}px`); } };
    update(); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); root.style.removeProperty('--spark-viewport-height'); root.style.removeProperty('--spark-viewport-top'); };
  }, [composing, selected]);
  const load = useCallback(async (older = false, background = false) => {
    // Polling must not supersede an explicit refresh or its loading state.
    if (background && foregroundRequest.current) return;
    const version = ++request.current;
    if (!background) { foregroundRequest.current = version; setLoading(true); }
    try {
      const data = await getSparks(older ? { before: feedRef.current.nextCursor } : {});
      if (!alive.current || version !== request.current) return;
      if (background) { setError(''); if (!feedRef.current.posts.length) { setFeed(data); setFresh(null); } else if (data.posts.some(post => !feedRef.current.posts.some(old => old.id === post.id))) setFresh(data); return; }
      setFeed(previous => older ? { ...data, posts: merge(previous.posts, data.posts) } : data); setFresh(null); setError('');
    } catch (failure) { if (alive.current && version === request.current && (!background || sparkFailure(failure).paused)) setError(sparkFailure(failure)); }
    finally { if (alive.current && !background && foregroundRequest.current === version) { foregroundRequest.current = 0; setLoading(false); } }
  }, []);
  useEffect(() => { alive.current = true; void load(); const interval = setInterval(() => { if (document.visibilityState === 'visible' && !busyRef.current) void load(false, true); }, 60000); return () => { alive.current = false; request.current += 1; clearInterval(interval); }; }, [load]);
  useEffect(() => { if (focusPostId) setSelected(focusPostId); }, [focusPostId]);
  useEffect(() => { let active = true; setPrevious(null); if (legacyActivityId && legacyActivityId !== 'room-event') void getPreviousActivity(legacyActivityId).then(data => { if (active) setPrevious(data); }).catch(() => {}); return () => { active = false; }; }, [legacyActivityId]);
  const updatePost = post => setFeed(previous => ({ ...previous, posts: previous.posts.map(old => old.id === post.id ? post : old) }));
  const react = async (post, reaction) => {
    if (busyRef.current) return null;
    busyRef.current = true; request.current += 1; setBusy(post.id);
    try { const result = await reactSpark(post.id, reaction); if (alive.current) updatePost(result.post); return result.post; }
    catch (failure) { if (alive.current) showToast?.(failure.message, 'ERROR'); return null; }
    finally { busyRef.current = false; if (alive.current) setBusy(null); }
  };
  const remove = async () => {
    if (busyRef.current || !confirmDelete) return;
    const id = confirmDelete; busyRef.current = true; request.current += 1; setBusy(id);
    try { await deleteSpark(id); if (alive.current) { setFeed(previous => ({ ...previous, posts: previous.posts.filter(post => post.id !== id) })); setConfirmDelete(null); showToast?.('Spark removed', 'SUCCESS'); } }
    catch (failure) { if (alive.current) showToast?.(failure.message, 'ERROR'); }
    finally { busyRef.current = false; if (alive.current) setBusy(null); }
  };
  const closeThread = () => { setSelected(null); if (focusPostId) onNavigate('sparks', { replace: true }); };
  const chat = person => {
    const userId = String(user.uid || user.id || user._id);
    const friendship = friendships.find(contract => {
      const ownFirst = String(contract.user1?._id || contract.user1) === userId;
      return (ownFirst ? contract.user2 : contract.user1)?.username === person.username;
    });
    if (friendship) onOpenFriend(friendship); else showToast?.('This person is no longer in your circle.', 'ERROR');
  };
  return <div className="sparks-view"><PageHeading title="Sparks" description="Photos and thoughts, shared with your circle." headingRef={headingRef} headingId="sparks-heading"><Button variant="aura" icon={Plus} disabled={loading || Boolean(error)} onClick={() => setComposing(true)}>Drop a Spark</Button></PageHeading>
    {(legacy || legacyActivityId) && <section className="sparks-legacy" aria-label="Previous room activity"><strong>The room has moved on.</strong><p>Sparks is for the people in your circle. Previous posts keep their original visibility; the room game has retired.</p>{previous?.post && <blockquote><b>{label(previous.post.author)}</b><p>{previous.post.text}</p>{previous.reply && <><b>{label(previous.reply.author)}</b><p>{previous.reply.text}</p></>}</blockquote>}<button type="button" onClick={() => onNavigate('sparks', { replace: true })}>Continue to Sparks </button></section>}
    <div className={`sparks-layout ${error ? 'is-unavailable' : ''}`}><section className="sparks-feed" aria-label="Your circle’s Sparks"><div className="sparks-feed-heading"><h2>From your people</h2><span><ShieldCheck size={14} />Circle only</span><button type="button" aria-label="Refresh Sparks" disabled={loading || Boolean(busy)} onClick={() => void load()}><RefreshCw size={17} /></button></div>
      {fresh && <button className="spark-new-posts" type="button" onClick={() => { setFeed(fresh); setFresh(null); headingRef.current?.focus({ preventScroll: true }); }}><Sparkles size={16} />New Sparks from your circle </button>}
      {error && <div className="sparks-unavailable" role="status"><h2>{error.title}</h2><p>{error.message}</p><div><button type="button" disabled={loading} onClick={() => void load()}>Check again</button><button type="button" onClick={() => onNavigate('contracts')}>Open your circle</button></div></div>}
      {loading && <div className="spark-loading" role="status">Gathering your circle’s moments…</div>}
      {!loading && !error && !feed.posts.length && <div className="sparks-empty"><span className="sparks-empty-mark"><Sparkles size={30} /></span><h2>Small things.<br />Good company.</h2><p>{feed.circleSize ? 'Your circle is here. Give them a little glimpse of your day.' : 'Sparks come from accepted friends. Start a Duo, then share a little of your day.'}</p><Button variant="aura" icon={feed.circleSize ? Plus : MessageCircle} onClick={() => feed.circleSize ? setComposing(true) : onNavigate('contracts')}>{feed.circleSize ? 'Share the first Spark' : 'Find your people'}</Button></div>}
      {feed.posts.map(post => <SparkCard key={post.id} post={post} onOpen={setSelected} onReact={react} busy={Boolean(busy)}>{post.mine && <button className="spark-delete" type="button" aria-label="Remove your Spark" onClick={() => setConfirmDelete(post.id)}><Trash2 size={15} /></button>}</SparkCard>)}
      {feed.hasMore && <button className="spark-load-more" type="button" disabled={loading || Boolean(busy)} onClick={() => { setLoading(true); void load(true); }}>Earlier Sparks </button>}
      {!loading && !error && feed.posts.length > 0 && !feed.hasMore && <div className="sparks-caught-up"><Check size={20} /><strong>You’re caught up.</strong><p>A little glimpse of your people. Go make your next moment.</p></div>}
    </section>{!loading && !error && <aside className="sparks-aside"><span className="sparks-aside-icon"><Sparkles size={26} /></span><h2>The little stuff<br /><span>is the good stuff.</span></h2><p>The coffee spot. A small win. That thing only your friends would understand.</p><button type="button" onClick={() => setComposing(true)}>Pass it on <Plus size={17} /></button><div><ShieldCheck size={16} /><p>Shared with your accepted friends. Your photos stay in your circle.</p></div></aside>}</div>
    {composing && <SparkComposer user={user} onClose={() => setComposing(false)} onShared={post => { request.current += 1; setLoading(false); setError(''); setFresh(null); setFeed(previous => ({ ...previous, posts: merge([post], previous.posts) })); setComposing(false); showToast?.('Spark shared with your circle', 'SUCCESS'); }} />}
    {selected && <SparkThread key={selected} id={selected} focusReplyId={focusReplyId} user={user} onClose={closeThread} onUpdate={updatePost} onChat={chat} onReact={react} reacting={Boolean(busy)} />}
    {confirmDelete && <Modal isOpen title="Remove this Spark?" size="sm" onClose={() => { if (!busy) setConfirmDelete(null); }}><div className="spark-delete-confirm"><p>The photo, thought, replies, and reactions will be removed from your circle.</p><div><Button variant="secondary" disabled={Boolean(busy)} onClick={() => setConfirmDelete(null)}>Keep it</Button><Button variant="danger" loading={Boolean(busy)} onClick={() => void remove()}>Remove Spark</Button></div></div></Modal>}
  </div>;
};
