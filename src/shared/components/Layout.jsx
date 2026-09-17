import React, { useState } from 'react';
import { Bell, Home, LogOut, Plus, Swords, Users, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationsPanel } from '../../features/notifications/components/NotificationsPanel';
import './Layout.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'contracts', label: 'Contracts', icon: Users },
  { id: 'arena', label: 'Arena', icon: Swords },
  { id: 'you', label: 'You', icon: UserRound }
];

export const Layout = ({ children, activeTab, onTabChange, onAddFriend, pendingInvitations = [], onRefresh, showToast }) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const currentLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Hakoware';
  const totalBadge = unreadCount + pendingInvitations.length;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-mark" src="/hakoware-mark.svg" alt="" />
          <span>Hakoware</span>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <item.icon size={19} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="new-contract-btn" onClick={onAddFriend}>
            <Plus size={18} strokeWidth={1.9} />
            <span>New contract</span>
          </button>

          <button className="sidebar-user" onClick={() => onTabChange('you')} aria-label="Open your profile">
            <span className="sidebar-avatar">{user?.displayName?.[0]?.toUpperCase() || 'U'}</span>
            <span className="sidebar-user-copy">
              <strong>{user?.displayName}</strong>
              <small>{user?.auraBalance || 0} Aura</small>
            </span>
          </button>

          <button className="logout-btn" onClick={logout} aria-label="Sign out">
            <LogOut size={17} strokeWidth={1.8} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="content-container">
        <header className="content-header">
          <div className="mobile-brand">
            <img src="/hakoware-mark.svg" alt="" />
            <span>{currentLabel}</span>
          </div>
          <button className="notification-btn" onClick={() => setShowNotifications(true)} aria-label="Open notifications">
            <Bell size={19} strokeWidth={1.8} />
            {totalBadge > 0 && <span className="notification-badge">{totalBadge > 99 ? '99+' : totalBadge}</span>}
          </button>
        </header>

        <div className="scroll-content">{children}</div>
      </main>

      <nav className="mobile-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <item.icon className="nav-icon" size={20} strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <NotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
        pendingInvitations={pendingInvitations}
        onRefresh={onRefresh}
        showToast={showToast}
      />
    </div>
  );
};
