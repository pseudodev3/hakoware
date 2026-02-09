/**
 * Empty State Component
 * Beautiful zero-data experiences
 */

const EmptyState = ({ 
  icon,
  title,
  description,
  action,
  actionLabel,
  compact = false
}) => {
  const handleAction = () => {
    if (action === 'add-friend') {
      // Dispatch custom event that App.jsx listens for
      window.dispatchEvent(new CustomEvent('hakoware:addFriend'));
    }
  };

  if (compact) {
    return (
      <div style={compactContainerStyle}>
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{icon}</div>
        <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>{title}</p>
        {action && (
          <button onClick={handleAction} style={compactActionStyle}>
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={iconContainerStyle}>
        <span style={{ fontSize: '3.5rem' }}>{icon}</span>
        <div style={glowStyle} />
      </div>
      
      <h3 style={titleStyle}>{title}</h3>
      <p style={descriptionStyle}>{description}</p>
      
      {action && (
        <button 
          onClick={handleAction}
          style={actionButtonStyle}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 10px 20px rgba(255,215,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// Pre-built empty states
export const EmptyFriends = () => (
  <EmptyState
    icon="👥"
    title="Start your journey"
    description="Add a friend to begin your accountability partnership. Stay connected, or face the consequences."
    action="add-friend"
    actionLabel="Add your first friend"
  />
);

export const EmptyBounties = ({ onCreate }) => (
  <EmptyState
    icon="🎯"
    title="No active bounties"
    description="Be the first to put a price on someone's head. Place a bounty on a ghosting friend."
    action={onCreate}
    actionLabel="Create Bounty"
  />
);

export const EmptyAchievements = () => (
  <EmptyState
    icon="🏆"
    title="Collection is empty"
    description="Complete actions to unlock achievement plaques. Go bankrupt, maintain streaks, help friends."
  />
);

export const EmptyShame = () => (
  <EmptyState
    icon="✨"
    title="No bankruptcies!"
    description="Everyone is being a good friend for once. The Wall of Shame awaits its next victim..."
  />
);

export const EmptyChallenges = () => (
  <EmptyState
    icon="⚔️"
    title="No active challenges"
    description="Challenge a friend to a friendly competition. Clean streak battles, check-in marathons, and more."
  />
);

// Styles
const containerStyle = {
  textAlign: 'center',
  padding: '50px 30px',
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px dashed #333',
  borderRadius: '16px'
};

const compactContainerStyle = {
  textAlign: 'center',
  padding: '30px 20px'
};

const iconContainerStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '20px'
};

const glowStyle = {
  position: 'absolute',
  inset: '-10px',
  background: 'radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%)',
  borderRadius: '50%',
  animation: 'pulse-glow 3s ease-in-out infinite'
};

const titleStyle = {
  margin: '0 0 10px 0',
  color: '#fff',
  fontSize: '1.1rem',
  fontWeight: 600
};

const descriptionStyle = {
  margin: '0 0 25px 0',
  color: '#666',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  maxWidth: '350px',
  marginLeft: 'auto',
  marginRight: 'auto'
};

const actionButtonStyle = {
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
  border: 'none',
  borderRadius: '8px',
  color: '#000',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const compactActionStyle = {
  marginTop: '10px',
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: '6px',
  color: '#888',
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

// Add glow animation
if (typeof document !== 'undefined' && !document.getElementById('empty-state-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'empty-state-styles';
  styleSheet.textContent = `
    @keyframes pulse-glow {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default EmptyState;
