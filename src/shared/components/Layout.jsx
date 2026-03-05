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
  Skull
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationsPanel } from '../../features/notifications/components/NotificationsPanel';
import { ProfileModal } from './ProfileModal';
import './Layout.css';

/**
 * Main Layout with professional sidebar and navigation.
 * Handles the visual hierarchy of the entire application.
 */
export const Layout = ({ children, activeTab, onTabChange, onAddFriend }) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'achievements', label: 'Achievements', icon: Award },
    { id: 'arena', label: 'Arena', icon: Trophy },
    { id: 'shame', label: 'Wall of Shame', icon: Skull },
    { id: 'wallet', label: 'Aura Wallet', icon: Wallet },
  ];

  const handleTabClick = (id) => {
    onTabChange(id);
    if (window.innerWidth < 768) setCollapsed(true);
  };

  return (
    <div className={`app-layout ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Navigation */}
      <aside className="sidebar glass">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">H</div>
            {!collapsed && (
              <motion.span 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="logo-text"
              >
                HAKOWARE
              </motion.span>
            )}
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleTabClick(item.id)}
            >
              <item.icon size={20} className="nav-icon" />
              {!collapsed && <span>{item.label}</span>}
              {activeTab === item.id && !collapsed && (
                <motion.div layoutId="nav-pill" className="nav-pill" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="add-friend-btn" onClick={onAddFriend}>
             <Plus size={20} />
             {!collapsed && <span>ADD FRIEND</span>}
          </button>
          
          <div className="user-profile" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
            <div className="user-avatar">
              {user?.displayName?.[0] || 'U'}
            </div>
            {!collapsed && (
              <div className="user-info">
                <p className="user-name">{user?.displayName}</p>
                <p className="user-aura">{user?.auraBalance || 0} AURA</p>
              </div>
            )}
            {!collapsed && (
              <button className="logout-btn" onClick={(e) => { e.stopPropagation(); logout(); }}>
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content-container">
        <header className="content-header">
          <div className="header-title">
            <h2>{navItems.find(i => i.id === activeTab)?.label}</h2>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setShowNotifications(true)}>
              <Bell size={20} />
              {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
          </div>
        </header>
        
        <div className="scroll-content">
          {children}
        </div>
      </main>

      {/* Slide-out Notifications */}
      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
      />

      <ProfileModal 
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </div>
  );
};
