import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserFriendships } from '../../services/friendshipService';
import { calculateDebt } from '../../utils/gameLogic';
import { DollarIcon, SkullIcon, XIcon, TrendingUpIcon } from '../icons/Icons';

const AuraMarketplaceModal = ({ isOpen, onClose, onBailout }) => {
  const { user } = useAuth();
  const [bankruptFriends, setBankruptFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadBankruptFriends();
    }
  }, [isOpen, user]);

  const loadBankruptFriends = async () => {
    setLoading(true);
    const friendships = await getUserFriendships(user.uid);
    
    const bankrupt = friendships
      .map(f => {
        const isUser1 = f.myPerspective === 'user1';
        const friendData = isUser1 ? f.user2Perspective : f.user1Perspective;
        const friend = isUser1 ? f.user2 : f.user1;
        const stats = calculateDebt({
          baseDebt: friendData.baseDebt,
          lastInteraction: friendData.lastInteraction,
          bankruptcyLimit: friendData.limit
        });
        return { ...f, friend, stats };
      })
      .filter(f => f.stats.totalDebt > 0)
      .sort((a, b) => b.stats.totalDebt - a.stats.totalDebt);

    setBankruptFriends(bankrupt);
    setLoading(false);
  };

  if (!isOpen) return null;

  const totalDebtAvailable = bankruptFriends.reduce((sum, f) => sum + f.stats.totalDebt, 0);
  const bankruptCount = bankruptFriends.filter(f => f.stats.isBankrupt).length;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 24px 0',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              color: '#ffd700', 
              fontSize: '1.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <DollarIcon size={24} color="#ffd700" />
              AURA MARKETPLACE
            </h2>
            <p style={{ margin: '6px 0 0 0', color: '#666', fontSize: '0.85rem' }}>
              Bail out friends in debt. Earn gratitude (and interest).
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#222'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <XIcon size={24} color="#666" />
          </button>
        </div>

        {/* Stats Bar */}
        {!loading && bankruptFriends.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '20px',
            padding: '0 24px',
            marginBottom: '20px'
          }}>
            <StatBox 
              label="Total Debt" 
              value={`${totalDebtAvailable} APR`}
              icon={<TrendingUpIcon size={16} color="#ffd700" />}
            />
            <StatBox 
              label="Bankrupt" 
              value={bankruptCount}
              icon={<SkullIcon size={16} color="#ff4444" />}
              danger
            />
            <StatBox 
              label="In Debt" 
              value={bankruptFriends.length}
              icon={<DollarIcon size={16} color="#00e676" />}
            />
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '0 24px 24px', overflowY: 'auto', maxHeight: '60vh' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Loading market data...
            </div>
          ) : bankruptFriends.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: '#666'
            }}>
              <DollarIcon size={48} color="#333" style={{ marginBottom: '16px' }} />
              <p style={{ fontSize: '1.1rem', margin: '0 0 8px 0' }}>No debtors found</p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>All your friends are solvent</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bankruptFriends.map((item) => (
                <MarketItem 
                  key={item.id} 
                  item={item} 
                  onBailout={() => onBailout(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, danger }) => (
  <div style={{
    flex: 1,
    background: 'rgba(255,255,255,0.02)',
    border: danger ? '1px solid rgba(255,68,68,0.2)' : '1px solid #222',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }}>
    <div style={{
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      background: danger ? 'rgba(255,68,68,0.1)' : 'rgba(255,215,0,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: danger ? '#ff4444' : '#fff' }}>
        {value}
      </div>
    </div>
  </div>
);

const MarketItem = ({ item, onBailout }) => {
  const isBankrupt = item.stats.isBankrupt;
  const isInWarningZone = item.stats.isInWarningZone;
  const debtRatio = Math.min(item.stats.totalDebt / (item.stats.limit * 2), 1);

  return (
    <div style={{
      background: isBankrupt ? 'rgba(255,68,68,0.05)' : isInWarningZone ? 'rgba(255,136,0,0.05)' : 'rgba(255,255,255,0.02)',
      border: isBankrupt ? '1px solid rgba(255,68,68,0.3)' : isInWarningZone ? '1px solid rgba(255,136,0,0.3)' : '1px solid #1a1a1a',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      transition: 'all 0.2s',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      e.currentTarget.style.transform = 'translateX(4px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
      e.currentTarget.style.transform = 'translateX(0)';
    }}
    onClick={onBailout}
    >
      {/* Avatar */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: isBankrupt 
          ? 'linear-gradient(135deg, #330000 0%, #1a0000 100%)' 
          : isInWarningZone
          ? 'linear-gradient(135deg, #332200 0%, #1a1000 100%)'
          : 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
        border: isBankrupt ? '2px solid #ff4444' : isInWarningZone ? '2px solid #ff8800' : '2px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        fontWeight: 600,
        color: isBankrupt ? '#ff4444' : isInWarningZone ? '#ff8800' : '#888'
      }}>
        {item.friend.displayName?.charAt(0).toUpperCase() || '?'}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          marginBottom: '4px'
        }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
            {item.friend.displayName}
          </span>
          {isBankrupt && (
            <span style={{
              fontSize: '0.65rem',
              color: '#ff4444',
              background: 'rgba(255,68,68,0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600
            }}>
              BANKRUPT
            </span>
          )}
          {isInWarningZone && !isBankrupt && (
            <span style={{
              fontSize: '0.65rem',
              color: '#ff8800',
              background: 'rgba(255,136,0,0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600
            }}>
              WARNING
            </span>
          )}
        </div>

        {/* Debt Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            flex: 1,
            height: '4px',
            background: '#1a1a1a',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${debtRatio * 100}%`,
              height: '100%',
              background: isBankrupt ? '#ff4444' : isInWarningZone ? '#ff8800' : '#ffd700',
              borderRadius: '2px',
              transition: 'width 0.3s'
            }} />
          </div>
          <span style={{ 
            color: isBankrupt ? '#ff4444' : isInWarningZone ? '#ff8800' : '#ffd700', 
            fontWeight: 600,
            fontSize: '0.9rem',
            minWidth: '60px',
            textAlign: 'right'
          }}>
            {item.stats.totalDebt} APR
          </span>
        </div>
      </div>

      {/* Action */}
      <button
        onClick={(e) => { e.stopPropagation(); onBailout(); }}
        style={{
          padding: '10px 20px',
          background: isBankrupt ? 'rgba(255,68,68,0.1)' : isInWarningZone ? 'rgba(255,136,0,0.1)' : 'rgba(0,230,118,0.1)',
          border: isBankrupt ? '1px solid #ff4444' : isInWarningZone ? '1px solid #ff8800' : '1px solid #00e676',
          borderRadius: '8px',
          color: isBankrupt ? '#ff4444' : isInWarningZone ? '#ff8800' : '#00e676',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isBankrupt ? 'rgba(255,68,68,0.2)' : isInWarningZone ? 'rgba(255,136,0,0.2)' : 'rgba(0,230,118,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isBankrupt ? 'rgba(255,68,68,0.1)' : isInWarningZone ? 'rgba(255,136,0,0.1)' : 'rgba(0,230,118,0.1)';
        }}
      >
        BAIL
      </button>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.9)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px'
};

const modalStyle = {
  background: '#0f0f0f',
  border: '1px solid #222',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '600px',
  maxHeight: '80vh',
  overflow: 'hidden',
  boxShadow: '0 40px 80px rgba(0,0,0,0.9)'
};

export default AuraMarketplaceModal;
