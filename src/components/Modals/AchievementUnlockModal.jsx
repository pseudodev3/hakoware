import { useEffect, useState } from 'react';
import { RARITY_TIERS } from '../../services/achievementService';

const AchievementUnlockModal = ({ achievement, onClose }) => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (!achievement) return null;

  const rarityStyle = RARITY_TIERS[achievement.rarity];

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div style={{
      ...overlayStyle,
      opacity: visible ? 1 : 0
    }} onClick={handleClose}>
      <div 
        style={{
          ...modalStyle,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(50px)',
          boxShadow: `${rarityStyle.glow}, 0 0 60px rgba(0,0,0,0.8)`
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Glow Effect */}
        <div style={{
          ...glowStyle,
          background: `radial-gradient(circle, ${rarityStyle.color}30 0%, transparent 70%)`
        }} />
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            ...rarityBadgeLargeStyle,
            color: rarityStyle.color,
            borderColor: rarityStyle.color,
            boxShadow: rarityStyle.glow
          }}>
            {rarityStyle.label} UNLOCKED
          </div>
        </div>

        {/* Achievement Icon */}
        <div style={{
          ...iconContainerLargeStyle,
          borderColor: rarityStyle.color,
          boxShadow: `inset 0 0 30px ${rarityStyle.color}30, 0 0 30px ${rarityStyle.color}40`
        }}>
          <span style={{ fontSize: '5rem' }}>{achievement.icon}</span>
        </div>

        {/* Achievement Details */}
        <h2 style={{ 
          textAlign: 'center', 
          margin: '20px 0 10px 0',
          fontSize: '1.8rem',
          color: '#fff',
          textShadow: `0 0 20px ${rarityStyle.color}60`
        }}>
          {achievement.name}
        </h2>
        
        <p style={{ 
          textAlign: 'center', 
          color: '#888', 
          margin: '0 0 20px 0',
          fontSize: '1rem',
          lineHeight: '1.5'
        }}>
          {achievement.description}
        </p>

        {/* Points */}
        <div style={{
          ...pointsContainerStyle,
          background: `${rarityStyle.color}15`,
          borderColor: rarityStyle.color
        }}>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>Aura Points Earned</span>
          <span style={{ 
            color: rarityStyle.color, 
            fontSize: '2rem', 
            fontWeight: 'bold',
            textShadow: `0 0 10px ${rarityStyle.color}60`
          }}>
            +{achievement.points}
          </span>
        </div>

        {/* Confetti effect placeholder - would use canvas in full version */}
        <div style={confettiContainerStyle}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{
              ...confettiPieceStyle,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              background: rarityStyle.color,
              width: `${4 + Math.random() * 6}px`,
              height: `${4 + Math.random() * 6}px`
            }} />
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            ...closeButtonStyle,
            background: rarityStyle.color,
            boxShadow: `0 4px 20px ${rarityStyle.color}50`
          }}
        >
          CLAIM REWARD
        </button>
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
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(5px)',
  transition: 'opacity 0.3s ease'
};

const modalStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #333',
  borderRadius: '24px',
  padding: '40px',
  width: '90%',
  maxWidth: '450px',
  position: 'relative',
  overflow: 'hidden',
  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
};

const glowStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '300px',
  height: '300px',
  borderRadius: '50%',
  pointerEvents: 'none'
};

const rarityBadgeLargeStyle = {
  display: 'inline-block',
  padding: '8px 24px',
  border: '2px solid',
  borderRadius: '30px',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  letterSpacing: '3px',
  textTransform: 'uppercase'
};

const iconContainerLargeStyle = {
  width: '140px',
  height: '140px',
  borderRadius: '50%',
  border: '3px solid',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative'
};

const pointsContainerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '15px 25px',
  border: '1px solid',
  borderRadius: '12px',
  marginBottom: '25px'
};

const closeButtonStyle = {
  width: '100%',
  padding: '16px',
  border: 'none',
  borderRadius: '12px',
  color: '#000',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  transition: 'transform 0.2s, box-shadow 0.2s'
};

const confettiContainerStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  borderRadius: '24px'
};

const confettiPieceStyle = {
  position: 'absolute',
  top: '-10px',
  borderRadius: '2px',
  animation: 'confetti-fall 3s linear infinite',
  opacity: 0.8
};

// Add keyframes once
if (typeof document !== 'undefined' && !document.getElementById('achievement-modal-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'achievement-modal-styles';
  styleSheet.textContent = `
    @keyframes confetti-fall {
      0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default AchievementUnlockModal;
