import { useState, useEffect } from 'react';
import { performCheckin, hasCheckedInToday } from '../../services/checkinService';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDebt } from '../../utils/gameLogic';

const CheckinModal = ({ isOpen, onClose, friendship, showToast, onCheckinComplete }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [proof, setProof] = useState('');

  useEffect(() => {
    if (isOpen && friendship && user) {
      checkTodayStatus();
    }
  }, [isOpen, friendship, user]);

  const checkTodayStatus = async () => {
    const checkedIn = await hasCheckedInToday(friendship.id, user.uid);
    setAlreadyCheckedIn(checkedIn);
  };

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  const friend = isUser1 ? friendship.user2 : friendship.user1;
  
  const stats = calculateDebt({
    baseDebt: myData.baseDebt,
    lastInteraction: myData.lastInteraction,
    bankruptcyLimit: myData.limit
  });

  const handleCheckin = async () => {
    if (alreadyCheckedIn) {
      showToast('You already checked in today!', 'ERROR');
      return;
    }

    setLoading(true);
    const result = await performCheckin(
      friendship.id, 
      user.uid, 
      proof.trim() || null
    );
    setLoading(false);

    if (result.success) {
      showToast(result.message, 'SUCCESS');
      onCheckinComplete();
      onClose();
    } else {
      showToast(result.message || 'Check-in failed', 'ERROR');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ color: '#00e676', marginTop: 0 }}>✓ CHECK IN</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#888', marginBottom: '10px' }}>
            Checking in with <strong style={{ color: '#fff' }}>{friend.displayName}</strong>
          </p>
          
          {alreadyCheckedIn ? (
            <div style={{
              background: 'rgba(0, 230, 118, 0.1)',
              border: '1px solid #00e676',
              borderRadius: '8px',
              padding: '15px',
              color: '#00e676'
            }}>
              You have already checked in today!
              <p style={{ fontSize: '0.8rem', marginTop: '5px', color: '#888' }}>
                Come back tomorrow to maintain your streak.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '15px',
                background: '#0a0a0a',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <span style={{ color: '#888' }}>Current Debt:</span>
                <span style={{ color: stats.totalDebt > 0 ? '#ff4444' : '#00e676', fontWeight: 'bold' }}>
                  {stats.totalDebt} APR
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '15px',
                background: '#0a0a0a',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <span style={{ color: '#888' }}>Debt After Check-in:</span>
                <span style={{ color: '#00e676', fontWeight: 'bold' }}>
                  {Math.max(0, stats.totalDebt - 2)} APR
                </span>
              </div>

              {friendship.streak > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '15px',
                  background: 'rgba(255, 215, 0, 0.1)',
                  border: '1px solid #ffd700',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <span style={{ color: '#ffd700' }}>Current Streak:</span>
                  <span style={{ color: '#ffd700', fontWeight: 'bold' }}>
                    {friendship.streak} days
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  color: '#888', 
                  fontSize: '0.75rem', 
                  marginBottom: '8px',
                  textTransform: 'uppercase'
                }}>
                  Proof of Contact (Optional)
                </label>
                <textarea
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  placeholder="e.g., Had coffee at Starbucks, talked about..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    minHeight: '80px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '5px' }}>
                  Check-ins reduce debt by 2 APR. This helps with accountability and tracking your friendship history.
                </p>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!alreadyCheckedIn && (
            <button
              onClick={handleCheckin}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                background: loading ? '#333' : '#004d40',
                color: loading ? '#666' : '#00e676',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                letterSpacing: '1px'
              }}
            >
              {loading ? 'Processing...' : 'CONFIRM CHECK-IN'}
            </button>
          )}
          
          <button
            onClick={onClose}
            style={{
              flex: alreadyCheckedIn ? 1 : 'unset',
              padding: '14px',
              background: 'transparent',
              color: '#888',
              border: '1px solid #444',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {alreadyCheckedIn ? 'CLOSE' : 'CANCEL'}
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px'
};

const modalStyle = {
  background: 'linear-gradient(145deg, #151515, #0d0d0d)',
  padding: '32px',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '420px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  textAlign: 'center'
};

export default CheckinModal;
