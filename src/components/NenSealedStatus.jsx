import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calculateDebt } from '../utils/gameLogic';
import { LockIcon, ClockIcon, SkullIcon } from './icons/Icons';

/**
 * Nen Sealed Status - Enhanced Bankruptcy Consequences
 * 
 * When bankrupt:
 * - 30-day "Nen Sealed" period
 * - Cannot use special features (roulette, bounties, etc.)
 * - Visual "seal" indicator
 * - Countdown to restoration
 */
const NenSealedStatus = ({ friendships = [] }) => {
  const { user } = useAuth();
  const [isBankrupt, setIsBankrupt] = useState(false);
  const [daysUntilRestored, setDaysUntilRestored] = useState(0);
  const [sealProgress, setSealProgress] = useState(0);
  const [recentBankruptcy, setRecentBankruptcy] = useState(null);

  useEffect(() => {
    checkBankruptcyStatus();
  }, [friendships, user]);

  const checkBankruptcyStatus = async () => {
    if (!user || !friendships) return;

    // Check if user is currently bankrupt in any friendship
    const bankruptFriendships = friendships.filter(f => {
      const isUser1 = f.myPerspective === 'user1';
      const myData = isUser1 ? f.user1Perspective : f.user2Perspective;
      const stats = calculateDebt({
        baseDebt: myData.baseDebt,
        lastInteraction: myData.lastInteraction,
        bankruptcyLimit: myData.limit
      });
      return stats.isBankrupt;
    });

    if (bankruptFriendships.length > 0) {
      setIsBankrupt(true);
      
      // Get the most recent bankruptcy
      const mostRecent = bankruptFriendships[0];
      const isUser1 = mostRecent.myPerspective === 'user1';
      const myData = isUser1 ? mostRecent.user1Perspective : mostRecent.user2Perspective;
      
      // Calculate 30-day seal period
      const bankruptcyDate = myData.bankruptcyDeclaredAt?.toDate?.() || new Date();
      const sealEndDate = new Date(bankruptcyDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      const diff = sealEndDate - now;
      const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      
      setDaysUntilRestored(Math.max(0, daysLeft));
      
      // Calculate progress
      const totalSealDays = 30;
      const daysPassed = totalSealDays - daysLeft;
      setSealProgress((daysPassed / totalSealDays) * 100);
      
      setRecentBankruptcy({
        declaredAt: bankruptcyDate,
        debtAtBankruptcy: myData.bankruptcyDebt || 0,
        friendName: isUser1 ? mostRecent.user2?.displayName : mostRecent.user1?.displayName
      });
    } else {
      setIsBankrupt(false);
    }
  };

  if (!isBankrupt) return null;

  return (
    <div style={containerStyle}>
      {/* Seal Visual */}
      <div style={sealContainerStyle}>
        <div style={sealCircleStyle}>
          <LockIcon size={32} color="#ff4444" />
          <div style={sealRingStyle} />
          <div 
            style={{
              ...sealProgressStyle,
              clipPath: `polygon(0 0, 100% 0, 100% ${sealProgress}%, 0 ${sealProgress}%)`
            }} 
          />
        </div>
        
        <div style={sealTextStyle}>
          <h3 style={{ margin: '0 0 5px 0', color: '#ff4444', fontSize: '1.1rem' }}>
            Nen sealed
          </h3>
          <p style={{ margin: 0, color: '#888', fontSize: '0.75rem' }}>
            Bankruptcy consequences in effect
          </p>
        </div>
      </div>

      {/* Restriction List */}
      <div style={restrictionsStyle}>
        <div style={restrictionItemStyle}>
          <SkullIcon size={16} color="#444" />
          <span style={{ color: '#666', fontSize: '0.8rem' }}>Cannot create bounties</span>
        </div>
        <div style={restrictionItemStyle}>
          <SkullIcon size={16} color="#444" />
          <span style={{ color: '#666', fontSize: '0.8rem' }}>Cannot use Debt Roulette</span>
        </div>
        <div style={restrictionItemStyle}>
          <SkullIcon size={16} color="#444" />
          <span style={{ color: '#666', fontSize: '0.8rem' }}>Cannot issue challenges</span>
        </div>
        <div style={restrictionItemStyle}>
          <SkullIcon size={16} color="#444" />
          <span style={{ color: '#666', fontSize: '0.8rem' }}>Shame Wall spotlight</span>
        </div>
      </div>

      {/* Countdown */}
      <div style={countdownStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <ClockIcon size={16} color="#ff8800" />
          <span style={{ color: '#ff8800', fontSize: '0.8rem', fontWeight: 'bold' }}>
            Restoration countdown
          </span>
        </div>
        
        <div style={countdownNumberStyle}>
          {daysUntilRestored} days
        </div>
        
        <div style={progressBarContainerStyle}>
          <div 
            style={{
              ...progressBarStyle,
              width: `${sealProgress}%`
            }} 
          />
        </div>
        
        <p style={{ margin: '8px 0 0 0', color: '#444', fontSize: '0.7rem' }}>
          Complete check-ins to reduce seal duration
        </p>
      </div>

      {/* Bankruptcy Info */}
      {recentBankruptcy && (
        <div style={bankruptcyInfoStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ color: '#666', fontSize: '0.75rem' }}>Debt at Bankruptcy:</span>
            <span style={{ color: '#ff4444', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {recentBankruptcy.debtAtBankruptcy} APR
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666', fontSize: '0.75rem' }}>Owed to:</span>
            <span style={{ color: '#888', fontSize: '0.75rem' }}>
              {recentBankruptcy.friendName}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #330000',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px',
  padding: '20px'
};

const sealContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  marginBottom: '20px',
  paddingBottom: '20px',
  borderBottom: '1px solid #1a0000'
};

const sealCircleStyle = {
  position: 'relative',
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  background: 'rgba(255,68,68,0.1)',
  border: '2px solid #ff4444',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const sealRingStyle = {
  position: 'absolute',
  inset: '-4px',
  borderRadius: '50%',
  border: '2px dashed #ff4444',
  animation: 'spin 10s linear infinite'
};

const sealProgressStyle = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'rgba(0,230,118,0.2)',
  transition: 'clip-path 0.5s ease'
};

const sealTextStyle = {
  flex: 1
};

const restrictionsStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginBottom: '20px',
  padding: '15px',
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '8px'
};

const restrictionItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px'
};

const countdownStyle = {
  textAlign: 'center',
  padding: '15px',
  background: 'rgba(255,136,0,0.05)',
  borderRadius: '8px',
  border: '1px solid #2a1a00'
};

const countdownNumberStyle = {
  fontSize: '2rem',
  fontWeight: 'bold',
  color: '#ff8800',
  marginBottom: '10px'
};

const progressBarContainerStyle = {
  height: '6px',
  background: '#1a1a1a',
  borderRadius: '3px',
  overflow: 'hidden'
};

const progressBarStyle = {
  height: '100%',
  background: 'linear-gradient(90deg, #ff4444, #ff8800, #00e676)',
  borderRadius: '3px',
  transition: 'width 0.5s ease'
};

const bankruptcyInfoStyle = {
  marginTop: '15px',
  padding: '12px',
  background: 'rgba(255,68,68,0.05)',
  borderRadius: '8px'
};

export default NenSealedStatus;
