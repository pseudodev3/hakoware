import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, Check, CheckCheck, Clock, MessageSquare, MoreHorizontal, Radio, RotateCcw, Swords, Trash2, UserCheck, UserMinus, UserPlus, X, Zap, ArrowUpRight } from 'lucide-react';
import { deleteNotification, getUserNotifications, peekUserNotifications, markAllNotificationsAsRead, markNotificationAsRead, NOTIFICATION_TYPES } from '../../../services/notificationService';
import { respondToInvitation } from '../../../services/friendshipService';
import { Button } from '../../../shared/components/Button';
import { VoiceNotesInbox } from '../../debt/components/VoiceNotesInbox';
import './NotificationsPanel.css';

const notificationId = (item) => String(item.id || item._id);
const destinationFor = (type = '') => {
  if (type.startsWith('AFTER_HOURS_')) return 'afterHours';
  if (type.startsWith('BOUNTY_')) return 'arena';
  if (type === 'VOICE_NOTE') return 'voice';
  return 'contracts';
};
const dayGroup = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
};

export const NotificationsPanel = ({ isOpen, onClose, onUnreadCountChange, pendingInvitations, onRefresh, onNavigate, showToast }) => {
  const [notifications, setNotifications] = useState(() => peekUserNotifications().filter((item) => item.type !== 'CONTRACT_INVITE'));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const itemsRef = useRef(notifications);
  const requestRef = useRef(0);
  const inFlightRef = useRef(null);
  const keyHandlerRef = useRef(null);
  const dialogRef = useRef(null);
  const countCallback = useRef(onUnreadCountChange);
  countCallback.current = onUnreadCountChange;
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const shouldReduceMotion = useReducedMotion();

  const applyItems = useCallback((next) => {
    itemsRef.current = next;
    setNotifications(next);
    countCallback.current?.(next.filter((item) => !item.read).length);
  }, []);
  const loadNotifications = useCallback(async ({ force = false } = {}) => {
    if (busyRef.current) return;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const pending = getUserNotifications({ force, throwOnError: true });
      inFlightRef.current = pending;
      const data = await pending;
      if (request !== requestRef.current || busyRef.current) return;
      applyItems((data || []).filter((item) => item.type !== 'CONTRACT_INVITE'));
      setLoadError(false);
    } catch {
      if (request === requestRef.current) setLoadError(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [applyItems]);
  useEffect(() => {
    void loadNotifications();
    const refresh = () => void loadNotifications({ force: true });
    const interval = setInterval(refresh, 30000);
    window.addEventListener('hakoware-notifications-read', refresh);
    return () => { clearInterval(interval); window.removeEventListener('hakoware-notifications-read', refresh); requestRef.current += 1; };
  }, [loadNotifications]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)');
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!isOpen) return undefined;
    setExpanded(null);
    void loadNotifications({ force: true });
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => keyHandlerRef.current?.(event);
    document.addEventListener('keydown', onKeyDown);
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector('.close-panel')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => { if (previousFocus?.isConnected) previousFocus.focus(); });
    };
  }, [isOpen, loadNotifications]);
  const onDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (expanded) setExpanded(null); else onClose();
    }
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), [href], [tabindex="0"]')];
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
  };
  keyHandlerRef.current = onDialogKeyDown;
  // Serialize mutations so failed writes can restore their snapshot without undoing another action.
  const mutate = async (operation, optimistic, failure) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); requestRef.current += 1; setLoading(false);
    const previous = itemsRef.current;
    const previousLoad = inFlightRef.current;
    applyItems(optimistic(previous));
    try {
      const result = await operation();
      if (result?.success === false) throw new Error(result.error || failure);
    } catch (error) {
      applyItems(previous);
      showToast?.(error.message || failure, 'ERROR');
    } finally {
      await previousLoad?.catch(() => {});
      busyRef.current = false; setBusy(false);
      void loadNotifications({ force: true });
    }
  };
  const handleMarkAsRead = (id) => mutate(() => markNotificationAsRead(id), (items) => items.map((item) => notificationId(item) === id ? { ...item, read: true } : item), 'Could not mark activity as read');
  const handleMarkAllRead = () => mutate(markAllNotificationsAsRead, (items) => items.map((item) => ({ ...item, read: true })), 'Could not mark activity as read');
  const handleDelete = (id) => {
    setExpanded(null);
    dialogRef.current?.querySelector('.close-panel')?.focus();
    return mutate(() => deleteNotification(id), (items) => items.filter((item) => notificationId(item) !== id), 'Could not delete activity');
  };
  const openNotification = (notification) => {
    if (busyRef.current) return;
    if (!notification.read) void handleMarkAsRead(notificationId(notification));
    const destination = destinationFor(notification.type);
    if (notification.contractKey && destination === 'contracts') {
      onNavigate?.('friend', { contractKey: notification.contractKey, focusEventId: notification.focusEventId || null });
      onClose();
      return;
    }
    if (destination === 'voice') { setFilter('voice'); setExpanded(null); return; }
    const roomEvent = [NOTIFICATION_TYPES.AFTER_HOURS_TAG_IN, NOTIFICATION_TYPES.AFTER_HOURS_CALLOUT].includes(notification.type);
    onNavigate?.(destination, destination === 'afterHours' ? { focusActivityId: roomEvent ? 'room-event' : (notification.afterHoursActivityId || null) } : undefined);
    onClose();
  };
  const handleRespond = async (id, action) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); requestRef.current += 1;
    try {
      const result = await respondToInvitation(id, action);
      if (!result.success) throw new Error(result.error || 'Could not respond to contract');
      showToast?.(action === 'ACCEPT' ? 'Contract accepted' : 'Contract declined', 'SUCCESS');
      await onRefresh?.();
    } catch (error) { showToast?.(error.message, 'ERROR'); }
    finally { busyRef.current = false; setBusy(false); void loadNotifications({ force: true }); }
  };
  const getIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.LIMIT_CHANGED: return <Clock size={16} strokeWidth={1.8} />;
      case NOTIFICATION_TYPES.VOICE_NOTE: return <MessageSquare size={16} strokeWidth={1.8} />;
      case NOTIFICATION_TYPES.CONTRACT_ACCEPTED: return <UserCheck size={16} strokeWidth={1.8} />;
      case NOTIFICATION_TYPES.CONTRACT_DECLINED:
      case NOTIFICATION_TYPES.CONTRACT_ENDED: return <UserMinus size={16} strokeWidth={1.8} />;
      case NOTIFICATION_TYPES.BOUNTY_PLACED:
      case NOTIFICATION_TYPES.BOUNTY_HUNTING: return <Swords size={16} strokeWidth={1.8} />;
      case NOTIFICATION_TYPES.BOUNTY_REWARD: return <Zap size={16} strokeWidth={1.8} />;
      case NOTIFICATION_TYPES.BOUNTY_REFUND: return <RotateCcw size={16} strokeWidth={1.8} />;
      case NOTIFICATION_TYPES.AFTER_HOURS_CALLOUT:
      case NOTIFICATION_TYPES.AFTER_HOURS_TAG_IN:
      case NOTIFICATION_TYPES.AFTER_HOURS_CHALLENGE:
      case NOTIFICATION_TYPES.AFTER_HOURS_REPLY:
      case NOTIFICATION_TYPES.AFTER_HOURS_SPARK:
      case NOTIFICATION_TYPES.AFTER_HOURS_NOTE: return <Radio size={16} strokeWidth={1.8} />;
      default: return <Bell size={16} strokeWidth={1.8} />;
    }
  };

  const getTone = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.BOUNTY_PLACED:
      case NOTIFICATION_TYPES.CONTRACT_DECLINED:
      case NOTIFICATION_TYPES.CONTRACT_ENDED: return 'red';
      case NOTIFICATION_TYPES.VOICE_NOTE:
      case NOTIFICATION_TYPES.BOUNTY_HUNTING: return 'blue';
      case NOTIFICATION_TYPES.CONTRACT_ACCEPTED:
      case NOTIFICATION_TYPES.CHECKIN:
      case NOTIFICATION_TYPES.BOUNTY_REWARD: return 'green';
      case NOTIFICATION_TYPES.CHECKIN_REACTION:
      case NOTIFICATION_TYPES.CHECKIN_REPLY:
      case NOTIFICATION_TYPES.POKE:
      case NOTIFICATION_TYPES.MUTUAL_POKE:
      case NOTIFICATION_TYPES.HOT_SEAT_OPENED:
      case NOTIFICATION_TYPES.HOT_SEAT_ANSWERED:
      case NOTIFICATION_TYPES.HOT_SEAT_REVEALED:
      case NOTIFICATION_TYPES.SPLIT_DECISION_OPENED:
      case NOTIFICATION_TYPES.SPLIT_DECISION_ANSWERED:
      case NOTIFICATION_TYPES.SPLIT_DECISION_REVEALED:
      case NOTIFICATION_TYPES.DOUBLE_DARE_SENT:
      case NOTIFICATION_TYPES.DOUBLE_DARE_REVEALED: return 'gold';
      case NOTIFICATION_TYPES.LIMIT_CHANGED:
      case NOTIFICATION_TYPES.BOUNTY_REFUND:
      case NOTIFICATION_TYPES.AFTER_HOURS_CALLOUT:
      case NOTIFICATION_TYPES.AFTER_HOURS_TAG_IN:
      case NOTIFICATION_TYPES.AFTER_HOURS_CHALLENGE:
      case NOTIFICATION_TYPES.AFTER_HOURS_REPLY:
      case NOTIFICATION_TYPES.AFTER_HOURS_SPARK:
      case NOTIFICATION_TYPES.AFTER_HOURS_NOTE: return 'gold';
      default: return 'neutral';
    }
  };

  const formatType = (type = '') => type === 'CHECKIN' ? 'Check-in' : type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const diff = (new Date() - date) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter((item) => !item.read).length;
  const visible = filter === 'unread' ? notifications.filter((item) => !item.read) : notifications;
  const offset = mobile ? 'translateY(100%)' : 'translateX(100%)';
  const panelMotion = {
    initial: { opacity: shouldReduceMotion ? 0 : 1, transform: shouldReduceMotion ? 'none' : offset },
    animate: { opacity: 1, transform: 'none' },
    exit: { opacity: shouldReduceMotion ? 0 : 1, transform: shouldReduceMotion ? 'none' : offset },
    transition: { duration: shouldReduceMotion ? .1 : .24, ease: [0.32, 0.72, 0, 1] }
  };
  return createPortal(<AnimatePresence initial={false}>
    {isOpen && <>
      <motion.div className="panel-backdrop" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .14 }} onClick={onClose} />
      <motion.aside ref={dialogRef} className="notifications-panel" role="dialog" aria-modal="true" aria-labelledby="activity-title" {...panelMotion}>
        <div className="panel-handle" aria-hidden="true" />
        <header className="panel-header">
          <div className="panel-heading"><h2 id="activity-title">Activity</h2><p>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}</p></div>
          <button className="close-panel" onClick={onClose} aria-label="Close activity"><X size={20} /></button>
        </header>
        <div className="activity-filters" role="group" aria-label="Activity filter">
          {[['all', 'All'], ['unread', `Unread${unreadCount ? ` · ${unreadCount}` : ''}`], ['voice', 'Voice']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setExpanded(null); }}>{label}</button>)}
        </div>
        <div className="panel-content">
          {loadError && <div className="activity-sync-error" role="status"><span>Couldn’t sync activity.</span><button disabled={loading} onClick={() => void loadNotifications({ force: true })}>Retry</button></div>}
          {filter === 'voice' ? <section className="voice-section"><VoiceNotesInbox /></section> : <>
            {pendingInvitations?.length > 0 && <section className="invitations-section" aria-labelledby="pending-contracts-title">
              <h3 className="panel-section-title" id="pending-contracts-title"><UserPlus size={16} /> Contract invites</h3>
              {pendingInvitations.map((invitation) => <div className="invitation-card" key={invitation._id}>
                <p><strong>{invitation.user1?.displayName || 'Someone'}</strong> wants to start a contract.</p>
                <div className="invitation-actions"><Button variant="aura" size="sm" disabled={busy} onClick={() => handleRespond(invitation._id, 'ACCEPT')}>Accept</Button><Button variant="secondary" size="sm" disabled={busy} onClick={() => handleRespond(invitation._id, 'DECLINE')}>Decline</Button></div>
              </div>)}
            </section>}
            {loading && !notifications.length ? <div className="panel-empty" role="status"><div className="loading-spinner" /><p>Syncing activity…</p></div> : !visible.length ? <div className="panel-empty"><Bell size={32} strokeWidth={1.5} /><p>{loadError ? 'Your updates will appear here.' : filter === 'unread' ? 'All caught up.' : 'No updates yet.'}</p><span>{filter === 'unread' ? 'You can revisit everything in All.' : 'Check-ins, replies and invites land here.'}</span></div> : ['Today', 'Yesterday', 'Earlier'].map((group) => {
              const items = visible.filter((item) => dayGroup(item.createdAt) === group);
              if (!items.length) return null;
              return <section className="activity-group" key={group} aria-label={group}><h3 className="activity-group-title">{group}</h3><div className="notification-list">
                {items.map((notification) => {
                  const id = notificationId(notification); const destination = destinationFor(notification.type);
                  const destinationLabel = { contracts: 'Contracts', arena: 'Arena', afterHours: 'After Hours', voice: 'Voice inbox' }[destination];
                  return <article className={`notification-item ${notification.read ? 'read' : 'unread'}`} key={id}>
                    <button className="notification-open" disabled={busy} onClick={() => openNotification(notification)} aria-label={`${formatType(notification.type)}: ${notification.message}. Open ${destinationLabel}`}>
                      <span className={`item-icon ${getTone(notification.type)}`} aria-hidden="true">{getIcon(notification.type)}</span>
                      <span className="item-body"><span className="item-header"><span className="item-type">{formatType(notification.type)}</span>{!notification.read && <span className="unread-dot" aria-label="Unread" />}</span><span className="item-msg">{notification.message}</span><span className="item-meta"><time dateTime={notification.createdAt}>{formatTime(notification.createdAt)}</time><span>·</span><span>{destinationLabel}</span><ArrowUpRight size={12} aria-hidden="true" /></span></span>
                    </button>
                    <button className="activity-more" disabled={busy} aria-label={`More options for ${formatType(notification.type)}`} aria-expanded={expanded === id} aria-controls={`activity-options-${id}`} onClick={() => setExpanded(expanded === id ? null : id)}><MoreHorizontal size={20} /></button>
                    {expanded === id && <div className="activity-options" id={`activity-options-${id}`}>
                      {!notification.read && <button disabled={busy} onClick={() => void handleMarkAsRead(id)}><Check size={16} /> Mark read</button>}
                      <button className="activity-delete" disabled={busy} onClick={() => void handleDelete(id)}><Trash2 size={16} /> Delete</button>
                    </div>}
                  </article>;
                })}
              </div></section>;
            })}
          </>}
        </div>
        <footer className="panel-footer"><button className="mark-all-btn" disabled={busy || !unreadCount} onClick={() => void handleMarkAllRead()}><CheckCheck size={18} />{busy ? 'Updating…' : 'Mark all read'}</button><button className="activity-done" onClick={onClose}>Done</button></footer>
      </motion.aside>
    </>}
  </AnimatePresence>, document.body);
};
