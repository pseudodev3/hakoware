import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, MessageCircle, Send, LoaderCircle, Swords, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { people, connectionAction, seeConnection } from '../../services/peopleService';
import { ChatMessageText } from '../../shared/components/ChatMessageText';
import { PersonActions } from './PersonActions';

export const Connections = ({ connectionId, onNavigate, onAddFriend }) => {
  const { user } = useAuth(), userId = String(user._id || user.id || user.uid);
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [text, setText] = useState(''), [older, setOlder] = useState(false);
  const alive = useRef(false), sequence = useRef(0), busyRef = useRef(false), context = useRef(''), messages = useRef(null), acknowledged = useRef('');
  const acknowledge = useCallback(connection => {
    const key = `${connection.id}:${connection.revision}`;
    if (acknowledged.current === key) return;
    acknowledged.current = key; void seeConnection(connection).catch(() => { if (acknowledged.current === key) acknowledged.current = ''; });
  }, []);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await (connectionId ? people.chat(connectionId) : people.connections());
      if (!alive.current || request !== sequence.current) return;
      if (connectionId) {
        setData(current => ({ ...result, messages: [...(current?.messages || []).filter(value => value.sequence < (result.messages[0]?.sequence || Infinity)), ...result.messages], next: current?.messages?.length > 30 ? current.next : result.next }));
        acknowledge(result.connection);
      } else setData(result);
      setError('');
    } catch (err) { if (alive.current && request === sequence.current) { setError(err.message); if ([403, 404].includes(err.status)) setData(null); } }
  }, [connectionId, acknowledge]);
  useEffect(() => {
    alive.current = true; context.current = `${userId}:${connectionId || 'list'}`; busyRef.current = false; setBusy(false); setData(null); setText(''); setError(''); acknowledged.current = ''; void load();
    const visible = () => { if (document.visibilityState === 'visible' && !busyRef.current) void load(); };
    const interval = setInterval(visible, connectionId ? 6000 : 30000);
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { alive.current = false; sequence.current += 1; clearInterval(interval); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [userId, connectionId, load]);
  const nearBottom = useRef(true);
  const followPreview = useCallback(() => { if (nearBottom.current && messages.current) messages.current.scrollTop = messages.current.scrollHeight; }, []);
  useLayoutEffect(followPreview, [data?.messages, followPreview]);
  const hasChat = Boolean(connectionId && data?.connection);
  useEffect(() => { if (hasChat && messages.current) messages.current.scrollTop = messages.current.scrollHeight; }, [hasChat]);
  const act = async (connection, action) => {
    if (busyRef.current) return; const requestContext = context.current, messageText = text;
    busyRef.current = true; setBusy(true); setError(''); sequence.current += 1;
    try {
      await connectionAction(userId, connection, action, action === 'MESSAGE' ? { text: messageText } : {});
      if (!alive.current || requestContext !== context.current) return;
      if (action === 'MESSAGE') setText('');
      await load();
      if (action === 'MESSAGE') requestAnimationFrame(() => { if (alive.current && requestContext === context.current && messages.current) messages.current.scrollTop = messages.current.scrollHeight; });
    } catch (err) { if (alive.current && requestContext === context.current) { if (err.status === 409) await load(); setError(err.message); } }
    finally { if (requestContext === context.current) { busyRef.current = false; if (alive.current) setBusy(false); } }
  };
  const loadOlder = async () => {
    if (older || !data?.next) return; setOlder(true); const requestContext = context.current, cursor = data.next;
    const oldHeight = messages.current?.scrollHeight || 0; nearBottom.current = false;
    try { const result = await people.chat(connectionId, cursor); if (alive.current && requestContext === context.current) { setData(current => ({ ...current, next: result.next, messages: [...result.messages.filter(value => !current.messages.some(existing => existing.id === value.id)), ...current.messages] })); requestAnimationFrame(() => { if (messages.current) messages.current.scrollTop += messages.current.scrollHeight - oldHeight; }); } }
    catch (err) { if (alive.current && requestContext === context.current) setError(err.message); }
    finally { if (alive.current && requestContext === context.current) setOlder(false); }
  };
  if (connectionId) return <section className="connection-chat" aria-label="Connection conversation">
    <header className="connection-chat-header"><button type="button" className="people-more" aria-label="Back to connections" onClick={() => onNavigate('contracts', { section: 'connections' })}><ArrowLeft size={20} /></button>{data?.connection && <><UserAvatar person={data.connection.partner} size="sm" decorative /><div><h1>{data.connection.partner.displayName}</h1><p>@{data.connection.partner.username}</p></div><PersonActions person={data.connection.partner} onBlocked={() => onNavigate('contracts', { section: 'connections' })} /></>}</header>
    {error && <div role="alert" className="people-error"><p>{error}</p><button type="button" onClick={() => void load()}>Refresh conversation</button></div>}
    {!data && !error && <p role="status">Opening your conversation…</p>}
    {data?.connection && <><div className="connection-chat-tools"><button type="button" className="people-text-button" onClick={() => onNavigate('arena', { section: 'duels', duelId: data.connection.id })}><Swords size={16} />Card duel</button><button type="button" className="people-text-button" onClick={() => onAddFriend(data.connection.partner)}>Start a Duo</button></div><div className="connection-messages" ref={messages} onScroll={() => { const list = messages.current; nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 100; }} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text">{data.next && <button type="button" className="people-text-button" disabled={older} onClick={() => void loadOlder()}>{older ? 'Loading…' : 'Earlier messages'}</button>}{!data.messages.length && <div className="people-empty"><MessageCircle size={27} /><h2>You’re connected.</h2><p>Say hello. There are no daily rules here.</p></div>}{data.messages.map(message => <div key={message.id} className={`connection-message ${message.fromMe ? 'from-me' : ''}`}><ChatMessageText text={message.text} kind="connection" messageId={message.id} onLayout={followPreview} /><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>)}</div><form className="connection-composer" onSubmit={event => { event.preventDefault(); if (text.trim()) void act(data.connection, 'MESSAGE'); }}><textarea aria-label={`Message ${data.connection.partner.displayName}`} placeholder={`Message ${data.connection.partner.displayName}…`} rows={1} maxLength={1000} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (text.trim()) void act(data.connection, 'MESSAGE'); } }} /><button type="submit" className="connection-compose-send" aria-label={busy ? 'Sending message' : 'Send message'} aria-busy={busy || undefined} disabled={busy || !text.trim()}>{busy ? <LoaderCircle size={19} className="btn-spinner-icon" /> : <Send size={19} />}</button></form><p className="people-note connection-note">A Duo adds a shared rhythm only when you both accept it.</p></>}
  </section>;
  const connections = data?.connections || [], pending = connections.filter(value => value.status === 'PENDING'), accepted = connections.filter(value => value.status === 'CONNECTED');
  return <section className="people-connections"><div className="people-intro"><h1>Connections</h1><p>People you’ve met through play. Chat or start a Duo.</p></div>{error && <div role="alert" className="people-error"><p>{error}</p><button type="button" onClick={() => void load()}>Try again</button></div>}{!data && !error && <p role="status">Opening connections…</p>}{pending.length > 0 && <section className="people-connection-list"><h2>Invitations</h2>{pending.map(connection => <article className="people-connection-row" key={connection.id}><UserAvatar person={connection.partner} size="sm" decorative /><div><strong>{connection.partner.displayName}</strong><small>{connection.requestedByMe ? 'Waiting for them' : 'Would like to connect'}</small></div>{connection.requestedByMe ? <button type="button" className="people-text-button" disabled={busy} onClick={() => void act(connection, 'CANCEL')}>Cancel</button> : <><button type="button" className="people-more" disabled={busy} aria-label={`Accept ${connection.partner.displayName}`} onClick={() => void act(connection, 'ACCEPT')}><Check size={20} /></button><button type="button" className="people-more" disabled={busy} aria-label={`Decline ${connection.partner.displayName}`} onClick={() => void act(connection, 'DECLINE')}><X size={20} /></button></>}<PersonActions person={connection.partner} onBlocked={() => void load()} /></article>)}</section>}<section className="people-connection-list"><h2>Conversations</h2>{accepted.map(connection => <article className="people-connection-row" key={connection.id}><button type="button" className="people-connection-open" onClick={() => onNavigate('contracts', { section: 'connections', connectionId: connection.id })}><UserAvatar person={connection.partner} size="sm" decorative /><span className="people-connection-copy"><strong>{connection.partner.displayName}</strong><small>@{connection.partner.username}</small></span><MessageCircle size={20} /></button><PersonActions person={connection.partner} onBlocked={() => void load()} /></article>)}{data && !accepted.length && <div className="people-empty"><p>Meet players at an open table, then connect after the round.</p><button type="button" className="people-text-button" onClick={() => onNavigate('arena', { section: 'duels' })}>Play someone new</button></div>}</section></section>;
};
