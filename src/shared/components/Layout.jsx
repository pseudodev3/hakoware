import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Award,
  Trophy,
  Wallet,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Skull,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationsPanel } from '../../features/notifications/components/NotificationsPanel';
import { ProfileModal } from './ProfileModal';
import './Layout.css';

export const Layout = ({ children, activeTab, onTabChange, onAddFriend, className = '', pendingInvitations = [], onRefresh, showToast }) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'achievements', label: 'Achievements', icon: Award },
    { id: 'arena', label: 'Arena', icon: Trophy },
    { id: 'shame', label: 'Shame Board', icon: Skull },
    { id: 'wallet', label: 'Aura Wallet', icon: Wallet },
  ];

  const primaryMobileNav = navItems.filter(item => ['dashboard', 'friends', 'arena', 'wallet'].includes(item.id));

  const handleTabClick = (id) => {
    onTabChange(id);
    setShowMobileMenu(false);
  };

  const currentLabel = navItems.find(i => i.id === activeTab)?.label || 'Hakoware';

  return (
    <div className={`app-layout ${collapsed ? 'collapsed' : ''} ${className}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <img className="brand-mark" src="/hakoware-mark.svg" alt="" />
            {!collapsed && <span className="logo-text">Hakoware</span>}
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleTabClick(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={19} strokeWidth={1.7} className="nav-icon" />
              {!collapsed && <span>{item.label}</span>}
              {activeTab === item.id && <span className="nav-pill" aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="add-friend-btn" onClick={onAddFriend} title={collapsed ? 'Add friend' : undefined}>
            <Plus size={18} strokeWidth={1.8} />
            {!collapsed && <span>New contract</span>}
          </button>

          <div className="user-profile">
            <button className="profile-trigger" onClick={() => setShowProfile(true)} title={collapsed ? user?.displayName : undefined}>
              <div className="user-avatar">{user?.displayName?.[0]?.toUpperCase() || 'U'}</div>
              {!collapsed && (
                <div className="user-info">
                  <p className="user-name">{user?.displayName}</p>
                  <p className="user-aura">{user?.auraBalance || 0} Aura</p>
                </div>
              )}
            </button>
            {!collapsed && (
              <button className="logout-btn" onClick={logout} aria-label="Sign out">
                <LogOut size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="content-container">
        <header className="content-header">
          <div className="header-title">
            <p>Hakoware / active</p>
            <h2>{currentLabel}</h2>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setShowNotifications(true)} aria-label="Open notifications">
              <Bell size={19} strokeWidth={1.8} />
              {(unreadCount > 0 || pendingInvitations.length > 0) && (
                <span className="badge">{unreadCount + pendingInvitations.length}</span>
              )}
            </button>
          </div>
        </header>
        <div className="scroll-content">{children}</div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {primaryMobileNav.map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => handleTabClick(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <item.icon className="nav-icon" strokeWidth={1.8} />
            <span>{item.label.split(' ')[0]}</span>
          </button>
        ))}
        <button className={`mobile-nav-item ${showMobileMenu ? 'active' : ''}`} onClick={() => setShowMobileMenu(true)}>
          <Menu className="nav-icon" strokeWidth={1.8} />
          <span>More</span>
        </button>
      </nav>

      <AnimatePresence initial={false}>
        {showMobileMenu && (
          <motion.div
            className="mobile-full-menu"
            initial={{ opacity: 0, y: 16, scale: .985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: .99 }}
            transition={{ type: 'spring', duration: .3, bounce: 0 }}
          >
            <div className="mobile-menu-header">
              <button className="mobile-profile" onClick={() => { setShowProfile(true); setShowMobileMenu(false); }}>
                <div className="user-avatar">{user?.displayName?.[0]?.toUpperCase() || 'U'}</div>
                <div className="user-info">
                  <p className="user-name">{user?.displayName}</p>
                  <p className="user-aura">{user?.auraBalance || 0} Aura</p>
                </div>
              </button>
              <button className="close-menu-btn" onClick={() => setShowMobileMenu(false)} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>

            <div className="mobile-menu-content">
              {navItems.filter(item => !['dashboard', 'friends', 'arena', 'wallet'].includes(item.id)).map(item => (
                <button key={item.id} className={`mobile-menu-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => handleTabClick(item.id)}>
                  <item.icon size={19} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="mobile-menu-divider" />
              <button className="mobile-menu-item action" onClick={() => { onAddFriend(); setShowMobileMenu(false); }}>
                <Plus size={19} />
                <span>New contract</span>
              </button>
              <button className="mobile-menu-item danger" onClick={() => { logout(); setShowMobileMenu(false); }}>
                <LogOut size={19} />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
        pendingInvitations={pendingInvitations}
        onRefresh={onRefresh}
        showToast={showToast}
      />

      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
};
