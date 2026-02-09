import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SkullIcon, ZapIcon, DollarIcon, RefreshIcon } from '../icons/Icons';

const DebtRouletteModal = ({ isOpen, onClose, friendship, showToast, onRouletteComplete }) => {
  const { user } = useAuth();
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const wheelRef = useRef(null);

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  const currentDebt = myData.baseDebt || 0;

  const outcomes = [
    { type: 'win', label: 'DEBT HALVED', value: 0.5, color: '#00e676', icon: '✨', chance: 15 },
    { type: 'win', label: '-5 APR', value: -5, color: '#00e676', icon: '🎉', chance: 20 },
    { type: 'neutral', label: 'NO CHANGE', value: 0, color: '#888', icon: '😐', chance: 25 },
    { type: 'lose', label: '+3 APR', value: 3, color: '#ff8800', icon: '😰', chance: 25 },
    { type: 'lose', label: 'DEBT DOUBLED', value: 2, color: '#ff4444', icon: '💀', chance: 15 },
  ];

  const spinWheel = async () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    setResult(null);
    
    // Random outcome based on weighted chances
    const random = Math.random() * 100;
    let cumulative = 0;
    let selectedOutcome = outcomes[2]; // default neutral
    
    for (const outcome of outcomes) {
      cumulative += outcome.chance;
      if (random <= cumulative) {
        selectedOutcome = outcome;
        break;
      }
    }
    
    // Calculate rotation (minimum 3 full spins + random position)
    const spinDegrees = 1080 + Math.floor(Math.random() * 360);
    setWheelRotation(prev => prev + spinDegrees);
    
    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setResult(selectedOutcome);
    setIsSpinning(false);
    
    // Apply result
    let newDebt = currentDebt;
    if (selectedOutcome.type === 'win') {
      if (selectedOutcome.label === 'DEBT HALVED') {
        newDebt = Math.floor(currentDebt * 0.5);
      } else {
        newDebt = Math.max(0, currentDebt + selectedOutcome.value);
      }
    } else if (selectedOutcome.type === 'lose') {
      if (selectedOutcome.label === 'DEBT DOUBLED') {
        newDebt = currentDebt * 2;
      } else {
        newDebt = currentDebt + selectedOutcome.value;
      }
    }
    
    // Show result toast
    const message = selectedOutcome.type === 'win' 
      ? `ROULETTE WIN! ${selectedOutcome.label}` 
      : selectedOutcome.type === 'lose'
      ? `ROULETTE LOSS! ${selectedOutcome.label}`
      : 'ROULETTE: No change';
    
    showToast(message, selectedOutcome.type === 'win' ? 'SUCCESS' : selectedOutcome.type === 'lose' ? 'ERROR' : 'INFO');
    
    if (selectedOutcome.type !== 'neutral') {
      onRouletteComplete?.(newDebt);
    }
  };

  const getResultMessage = () => {
    if (!result) return null;
    const messages = {
      'DEBT HALVED': 'Lady Luck is on your side!',
      '-5 APR': 'A small win is still a win!',
      'NO CHANGE': 'Could be worse...',
      '+3 APR': 'The house always wins...',
      'DEBT DOUBLED': 'Toritaten is laughing at you.'
    };
    return messages[result.label] || '';
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={iconContainerStyle}>
            <RefreshIcon size={32} color="#ff00ff" />
          </div>
          <h2 style={{ margin: '10px 0 5px 0', color: '#ff00ff' }}>DEBT ROULETTE</h2>
          <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>
            Risk it all for a chance at freedom
          </p>
        </div>

        {/* Current Debt Display */}
        <div style={debtDisplayStyle}>
          <span style={{ color: '#666', fontSize: '0.75rem' }}>CURRENT DEBT</span>
          <span style={{ color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
            {currentDebt} APR
          </span>
        </div>

        {/* Roulette Wheel */}
        <div style={wheelContainerStyle}>
          <div 
            ref={wheelRef}
            style={{
              ...wheelStyle,
              transform: `rotate(${wheelRotation}deg)`
            }}
          >
            {outcomes.map((outcome, index) => (
              <div
                key={outcome.label}
                style={{
                  ...wheelSegmentStyle,
                  background: outcome.color,
                  transform: `rotate(${index * (360 / outcomes.length)}deg)`,
                }}
              >
                <span style={segmentTextStyle}>{outcome.icon}</span>
              </div>
            ))}
          </div>
          <div style={wheelPointerStyle}>▼</div>
        </div>

        {/* Result Display */}
        {result && (
          <div style={{
            ...resultContainerStyle,
            borderColor: result.color,
            background: `${result.color}10`
          }}>
            <span style={{ fontSize: '2rem' }}>{result.icon}</span>
            <div>
              <div style={{ color: result.color, fontWeight: 'bold', fontSize: '1.1rem' }}>
                {result.label}
              </div>
              <div style={{ color: '#888', fontSize: '0.8rem' }}>
                {getResultMessage()}
              </div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div style={warningStyle}>
          <SkullIcon size={16} color="#ff4444" />
          <span style={{ fontSize: '0.75rem', color: '#888' }}>
            Warning: You can lose everything. Or gain everything. That's the point.
          </span>
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          <button
            onClick={spinWheel}
            disabled={isSpinning || currentDebt === 0}
            style={{
              ...spinButtonStyle,
              opacity: isSpinning || currentDebt === 0 ? 0.5 : 1
            }}
          >
            {isSpinning ? 'SPINNING...' : currentDebt === 0 ? 'NO DEBT TO RISK' : 'SPIN THE WHEEL'}
          </button>
          <button onClick={onClose} style={cancelButtonStyle}>
            CHICKEN OUT
          </button>
        </div>

        {/* Odds */}
        <div style={oddsStyle}>
          {outcomes.map(outcome => (
            <div key={outcome.label} style={oddItemStyle}>
              <span style={{ fontSize: '1rem' }}>{outcome.icon}</span>
              <span style={{ fontSize: '0.65rem', color: '#666' }}>{outcome.chance}%</span>
            </div>
          ))}
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
  maxWidth: '400px',
  textAlign: 'center'
};

const headerStyle = {
  marginBottom: '20px'
};

const iconContainerStyle = {
  width: '70px',
  height: '70px',
  borderRadius: '50%',
  background: 'rgba(255,0,255,0.1)',
  border: '2px solid #ff00ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
  boxShadow: '0 0 30px rgba(255,0,255,0.2)',
  animation: 'spin-slow 4s linear infinite'
};

const debtDisplayStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  padding: '15px',
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '10px',
  marginBottom: '20px'
};

const wheelContainerStyle = {
  position: 'relative',
  width: '250px',
  height: '250px',
  margin: '0 auto 20px'
};

const wheelStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  position: 'relative',
  transition: 'transform 3s cubic-bezier(0.23, 1, 0.32, 1)',
  border: '4px solid #333',
  overflow: 'hidden'
};

const wheelSegmentStyle = {
  position: 'absolute',
  width: '50%',
  height: '50%',
  transformOrigin: '100% 100%',
  clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const segmentTextStyle = {
  fontSize: '1.5rem',
  position: 'absolute',
  bottom: '20%',
  right: '20%',
  transform: 'rotate(-45deg)'
};

const wheelPointerStyle = {
  position: 'absolute',
  top: '-15px',
  left: '50%',
  transform: 'translateX(-50%)',
  fontSize: '1.5rem',
  color: '#ffd700',
  textShadow: '0 0 10px rgba(255,215,0,0.5)',
  zIndex: 10
};

const resultContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '15px',
  border: '1px solid',
  borderRadius: '12px',
  marginBottom: '15px',
  textAlign: 'left'
};

const warningStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px',
  background: 'rgba(255,68,68,0.1)',
  border: '1px solid rgba(255,68,68,0.2)',
  borderRadius: '8px',
  marginBottom: '15px'
};

const actionsStyle = {
  display: 'flex',
  gap: '10px',
  marginBottom: '15px'
};

const spinButtonStyle = {
  flex: 1,
  padding: '16px',
  background: 'linear-gradient(135deg, #ff00ff, #aa00aa)',
  border: 'none',
  borderRadius: '10px',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  cursor: 'pointer',
  letterSpacing: '1px',
  boxShadow: '0 4px 20px rgba(255,0,255,0.3)'
};

const cancelButtonStyle = {
  padding: '16px 20px',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: '10px',
  color: '#666',
  cursor: 'pointer',
  fontSize: '0.8rem'
};

const oddsStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: '15px'
};

const oddItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px'
};

export default DebtRouletteModal;
