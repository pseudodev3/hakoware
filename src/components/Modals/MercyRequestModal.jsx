import { useState } from 'react';
import { fileMercyRequest } from '../../services/bankruptcyService';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDebt } from '../../utils/gameLogic';

const MercyRequestModal = ({ isOpen, onClose, friendship, showToast, onRequestComplete }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  const friend = isUser1 ? friendship.user2 : friendship.user1;
  
  const stats = calculateDebt({
    baseDebt: myData.baseDebt,
    lastInteraction: myData.lastInteraction,
    bankruptcyLimit: myData.limit
  });

  const excuses = [
    "I was abducted by aliens and just got back.",
    "My phone fell in the toilet and I was mourning.",
    "I was in a parallel dimension. Time moves differently there.",
    "I was ghosted by my own shadow. Ironic, I know.",
    "My aura was being audited by the IRS.",
    "I swear I meant to text back... 47 times.",
    "I was practicing social distancing... from my phone.",
    "My cat sat on my phone and refused to move. For 3 weeks.",
    "I was busy achieving enlightenment. Obviously failed.",
    "Please have mercy on this bankrupt soul!"
  ];

  const randomExcuse = () => {
    setMessage(excuses[Math.floor(Math.random() * excuses.length)]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const result = await fileMercyRequest(friendship.id, user.uid, message);
    setLoading(false);

    if (result.success) {
      showToast(result.message, 'SUCCESS');
      onRequestComplete();
      onClose();
    } else {
      showToast(result.message || 'Request failed', 'ERROR');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ color: '#ff4444', marginTop: 0 }}>BEG FOR AURA</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a0000 0%, #330000 100%)',
            border: '2px solid #ff4444',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#ff8888', marginBottom: '5px' }}>
              CHAPTER 7 BANKRUPTCY NOTICE
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff4444' }}>
              {stats.totalDebt} APR
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ff6666' }}>
              Days Ghosted: {stats.daysMissed}
            </div>
          </div>

          <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>
            Send a plea to <strong style={{ color: '#fff' }}>{friend.displayName}</strong> 
            asking for mercy and debt forgiveness.
          </p>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ 
                color: '#888', 
                fontSize: '0.75rem',
                textTransform: 'uppercase'
              }}>
                Your Plea
              </label>
              <button
                onClick={randomExcuse}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffd700',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Random Excuse
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain why you deserve mercy..."
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.9rem',
                minHeight: '100px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{
            background: 'rgba(255, 215, 0, 0.05)',
            border: '1px solid #443300',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '0.8rem',
            color: '#888'
          }}>
            <strong style={{ color: '#ffd700' }}>What happens next?</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li>Your creditor will receive your plea</li>
              <li>They can choose to forgive your debt, decline, or set a condition</li>
              <li>If granted, your debt is wiped clean!</li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSubmit}
            disabled={loading || !message.trim()}
            style={{
              flex: 1,
              padding: '14px',
              background: loading || !message.trim() ? '#333' : '#330000',
              color: loading || !message.trim() ? '#666' : '#ff4444',
              border: '1px solid #ff4444',
              borderRadius: '6px',
              cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              letterSpacing: '1px'
            }}
          >
            {loading ? 'Filing...' : 'FILE PETITION'}
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

export default MercyRequestModal;
