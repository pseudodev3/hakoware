import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CrownIcon, ShareIcon, FlameIcon } from '../icons/Icons';

const FlexModal = ({ isOpen, onClose, friendship, showToast, onFlexComplete }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFlex, setSelectedFlex] = useState(null);

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const friend = isUser1 ? friendship.user2 : friendship.user1;
  const streak = friendship.streak || 0;

  const flexOptions = [
    { id: 'clean', icon: '✨', text: 'Debt Free & Thriving', color: '#00e676' },
    { id: 'streak', icon: '🔥', text: `${streak} Day Streak!`, color: '#ff8800' },
    { id: 'ghost', icon: '👻', text: 'Un-ghostable', color: '#33b5e5' },
    { id: 'king', icon: '👑', text: 'Friendship King/Queen', color: '#ffd700' },
  ];

  const handleFlex = async () => {
    if (!selectedFlex) {
      showToast('Select a flex style first!', 'ERROR');
      return;
    }

    setLoading(true);
    
    // Simulate API call - in real app, this would post to a feed
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const flexType = flexOptions.find(f => f.id === selectedFlex);
    showToast(`Flexed on ${friend.displayName}! ${flexType.text}`, 'SUCCESS');
    
    onFlexComplete?.();
    onClose();
    setLoading(false);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={crownContainerStyle}>
            <CrownIcon size={40} color="#ffd700" />
          </div>
          <h2 style={{ margin: '15px 0 5px 0', color: '#ffd700' }}>FLEX STATUS</h2>
          <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
            You're debt free! Time to celebrate.
          </p>
        </div>

        {/* Flex Options */}
        <div style={optionsGridStyle}>
          {flexOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedFlex(option.id)}
              style={{
                ...optionButtonStyle,
                borderColor: selectedFlex === option.id ? option.color : '#333',
                background: selectedFlex === option.id ? `${option.color}15` : 'rgba(0,0,0,0.3)',
                boxShadow: selectedFlex === option.id ? `0 0 20px ${option.color}30` : 'none'
              }}
            >
              <span style={{ fontSize: '2rem' }}>{option.icon}</span>
              <span style={{ 
                color: selectedFlex === option.id ? option.color : '#888',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}>
                {option.text}
              </span>
            </button>
          ))}
        </div>

        {/* Custom Message */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#666', fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase' }}>
            Add a message (optional)
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Rub it in ${friend.displayName}'s face...`}
            style={inputStyle}
          />
        </div>

        {/* Stats Preview */}
        <div style={statsPreviewStyle}>
          <div style={statItemStyle}>
            <FlameIcon size={16} color="#ff8800" />
            <span style={{ color: '#ff8800', fontWeight: 'bold' }}>{streak}</span>
            <span style={{ color: '#666', fontSize: '0.7rem' }}>Day Streak</span>
          </div>
          <div style={{ width: '1px', height: '30px', background: '#333' }} />
          <div style={statItemStyle}>
            <span style={{ fontSize: '1.2rem' }}>0</span>
            <span style={{ color: '#00e676', fontSize: '0.7rem' }}>APR Debt</span>
          </div>
          <div style={{ width: '1px', height: '30px', background: '#333' }} />
          <div style={statItemStyle}>
            <span style={{ fontSize: '1.2rem' }}>💎</span>
            <span style={{ color: '#888', fontSize: '0.7rem' }}>Clean Record</span>
          </div>
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          <button
            onClick={handleFlex}
            disabled={loading || !selectedFlex}
            style={{
              ...flexButtonStyle,
              opacity: loading || !selectedFlex ? 0.5 : 1
            }}
          >
            {loading ? 'FLEXING...' : 'FLEX ON THEM'}
          </button>
          <button onClick={onClose} style={cancelButtonStyle}>
            Stay Humble
          </button>
        </div>

        {/* Tip */}
        <p style={{ margin: '15px 0 0 0', color: '#444', fontSize: '0.7rem', textAlign: 'center' }}>
          💡 Flexing increases your social standing but may attract jealousy.
        </p>
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
  background: 'rgba(0,0,0,0.9)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(5px)'
};

const modalStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #333',
  borderRadius: '20px',
  padding: '30px',
  width: '90%',
  maxWidth: '450px',
  textAlign: 'center'
};

const headerStyle = {
  marginBottom: '25px'
};

const crownContainerStyle = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  background: 'linear-gradient(145deg, rgba(255,215,0,0.1), rgba(255,215,0,0.05))',
  border: '2px solid #ffd700',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
  boxShadow: '0 0 30px rgba(255,215,0,0.2)'
};

const optionsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '10px',
  marginBottom: '20px'
};

const optionButtonStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  padding: '15px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid #333',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9rem',
  boxSizing: 'border-box'
};

const statsPreviewStyle = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: '15px',
  background: 'rgba(0,0,0,0.2)',
  borderRadius: '12px',
  marginBottom: '20px'
};

const statItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px'
};

const actionsStyle = {
  display: 'flex',
  gap: '10px'
};

const flexButtonStyle = {
  flex: 1,
  padding: '16px',
  background: 'linear-gradient(135deg, #332200, #1a0f00)',
  border: '1px solid #ff8800',
  borderRadius: '10px',
  color: '#ff8800',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  cursor: 'pointer',
  letterSpacing: '1px'
};

const cancelButtonStyle = {
  padding: '16px 24px',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: '10px',
  color: '#666',
  cursor: 'pointer'
};

export default FlexModal;
