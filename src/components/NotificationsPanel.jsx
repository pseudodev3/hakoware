import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  NOTIFICATION_TYPES 
} from '../services/notificationService';
import { BellIcon, CheckIcon, XIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon } from './icons/Icons';

const NotificationsPanel = ({ onUpdate, externalExpanded, onUnreadCountChange }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Use external expanded state if provided, otherwise use internal
  const expanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const setExpanded = externalExpanded !== undefined ? () => {} : setInternalExpanded;

  useEffect(() => {
    loadNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Report unread count to parent when it changes
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const data = await getUserNotifications(user.uid, 20);
    setNotifications(data);
    setUnreadCount(data.filter(n => !n.read).length);
    setLoading(false);
  };

  const handleMarkAsRead = async (notificationId) => {
    await markNotificationAsRead(notificationId);
    await loadNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead(user.uid);
    await loadNotifications();
  };

  const handleDelete = async (notificationId) => {
    await deleteNotification(notificationId);
    await loadNotifications();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000; // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.LIMIT_CHANGED:
        return '⏱️';
      case NOTIFICATION_TYPES.BAILOUT_RECEIVED:
        return '💰';
      case NOTIFICATION_TYPES.MERCY_GRANTED:
        return '✨';
      case NOTIFICATION_TYPES.MERCY_DECLINED:
        return '❌';
      case NOTIFICATION_TYPES.MERCY_COUNTERED:
        return '📝';
      case NOTIFICATION_TYPES.FRIENDSHIP_REMOVED:
        return '👋';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.LIMIT_CHANGED:
        return '#ff8800';
      case NOTIFICATION_TYPES.BAILOUT_RECEIVED:
        return '#00e676';
      case NOTIFICATION_TYPES.MERCY_GRANTED:
        return '#ffd700';
      case NOTIFICATION_TYPES.MERCY_DECLINED:
        return '#ff4444';
      case NOTIFICATION_TYPES.MERCY_COUNTERED:
        return '#33b5e5';
      default:
        return '#888';
    }
  };

  // When controlled externally, show even if empty (for loading state)
  const isControlled = externalExpanded !== undefined;
  
  if (!isControlled && loading && notifications.length === 0) return null;
  if (!isControlled && notifications.length === 0) return null;
  
  // When controlled externally and collapsed, don't render
  if (isControlled && !expanded) return null;

  return (
    <div style={containerStyle}>
      {/* Only show header when not controlled externally */}
      {!isControlled && (
        <button 
          onClick={() => setExpanded(!expanded)}
          style={headerStyle}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <BellIcon size={18} color={unreadCount > 0 ? '#ffd700' : '#888'} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: '#ff4444',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  padding: '2px 5px',
                  borderRadius: '10px',
                  minWidth: '16px',
                  textAlign: 'center'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span style={{ color: unreadCount > 0 ? '#ffd700' : '#888' }}>
              NOTIFICATIONS
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {unreadCount > 0 && !expanded && (
              <span style={{ 
                color: '#ff4444', 
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {unreadCount} new
              </span>
            )}
            {expanded ? (
              <ChevronUpIcon size={18} color="#666" />
            ) : (
              <ChevronDownIcon size={18} color="#666" />
          )}
        </div>
      </button>
      )}

      <div style={contentStyle}>
          {/* Mark all as read button */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(0,230,118,0.1)',
                border: '1px solid rgba(0,230,118,0.3)',
                borderRadius: '8px',
                color: '#00e676',
                fontSize: '0.8rem',
                cursor: 'pointer',
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <CheckIcon size={14} color="#00e676" />
              Mark all as read
            </button>
          )}

          {/* Notifications list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: '14px',
                  background: notification.read ? 'rgba(0,0,0,0.2)' : 'rgba(255,215,0,0.05)',
                  borderRadius: '10px',
                  border: notification.read ? '1px solid #1a1a1a' : '1px solid rgba(255,215,0,0.2)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  transition: 'all 0.2s'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: notification.read ? 'rgba(255,255,255,0.03)' : 'rgba(255,215,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  flexShrink: 0
                }}>
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '4px'
                  }}>
                    <span style={{ 
                      color: notification.read ? '#888' : '#ffd700', 
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}>
                      {notification.title}
                    </span>
                    <span style={{ color: '#555', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    color: notification.read ? '#666' : '#aaa',
                    fontSize: '0.85rem',
                    lineHeight: '1.4'
                  }}>
                    {notification.message}
                  </p>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        style={{
                          padding: '4px 10px',
                          background: 'transparent',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          color: '#666',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <CheckIcon size={10} color="#666" />
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      style={{
                        padding: '4px 10px',
                        background: 'transparent',
                        border: '1px solid #330000',
                        borderRadius: '4px',
                        color: '#ff4444',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <TrashIcon size={10} color="#ff4444" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const containerStyle = {
  margin: '0 20px 20px',
  background: 'rgba(255,215,0,0.02)',
  border: '1px solid rgba(255,215,0,0.1)',
  borderRadius: '12px',
  overflow: 'hidden'
};

const headerStyle = {
  width: '100%',
  padding: '16px 20px',
  background: 'transparent',
  border: 'none',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  letterSpacing: '1px',
  transition: 'color 0.2s'
};

const contentStyle = {
  padding: '0 20px 20px'
};

export default NotificationsPanel;
