import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, Check, Clock, MessageSquare, RotateCcw, Swords, Trash2, UserCheck, UserMinus, UserPlus, X, Zap } from 'lucide-react';
import {
  deleteNotification,
  getUserNotifications,
  peekUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATION_TYPES
} from '../../../services/notificationService';
import { respondToInvitation } from '../../../services/friendshipService';
import { Button } from '../../../shared/components/Button';
import { VoiceNotesInbox } from '../../debt/components/VoiceNotesInbox';
import './NotificationsPanel.css';

export const NotificationsPanel = ({ isOpen, onClose, onUnreadCountChange, pendingInvitations, onRefresh, showToast }) => {
  const cachedNotifications = peekUserNotifications().filter((notification) => notification.type !== 'CONTRACT_INVITE');
  const [notifications, setNotifications] = useState(cachedNotifications);
  const [loading, setLoading] = useState(cachedNotifications.length === 0);
  const shouldReduceMotion = useReducedMotion();

  const loadNotifications = async ({ force = false } = {}) => {
    try {
      const data = await getUserNotifications({ force });
      const visible = (data || []).filter((notification) => notification.type !== 'CONTRACT_INVITE');
      setNotifications(visible);
      onUnreadCountChange?.(visible.filter((notification) => !notification.read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => loadNotifications({ force: true }), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    loadNotifications({ force: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (id) => {
    await markNotificationAsRead(id);
    await loadNotifications({ force: true });
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    await loadNotifications({ force: true });
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
    await loadNotifications({ force: true });
  };

  const handleRespond = async (id, action) => {
    const result = await respondToInvitation(id, action);
    if (result.success) {
      showToast?.(action === 'ACCEPT' ? 'Contract accepted' : 'Contract declined', 'SUCCESS');
      await onRefresh?.();
    } else {
      showToast?.(result.error || 'Could not respond to contract', 'ERROR');
    }
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
      case NOTIFICATION_TYPES.LIMIT_CHANGED:
      case NOTIFICATION_TYPES.BOUNTY_REFUND: return 'gold';
      default: return 'neutral';
    }
  };

  const formatType = (type = '') => type
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

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const panelMotion = shouldReduceMotion
    ? {
        initial: { opacity: 0, transform: 'translateX(0%)' },
        animate: { opacity: 1, transform: 'translateX(0%)' },
        exit: { opacity: 0, transform: 'translateX(0%)' },
        transition: { duration: .14, ease: [0.2, 0, 0, 1] }
      }
    : {
        initial: { opacity: 1, transform: 'translateX(100%)' },
        animate: { opacity: 1, transform: 'translateX(0%)' },
        exit: { opacity: 1, transform: 'translateX(100%)' },
        transition: { duration: .24, ease: [0.32, 0.72, 0, 1] }
      };

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <>
          <motion.div
            className="panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: .16, ease: [0.2, 0, 0, 1] }}
            onClick={onClose}
          />
          <motion.aside className="notifications-panel" aria-label="Notifications" {...panelMotion}>
            <header className="panel-header">
              <div className="panel-heading">
                <h3>Activity</h3>
              </div>
              <div className="panel-header-actions">
                {unreadCount > 0 && <button className="mark-all-btn" onClick={handleMarkAllRead}>Mark all read</button>}
                <button className="close-panel" onClick={onClose} aria-label="Close notifications"><X size={19} strokeWidth={1.8} /></button>
              </div>
            </header>

            <div className="panel-content">
              {pendingInvitations?.length > 0 && (
                <section className="invitations-section" aria-labelledby="pending-contracts-title">
                  <div className="panel-section-title">
                    <UserPlus size={16} strokeWidth={1.8} />
                    <span id="pending-contracts-title">Invites</span>
                  </div>
                  <div className="invitation-list">
                    {pendingInvitations.map((invitation) => (
                      <div key={invitation._id} className="invitation-card">
                        <p><strong>{invitation.user1.displayName}</strong> wants to start a contract.</p>
                        <div className="invitation-actions">
                          <Button variant="aura" size="sm" className="flex-1" onClick={() => handleRespond(invitation._id, 'ACCEPT')}>Accept</Button>
                          <Button variant="secondary" size="sm" onClick={() => handleRespond(invitation._id, 'DECLINE')}>Decline</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="voice-section"><VoiceNotesInbox /></section>

              {loading && notifications.length === 0 ? (
                <div className="panel-empty" aria-live="polite"><div className="loading-spinner" /><p>Syncing…</p></div>
              ) : notifications.length === 0 ? (
                <div className="panel-empty"><Bell size={34} className="empty-icon" strokeWidth={1.6} /><p>No new activity.</p></div>
              ) : (
                <div className="notification-list">
                  {notifications.map((notification) => (
                    <div key={notification.id || notification._id} className={`notification-item ${notification.read ? 'read' : 'unread'}`}>
                      <div className={`item-icon ${getTone(notification.type)}`}>{getIcon(notification.type)}</div>
                      <div className="item-body">
                        <div className="item-header">
                          <span className="item-type">{formatType(notification.type)}</span>
                          <span className="item-time">{formatTime(notification.createdAt)}</span>
                        </div>
                        <p className="item-msg">{notification.message}</p>
                      </div>
                      <div className="item-actions">
                        {!notification.read && (
                          <button
                            className="action-icon"
                            onClick={() => handleMarkAsRead(notification.id || notification._id)}
                            aria-label="Mark notification as read"
                            title="Mark read"
                          >
                            <Check size={14} strokeWidth={1.9} />
                          </button>
                        )}
                        <button
                          className="action-icon delete"
                          onClick={() => handleDelete(notification.id || notification._id)}
                          aria-label="Delete notification"
                          title="Delete"
                        >
                          <Trash2 size={14} strokeWidth={1.9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
