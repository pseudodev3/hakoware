import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFriendships } from '../services/friendshipService';
import { calculateDebt } from '../utils/gameLogic';

const AuraMarketplace = ({ onBailout }) => {
  const { user } = useAuth();
  const [bankruptFriends, setBankruptFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadBankruptFriends();
  }, [user]);

  const loadBankruptFriends = async () => {
    setLoading(true);
    const friendships = await getUserFriendships(user.uid);
    
    // Find friends who are bankrupt (from their perspective - they owe money)
    const bankrupt = friendships.filter(f => {
      const isUser1 = f.myPerspective === 'user1';
      const friendData = isUser1 ? f.user2Perspective : f.user1Perspective;
      const stats = calculateDebt({
        baseDebt: friendData.baseDebt,
        lastInteraction: friendData.lastInteraction,
        bankruptcyLimit: friendData.limit
      });
      return stats.totalDebt > 0; // They owe money
    }).map(f => {
      const isUser1 = f.myPerspective === 'user1';
      const friendData = isUser1 ? f.user2Perspective : f.user1Perspective;
      const friend = isUser1 ? f.user2 : f.user1;
      const stats = calculateDebt({
        baseDebt: friendData.baseDebt,
        lastInteraction: friendData.lastInteraction,
        bankruptcyLimit: friendData.limit
      });
      return { ...f, friend, stats };
    }).sort((a, b) => b.stats.totalDebt - a.stats.totalDebt);

    setBankruptFriends(bankrupt);
    setLoading(false);
  };

  if (loading) return null;
  if (bankruptFriends.length === 0) return null;

  const totalDebtAvailable = bankruptFriends.reduce((sum, f) => sum + f.stats.totalDebt, 0);

  return (
    <div style={containerStyle}>
      <button 
        onClick={() => setExpanded(!expanded)}
        style={headerStyle}
      >
        <span>💸 AURA MARKETPLACE</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#00e676', fontSize: '0.8rem' }}>
            {totalDebtAvailable} APR available
          </span>
          <span style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            ▼
          </span>
        </span>
      </button>

      {expanded && (
        <div style={contentStyle}>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '15px' }}>
            These friends need help. Bail them out to earn gratitude (and interest).
          </p>
          
          {bankruptFriends.map((item) => (
            <div key={item.id} style={marketItemStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: item.stats.isBankrupt 
                    ? 'linear-gradient(135deg, #330000 0%, #550000 100%)' 
                    : item.stats.isInWarningZone
                    ? 'linear-gradient(135deg, #443300 0%, #665500 100%)'
                    : 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem'
                }}>
                  {item.stats.isBankrupt ? '💀' : item.stats.isInWarningZone ? '⚠️' : '😰'}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: '600' }}>
                    {item.friend.displayName}
                  </div>
                  <div style={{ 
                    color: item.stats.isBankrupt ? '#ff4444' : item.stats.isInWarningZone ? '#ff8800' : '#ffd700',
                    fontSize: '0.8rem'
                  }}>
                    {item.stats.totalDebt} APR debt
                    {item.stats.isBankrupt && (
                      <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>💀 BANKRUPT</span>
                    )}
                    {item.stats.isInWarningZone && !item.stats.isBankrupt && (
                      <span style={{ marginLeft: '8px', fontWeight: 'bold', color: '#ff8800' }}>⚠️ WARNING</span>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onBailout(item)}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #004d40 0%, #006644 100%)',
                  color: '#00e676',
                  border: '1px solid #00e676',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                💸 BAIL
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const containerStyle = {
  margin: '20px',
  background: '#0a1a0a',
  border: '1px solid #002200',
  borderRadius: '8px',
  overflow: 'hidden'
};

const headerStyle = {
  width: '100%',
  padding: '15px 20px',
  background: 'linear-gradient(135deg, #001a00 0%, #002200 100%)',
  border: 'none',
  color: '#00e676',
  fontSize: '0.9rem',
  fontWeight: '600',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const contentStyle = {
  padding: '20px',
  borderTop: '1px solid #002200'
};

const marketItemStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px',
  background: '#050a05',
  borderRadius: '8px',
  marginBottom: '10px',
  border: '1px solid #111'
};

export default AuraMarketplace;
