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
import { Button } from '../../../shared/components/Button';
import './NotificationsPanel.css';

/**
 * Premium slide-out notifications panel.
 * Professional HxH aesthetic with motion feedback.
 */
export const NotificationsPanel = ({ isOpen, onClose, onUnreadCountChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await getUserNotifications();
      setNotifications(data || []);
      if (onUnreadCountChange) {
        onUnreadCountChange(data.filter(n => !n.read).length);
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
  }, [isOpen]);

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
                <h3>NOTIFICATIONS</h3>
                <button className="close-panel" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
              {notifications.filter(n => !n.read).length > 0 && (
                <button className="mark-all-btn" onClick={handleMarkAllRead}>
                  MARK ALL AS READ
                </button>
              )}
            </header>

            <div className="panel-content">
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
