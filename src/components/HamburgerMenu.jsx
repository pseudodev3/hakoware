import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, PlusIcon, RefreshIcon, LogoutIcon, MenuIcon, DollarIcon } from './icons/Icons';

const HamburgerMenu = ({ onAddFriend, onRefresh, onOpenMarketplace }) => {
  const { user, logout, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: isOpen ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
          border: `1px solid ${isOpen ? '#ffd700' : '#333'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          padding: '8px 12px',
          transition: 'all 0.2s'
        }}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: userProfile?.avatar ? 'transparent' : 'linear-gradient(135deg, #333 0%, #111 100%)',
          border: `2px solid ${isOpen ? '#ffd700' : '#444'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          color: isOpen ? '#ffd700' : '#fff',
          transition: 'all 0.2s'
        }}>
          {userProfile?.avatar ? (
            <img 
              src={userProfile.avatar} 
              alt={user?.displayName}
              style={{ width: '100%', height: '100%', borderRadius: '50%' }}
            />
          ) : (
            getInitials(user?.displayName || user?.email)
          )}
        </div>

        <MenuIcon size={20} color={isOpen ? '#ffd700' : '#666'} isOpen={isOpen} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '8px',
          minWidth: '240px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
          zIndex: 1000,
          animation: 'slideDown 0.2s ease-out'
        }}>
          {/* User Info */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #1a1a1a',
            marginBottom: '8px'
          }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
              {user?.displayName}
            </div>
            <div style={{ color: '#555', fontSize: '0.75rem' }}>
              {user?.email}
            </div>
            {userProfile?.auraScore && (
              <div style={{ 
                marginTop: '10px',
                padding: '6px 10px',
                background: 'rgba(255, 215, 0, 0.1)',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ color: '#ffd700', fontSize: '0.7rem', fontWeight: 600 }}>
                  AURA: {userProfile.auraScore}
                </span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <MenuItem onClick={() => { onAddFriend(); setIsOpen(false); }}>
            <PlusIcon size={18} color="#00e676" />
            <span>Add Friend</span>
          </MenuItem>

          <MenuItem onClick={() => { onRefresh(); setIsOpen(false); }}>
            <RefreshIcon size={18} color="#888" />
            <span>Refresh</span>
          </MenuItem>

          <MenuItem onClick={() => { onOpenMarketplace(); setIsOpen(false); }}>
            <DollarIcon size={18} color="#ffd700" />
            <span>Aura Market</span>
          </MenuItem>

          <div style={{ borderTop: '1px solid #1a1a1a', margin: '8px 0' }} />

          <MenuItem onClick={handleLogout} danger>
            <LogoutIcon size={18} color="#ff4444" />
            <span>Sign Out</span>
          </MenuItem>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const MenuItem = ({ children, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: 'transparent',
      border: 'none',
      color: danger ? '#ff4444' : '#aaa',
      fontSize: '0.9rem',
      cursor: 'pointer',
      borderRadius: '8px',
      transition: 'all 0.15s',
      textAlign: 'left'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = danger ? 'rgba(255, 68, 68, 0.1)' : '#1a1a1a';
      e.currentTarget.style.color = danger ? '#ff4444' : '#fff';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = danger ? '#ff4444' : '#aaa';
    }}
  >
    {children}
  </button>
);

export default HamburgerMenu;
