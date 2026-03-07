import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  Check, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  MessageSquare,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  NOTIFICATION_TYPES 
} from '../../../services/notificationService';
import { respondToInvitation } from '../../../services/friendshipService';
import { Button } from '../../../shared/components/Button';
import { VoiceNotesInbox } from '../../debt/components/VoiceNotesInbox';
import './NotificationsPanel.css';

/**
 * Premium slide-out notifications panel.
 * Professional HxH aesthetic with motion feedback.
 */
export const NotificationsPanel = ({ isOpen, onClose, onUnreadCountChange, pendingInvitations, onRefresh, showToast }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await getUserNotifications();
      setNotifications(data || []);
      if (onUnreadCountChange) {
        onUnreadCountChange((data?.filter(n => !n.read).length || 0) + (pendingInvitations?.length || 0));
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadNotifications();
    
    // Polling for updates
    const interval = setInterval(() => {
      if (isOpen) loadNotifications();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isOpen, pendingInvitations]);

  const handleMarkAsRead = async (id) => {
    await markNotificationAsRead(id);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    loadNotifications();
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
    loadNotifications();
  };

  const handleRespond = async (id, action) => {
    try {
      const result = await respondToInvitation(id, action);
      if (result.success) {
        showToast(action === 'ACCEPT' ? 'CONTRACT AUTHORIZED' : 'CONTRACT DECLINED', 'SUCCESS');
        onRefresh();
      } else {
        showToast(result.error || 'FAILED TO RESPOND', 'ERROR');
      }
    } catch (err) {
      showToast('FAILED TO RESPOND', 'ERROR');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.LIMIT_CHANGED: return <Clock size={16} color="var(--aura-gold)" />;
      case NOTIFICATION_TYPES.BAILOUT_RECEIVED: return <ShieldAlert size={16} color="var(--aura-blue)" />;
      case NOTIFICATION_TYPES.MERCY_GRANTED: return <Sparkles size={16} color="var(--aura-green)" />;
      case NOTIFICATION_TYPES.MERCY_DECLINED: return <X size={16} color="var(--aura-red)" />;
      case NOTIFICATION_TYPES.VOICE_NOTE: return <MessageSquare size={16} color="var(--aura-blue)" />;
      default: return <Bell size={16} color="var(--text-muted)" />;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'JUST NOW';
    if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}H AGO`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside 
            className="notifications-panel glass"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <header className="panel-header">
              <div className="header-top">
                <h3>SYSTEM ALERTS</h3>
                <button className="close-panel" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="panel-content">
              {/* INVITATIONS SECTION */}
              {pendingInvitations?.length > 0 && (
                <div className="invitations-section" style={{ marginBottom: '32px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <UserPlus size={16} color="var(--aura-blue)" />
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em' }}>PENDING CONTRACTS</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {pendingInvitations.map(inv => (
                        <div key={inv._id} className="invitation-card glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                           <p style={{ fontSize: '0.8rem', marginBottom: '12px' }}><strong>{inv.user1.displayName}</strong> requests a binding contract.</p>
                           <div style={{ display: 'flex', gap: '8px' }}>
                              <Button variant="aura" size="sm" className="flex-1" onClick={() => handleRespond(inv._id, 'ACCEPT')}>AUTHORIZE</Button>
                              <Button variant="secondary" size="sm" onClick={() => handleRespond(inv._id, 'DECLINE')}>DECLINE</Button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              <div style={{ marginBottom: '32px' }}>
                <VoiceNotesInbox />
              </div>
              
              {loading && notifications.length === 0 ? (
                <div className="panel-empty">
                  <div className="loading-spinner" />
                  <p>SYNCING PROTOCOLS...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="panel-empty">
                  <Bell size={40} className="empty-icon" />
                  <p>NO ACTIVE ALERTS</p>
                </div>
              ) : (
                <div className="notification-list">
                  {notifications.map((n) => (
                    <motion.div 
                      key={n.id || n._id}
                      className={`notification-item ${n.read ? 'read' : 'unread'}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="item-icon">
                        {getIcon(n.type)}
                      </div>
                      <div className="item-body">
                        <div className="item-header">
                          <span className="item-type">{n.type?.replace('_', ' ')}</span>
                          <span className="item-time">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className="item-msg">{n.message}</p>
                        <div className="item-actions">
                          {!n.read && (
                            <button className="action-link" onClick={() => handleMarkAsRead(n.id || n._id)}>
                              <Check size={12} /> MARK READ
                            </button>
                          )}
                          <button className="action-link delete" onClick={() => handleDelete(n.id || n._id)}>
                            <Trash2 size={12} /> DELETE
                          </button>
                        </div>
                      </div>
                    </motion.div>
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
