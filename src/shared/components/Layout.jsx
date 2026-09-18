import React, { useEffect, useState } from 'react';
import { Bell, Home, LogOut, Moon, Plus, Sun, Swords, Users, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { applyTheme, getInitialTheme } from '../../lib/theme';
import { NotificationsPanel } from '../../features/notifications/components/NotificationsPanel';
import './Layout.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'contracts', label: 'Contracts', icon: Users },
  { id: 'arena', label: 'Arena', icon: Swords },
  { id: 'you', label: 'You', icon: UserRound }
];

export const Layout = ({ children, activeTab, onTabChange, onAddFriend, pendingInvitations = [], onRefresh, showToast }) => {
  const { user, logout, bootstrapData } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(bootstrapData?.notifications?.unreadCount || 0);
  const [theme, setTheme] = useState(getInitialTheme);
  const currentLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Hakoware';
  const totalBadge = unreadCount + pendingInvitations.length;

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (bootstrapData?.notifications) {
      setUnreadCount(bootstrapData.notifications.unreadCount || 0);
    }
  }, [bootstrapData?.notifications?.unreadCount]);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Use light mode' : 'Use dark mode';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-mark" src="/hakoware-mark-v2.png" alt="" />
          <span>Hakoware</span>
          <span className="brand-status">LIVE</span>
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
            <Plus size={18} strokeWidth={2} />
            <span>New contract</span>
          </button>

          <button className="sidebar-user" onClick={() => onTabChange('you')} aria-label="Open your profile">
            <span className="sidebar-avatar">{user?.displayName?.[0]?.toUpperCase() || 'U'}</span>
            <span className="sidebar-user-copy">
              <strong>{user?.displayName}</strong>
              <small>{user?.auraBalance || 0} Aura</small>
            </span>
          </button>

          <div className="sidebar-utility-row">
            <button className="utility-btn" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
              <ThemeIcon size={17} strokeWidth={1.8} />
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button className="logout-btn" onClick={logout} aria-label="Sign out">
              <LogOut size={17} strokeWidth={1.8} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="content-container">
        <header className="content-header">
          <div className="mobile-brand">
            <img src="/hakoware-mark-v2.png" alt="" />
            <div><strong>Hakoware</strong><span>{currentLabel}</span></div>
          </div>
          <div className="header-actions">
            <button className="theme-btn" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
              <ThemeIcon size={18} strokeWidth={1.8} />
            </button>
            <button className="notification-btn" onClick={() => setShowNotifications(true)} aria-label="Open notifications">
              <Bell size={19} strokeWidth={1.8} />
              {totalBadge > 0 && <span className="notification-badge">{totalBadge > 99 ? '99+' : totalBadge}</span>}
            </button>
          </div>
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
