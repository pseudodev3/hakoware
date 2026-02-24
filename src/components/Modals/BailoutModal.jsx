import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDebt } from '../../utils/gameLogic';
import { api } from '../../services/api';

const BailoutModal = ({ isOpen, onClose, friendship, showToast, onBailoutComplete }) => {
  const { user, userProfile } = useAuth();
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const friendData = isUser1 ? friendship.user2Perspective : friendship.user1Perspective;
  const friend = isUser1 ? friendship.user2 : friendship.user1;
  
  const friendStats = calculateDebt({
    baseDebt: friendData.baseDebt,
    lastInteraction: friendData.lastInteraction,
    bankruptcyLimit: friendData.limit
  });

  const maxBailout = Math.min(friendStats.totalDebt, userProfile?.auraScore ? Math.floor(userProfile.auraScore / 10) : 10);

  const handleBailout = async () => {
    if (amount <= 0 || amount > friendStats.totalDebt) {
      showToast('Invalid bailout amount', 'ERROR');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/friendships/${friendship.id}/bailout`, {
        amount,
        message,
        recipientId: friend.userId
      });

      if (res.msg) throw new Error(res.msg);

      showToast(`Bailed out ${friend.displayName} for ${amount} APR!`, 'SUCCESS');
      onBailoutComplete();
      onClose();
    } catch (error) {
      console.error('Bailout error:', error);
      showToast('Failed to process bailout: ' + error.message, 'ERROR');
    }
    setLoading(false);
  };

  const bailoutMessages = [
    "I got you this time. Don't ghost me again!",
    "Consider this a loan... with interest,",
    "You're lucky I like you",
    "This is coming out of your birthday present,",
    "One time only! Next time you're on your own",
    "Pay it forward when someone else needs help"
  ];

  const randomMessage = () => {
    setMessage(bailoutMessages[Math.floor(Math.random() * bailoutMessages.length)]);
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ color: '#00e676', marginTop: 0 }}>Aura bailout</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#888', marginBottom: '15px' }}>
            Pay off some of <strong style={{ color: '#fff' }}>{friend.displayName}</strong>'s debt
            to help them avoid bankruptcy.
          </p>

          <div style={{
            background: 'linear-gradient(135deg, #330000 0%, #1a0000 100%)',
            border: '1px solid #ff4444',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#ff8888', marginBottom: '5px' }}>
              {friend.displayName}'s Current Debt
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ff4444' }}>
              {friendStats.totalDebt} APR
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ff6666' }}>
              {friendStats.daysMissed} days ghosted
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              color: '#888', 
              fontSize: '0.75rem', 
              marginBottom: '10px',
              textTransform: 'uppercase'
            }}>
              Bailout Amount
            </label>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
              <input
                type="range"
                min="1"
                max={maxBailout || 1}
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value))}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min="1"
                max={maxBailout || 1}
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                style={{
                  width: '80px',
                  padding: '10px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              />
              <span style={{ color: '#666' }}>APR</span>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 215, 0, 0.05)',
            border: '1px solid #443300',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: '#888'
          }}>
            <strong style={{ color: '#ffd700' }}>Cost to you:</strong>
            <p style={{ margin: '5px 0 0 0' }}>
              This will increase <em>your</em> debt by {Math.ceil(amount * 0.5)} APR
              (50% bailout fee)
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ 
                color: '#888', 
                fontSize: '0.75rem',
                textTransform: 'uppercase'
              }}>
                Optional Message
              </label>
              <button
                onClick={randomMessage}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00e676',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Random
              </button>
            </div>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave a message for your friend..."
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleBailout}
            disabled={loading || amount <= 0}
            style={{
              flex: 1,
              padding: '14px',
              background: loading || amount <= 0 ? '#333' : '#004d40',
              color: loading || amount <= 0 ? '#666' : '#00e676',
              border: '1px solid #00e676',
              borderRadius: '6px',
              cursor: loading || amount <= 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              letterSpacing: '1px'
            }}
          >
            {loading ? 'Processing...' : `BAIL OUT ${amount} APR`}
          </button>
          
          <button
            onClick={onClose}
            style={{
              padding: '14px',
              background: 'transparent',
              color: '#888',
              border: '1px solid #444',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            CANCEL
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
  backgroundColor: 'rgba(0,0,0,0.9)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const modalStyle = {
  background: '#111',
  padding: '30px',
  borderRadius: '12px',
  width: '90%',
  maxWidth: '450px',
  border: '1px solid #333',
  textAlign: 'center'
};

export default BailoutModal;
