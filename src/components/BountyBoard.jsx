import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getActiveBounties, claimBounty, getUserBountyStats } from '../services/bountyService';
import { TargetIcon, CrosshairIcon, TrophyIcon } from './icons/Icons';

const BountyBoard = ({ onCreateBounty }) => {
  const { user } = useAuth();
  const [bounties, setBounties] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [activeBounties, userStats] = await Promise.all([
      getActiveBounties(),
      user ? getUserBountyStats(user.uid) : null
    ]);
    setBounties(activeBounties);
    setStats(userStats);
    setLoading(false);
  };

  const handleClaim = async (bounty) => {
    if (!user) {
      alert('You must be logged in to claim bounties');
      return;
    }

    setClaimingId(bounty.id);
    const result = await claimBounty(
      bounty.id,
      user.uid,
      user.displayName || 'Anonymous Hunter',
      'Contact made - bounty claimed!'
    );
    
    if (result.success) {
      alert(result.message);
      loadData();
    } else {
      alert(result.error);
    }
    setClaimingId(null);
  };

  const formatTimeLeft = (createdAt) => {
    if (!createdAt) return '7d left';
    
    const now = new Date();
    const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
    // Bounties expire 7 days after creation
    const expires = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
    const diff = expires - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return 'Expiring soon';
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Loading Bounty Board...
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TargetIcon size={28} color="#ff8800" />
          <div>
            <h2 style={{ margin: 0, color: '#ff8800', fontSize: '1.3rem' }}>BOUNTY BOARD</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              Hunt Down Ghosts • Earn Rewards
            </p>
          </div>
        </div>
        
        {stats && (
          <div style={hunterBadgeStyle}>
            <CrosshairIcon size={16} color="#ff8800" />
            <span>{stats.hunterRank}</span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {stats && (
        <div style={statsBarStyle}>
          <div style={statItemStyle}>
            <span style={{ color: '#ff8800', fontSize: '1.3rem', fontWeight: 'bold' }}>
              {stats.huntsCompleted}
            </span>
            <span style={{ color: '#666', fontSize: '0.65rem' }}>HUNTS</span>
          </div>
          <div style={{ width: '1px', height: '25px', background: '#333' }} />
          <div style={statItemStyle}>
            <span style={{ color: '#ffd700', fontSize: '1.3rem', fontWeight: 'bold' }}>
              {stats.totalEarned}
            </span>
            <span style={{ color: '#666', fontSize: '0.65rem' }}>EARNED</span>
          </div>
          <div style={{ width: '1px', height: '25px', background: '#333' }} />
          <div style={statItemStyle}>
            <span style={{ color: '#00e676', fontSize: '1.3rem', fontWeight: 'bold' }}>
              {bounties.length}
            </span>
            <span style={{ color: '#666', fontSize: '0.65rem' }}>ACTIVE</span>
          </div>
        </div>
      )}

      {/* Bounty List */}
      <div style={listStyle}>
        {bounties.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎯</div>
            <p style={{ color: '#666', margin: 0 }}>No active bounties!</p>
            <p style={{ color: '#444', fontSize: '0.8rem', margin: '5px 0 15px 0' }}>
              Be the first to put a price on someone's head.
            </p>
            {onCreateBounty && (
              <button onClick={onCreateBounty} style={createButtonStyle}>
                CREATE BOUNTY
              </button>
            )}
          </div>
        ) : (
          <>
            {bounties.map((bounty, index) => (
              <div 
                key={bounty.id}
                style={{
                  ...itemStyle,
                  animationDelay: `${index * 0.1}s`
                }}
              >
                {/* Reward */}
                <div style={rewardContainerStyle}>
                  <TrophyIcon size={20} color="#ffd700" />
                  <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {bounty.amount}
                  </span>
                  <span style={{ color: '#666', fontSize: '0.7rem' }}>AURA</span>
                </div>

                {/* Details */}
                <div style={contentStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>
                      {bounty.targetName}
                    </span>
                    <span style={{ color: '#444' }}>•</span>
                    <span style={{ color: '#666', fontSize: '0.85rem' }}>
                      Wanted by {bounty.creatorName}
                    </span>
                  </div>
                  
                  <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '0.85rem' }}>
                    "{bounty.message}"
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      color: '#ff4444', 
                      fontSize: '0.75rem',
                      background: 'rgba(255,68,68,0.1)',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      HIGH PRIORITY
                    </span>
                    <span style={{ color: '#666', fontSize: '0.75rem' }}>
                      {formatTimeLeft(bounty.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Claim Button */}
                <button
                  onClick={() => handleClaim(bounty)}
                  disabled={claimingId === bounty.id}
                  style={{
                    ...claimButtonStyle,
                    opacity: claimingId === bounty.id ? 0.6 : 1
                  }}
                >
                  {claimingId === bounty.id ? 'CLAIMING...' : 'CLAIM'}
                </button>
              </div>
            ))}
            
            {onCreateBounty && (
              <button onClick={onCreateBounty} style={createButtonFullStyle}>
                + CREATE NEW BOUNTY
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #0a0a0a, #111)',
  border: '1px solid #222',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 25px',
  borderBottom: '1px solid #222',
  background: 'linear-gradient(90deg, rgba(255,136,0,0.05) 0%, transparent 100%)'
};

const hunterBadgeStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  background: 'rgba(255,136,0,0.1)',
  border: '1px solid #ff8800',
  borderRadius: '20px',
  color: '#ff8800',
  fontSize: '0.8rem',
  fontWeight: 'bold'
};

const statsBarStyle = {
  display: 'flex',
  justifyContent: 'space-around',
  padding: '15px',
  background: '#0a0a0a',
  borderBottom: '1px solid #1a1a1a'
};

const statItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '3px'
};

const listStyle = {
  maxHeight: '350px',
  overflowY: 'auto',
  padding: '15px'
};

const itemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '15px',
  background: 'rgba(255,136,0,0.03)',
  border: '1px solid #2a1a00',
  borderRadius: '12px',
  marginBottom: '10px',
  transition: 'all 0.3s ease',
  animation: 'slideInBounty 0.5s ease forwards'
};

const rewardContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '12px',
  background: 'rgba(255,215,0,0.1)',
  border: '1px solid #443300',
  borderRadius: '10px',
  minWidth: '70px'
};

const contentStyle = {
  flex: 1,
  minWidth: 0
};

const claimButtonStyle = {
  padding: '10px 20px',
  background: '#ff8800',
  border: 'none',
  borderRadius: '8px',
  color: '#000',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '0.85rem',
  letterSpacing: '1px',
  transition: 'all 0.2s'
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '40px 20px'
};

const createButtonStyle = {
  padding: '12px 24px',
  background: '#ff8800',
  border: 'none',
  borderRadius: '8px',
  color: '#000',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '0.9rem'
};

const createButtonFullStyle = {
  width: '100%',
  padding: '14px',
  background: 'transparent',
  border: '1px dashed #444',
  borderRadius: '8px',
  color: '#666',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '0.85rem',
  marginTop: '10px',
  transition: 'all 0.2s'
};

// Add keyframes once
if (typeof document !== 'undefined' && !document.getElementById('bounty-board-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'bounty-board-styles';
  styleSheet.textContent = `
    @keyframes slideInBounty {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default BountyBoard;
