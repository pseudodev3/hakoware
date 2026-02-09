import { useState } from 'react';
import { calculateDebt, calculateCreditScore, getDebtStatus } from '../utils/gameLogic';
import CountUp from './CountUp';
import { SkullIcon, CrownIcon, FlameIcon, SettingsIcon, MicIcon, AlertIcon, RouletteIcon } from './icons/Icons';

const NenCard = ({ 
  contract, 
  friendship,
  currentUserId,
  index, 
  isAdmin, 
  onAction, 
  onPoke 
}) => {
  // Support both old "contract" format and new "friendship" format
  let displayName, email, streak;
  let myData, friendData, friend;
  let myStats, friendStats;
  let iAmBankrupt, iAmClean, iAmInWarningZone, friendIsBankrupt;

  if (friendship && currentUserId) {
    // New friendship format
    const isUser1 = friendship.myPerspective === 'user1';
    myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    friendData = isUser1 ? friendship.user2Perspective : friendship.user1Perspective;
    friend = isUser1 ? friendship.user2 : friendship.user1;
    
    displayName = friend.displayName;
    email = friend.email;
    streak = friendship.streak || 0;

    // Calculate MY debt (what I owe to this friend)
    myStats = calculateDebt({
      baseDebt: myData.baseDebt,
      lastInteraction: myData.lastInteraction,
      bankruptcyLimit: myData.limit
    });
    
    // Calculate FRIEND's debt (what they owe to me)
    friendStats = calculateDebt({
      baseDebt: friendData.baseDebt,
      lastInteraction: friendData.lastInteraction,
      bankruptcyLimit: friendData.limit
    });
    
    iAmBankrupt = myStats.isBankrupt;
    iAmClean = myStats.totalDebt === 0;
    iAmInWarningZone = myStats.isInWarningZone;
    friendIsBankrupt = friendStats.isBankrupt;
  } else {
    // Old contract format (fallback)
    myStats = calculateDebt(contract);
    iAmBankrupt = myStats.isBankrupt;
    iAmClean = myStats.totalDebt === 0;
    iAmInWarningZone = myStats.isInWarningZone;
    friendIsBankrupt = false;
    displayName = contract.name;
    email = contract.email;
    streak = 0;
    myData = { baseDebt: contract.baseDebt || 0, limit: contract.bankruptcyLimit || 7 };
    friendData = null;
    friendStats = { totalDebt: 0 };
  }
  
  // Ranking Logic - Top 3 non-bankrupt, non-clean get medals
  let rankMedal = null;
  if (!iAmClean && !iAmBankrupt) {
    if (index === 0) rankMedal = '🥇';
    else if (index === 1) rankMedal = '🥈';
    else if (index === 2) rankMedal = '🥉';
  }

  // Status Configuration - Simplified palette
  const statusConfig = {
    bankrupt: {
      icon: <SkullIcon size={28} color="#ff4444" />,
      bg: 'linear-gradient(145deg, rgba(255,68,68,0.08), rgba(20,10,10,1))',
      border: 'transparent',
      glow: '0 4px 20px rgba(255,68,68,0.15)',
      badge: 'Bankrupt',
      badgeColor: '#ff4444'
    },
    clean: {
      icon: <CrownIcon size={28} color="#ffd700" />,
      bg: 'linear-gradient(145deg, rgba(255,215,0,0.08), rgba(20,20,10,1))',
      border: 'transparent',
      glow: '0 4px 20px rgba(255,215,0,0.15)',
      badge: 'Clean',
      badgeColor: '#ffd700'
    },
    warning: {
      icon: <AlertIcon size={28} color="#ff8800" />,
      bg: 'linear-gradient(145deg, rgba(255,136,0,0.08), rgba(20,15,10,1))',
      border: 'transparent',
      glow: '0 4px 20px rgba(255,136,0,0.15)',
      badge: 'Warning',
      badgeColor: '#ff8800'
    },
    active: {
      icon: <FlameIcon size={28} color="#666" />,
      bg: 'linear-gradient(145deg, #151515, #0d0d0d)',
      border: 'transparent',
      glow: '0 2px 8px rgba(0,0,0,0.4)',
      badge: 'Active',
      badgeColor: '#666'
    }
  };

  const currentStatus = iAmBankrupt ? 'bankrupt' : iAmClean ? 'clean' : iAmInWarningZone ? 'warning' : 'active';
  const config = statusConfig[currentStatus];

  // Button Logic - Sentence case, simplified colors
  let btnText = "Check in";
  let btnStyle = { background: '#1a1a1a', color: '#fff' };
  let actionType = 'CHECKIN';

  if (iAmClean) {
    btnText = "Flex status";
    btnStyle = { background: 'rgba(255,215,0,0.15)', color: '#ffd700' };
    actionType = 'FLEX';
  } else if (iAmBankrupt) {
    btnText = "Beg for mercy";
    btnStyle = { background: 'rgba(255,68,68,0.15)', color: '#ff4444' };
    actionType = 'BEG';
  } else if (iAmInWarningZone) {
    btnText = "Check in now";
    btnStyle = { background: 'rgba(255,136,0,0.15)', color: '#ff8800' };
  }

  const data = friendship || contract;
  const auraScore = calculateCreditScore(myStats.totalDebt, myStats.daysMissed);

  return (
    <div style={{
      ...cardContainerStyle,
      background: config.bg,
      borderColor: config.border,
      boxShadow: config.glow
    }}>
      {/* Header Row */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Avatar Placeholder */}
          <div style={{
            ...avatarStyle,
            borderColor: config.border,
            boxShadow: config.glow
          }}>
            <span style={{ fontSize: '1.2rem' }}>
              {displayName?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                {displayName}
              </h3>
              {rankMedal && <span style={{ fontSize: '1.2rem' }}>{rankMedal}</span>}
            </div>
            {isAdmin && (
              <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '2px' }}>
                {email}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status Badge */}
          <span style={{
            ...badgeStyle,
            color: config.badgeColor,
            borderColor: config.badgeColor,
            background: `${config.badgeColor}15`
          }}>
            {config.badge}
          </span>
          
          {/* Settings */}
          {!isAdmin && (
            <button
              onClick={() => onAction('SETTINGS', data)}
              style={iconButtonStyle}
              title="Settings"
            >
              <SettingsIcon size={16} color="#666" />
            </button>
          )}
        </div>
      </div>

      {/* Main Debt Display */}
      <div style={mainDebtContainerStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
          <CountUp end={myStats.totalDebt} duration={2000} />
          <span style={{ fontSize: '1rem', color: '#666', fontWeight: 'normal' }}>APR</span>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
            You owe {displayName}
          </span>
        </div>

        {/* Status Message */}
        {iAmBankrupt && (
          <div style={{ ...statusMessageStyle, color: '#ff4444', background: 'rgba(255,68,68,0.08)' }}>
            <SkullIcon size={14} color="#ff4444" />
            <span>Chapter 7 bankruptcy</span>
          </div>
        )}
        {iAmInWarningZone && !iAmBankrupt && (
          <div style={{ ...statusMessageStyle, color: '#ff8800', background: 'rgba(255,136,0,0.08)' }}>
            <AlertIcon size={14} color="#ff8800" />
            <span>{myStats.daysUntilBankrupt} days until bankruptcy</span>
          </div>
        )}
        {iAmClean && (
          <div style={{ ...statusMessageStyle, color: '#ffd700', background: 'rgba(255,215,0,0.08)' }}>
            <CrownIcon size={14} color="#ffd700" />
            <span>Debt free champion</span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div style={statsRowStyle}>
        {/* Aura Score */}
        <div style={statBoxStyle}>
          <span style={statLabelStyle}>Aura</span>
          <span style={{ 
            ...statValueStyle, 
            color: auraScore > 700 ? '#00e676' : auraScore > 500 ? '#ffd700' : '#ff4444'
          }}>
            {auraScore}
          </span>
        </div>
        
        <div style={statDividerStyle} />
        
        {/* Limit */}
        <div style={statBoxStyle}>
          <span style={statLabelStyle}>Limit</span>
          <span style={statValueStyle}>{myData.limit}d</span>
        </div>
        
        <div style={statDividerStyle} />
        
        {/* Streak */}
        <div style={statBoxStyle}>
          <span style={statLabelStyle}>Streak</span>
          <span style={{ ...statValueStyle, color: streak > 0 ? '#ffd700' : '#666' }}>
            {streak > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FlameIcon size={12} color="#ff8800" />
                {streak}
              </span>
            ) : (
              streak
            )}
          </span>
        </div>
      </div>

      {/* Friend's Debt (if they owe you) */}
      {friendData && friendStats.totalDebt > 0 && (
        <div style={{
          ...friendDebtContainerStyle,
          borderColor: friendIsBankrupt ? '#ff4444' : '#00e676'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>
              {displayName} owes you
            </span>
            {friendIsBankrupt && (
              <span style={{ fontSize: '0.65rem', color: '#ff4444', background: 'rgba(255,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                BANKRUPT
              </span>
            )}
          </div>
          <div style={{ 
            fontSize: '1.3rem', 
            fontWeight: 'bold',
            color: friendIsBankrupt ? '#ff4444' : '#00e676'
          }}>
            {friendStats.totalDebt} <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>APR</span>
          </div>
        </div>
      )}

      {/* Progress Bar - Shows how close to bankruptcy */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ 
          height: '4px', 
          background: '#1a1a1a', 
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (myStats.totalDebt / (Math.max(1, myData.limit) * 2)) * 100)}%`,
            background: iAmBankrupt ? '#ff4444' : iAmInWarningZone ? '#ff8800' : iAmClean ? '#00e676' : '#ffd700',
            borderRadius: '2px',
            transition: 'width 1s ease'
          }} />
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '6px',
          fontSize: '0.65rem',
          color: '#555'
        }}>
          <span>0 APR</span>
          <span>Bankruptcy at {myData.limit * 2} APR</span>
        </div>
      </div>

      {/* Action Buttons */}
      {isAdmin ? (
        <div style={buttonRowStyle}>
          <button 
            style={{ ...adminButtonStyle, flex: 1, background: '#333' }}
            onClick={() => onAction('SHAME', data)}
          >
            SHAME
          </button>
          <button 
            style={{ ...adminButtonStyle, flex: 2, background: '#444' }}
            onClick={() => onAction('RESET', data)}
          >
            WE SPOKE
          </button>
        </div>
      ) : (
        <div style={buttonRowStyle}>
          {/* Main Action - Always visible */}
          <ActionButton 
            style={{
              background: btnStyle.background,
              color: btnStyle.color,
              borderColor: btnStyle.borderColor,
              flex: 1.5
            }}
            onClick={() => onAction(actionType, data)}
            label={btnText}
          />
          
          {/* Bailout - If friend has debt */}
          {friendData && friendStats.totalDebt > 0 && (
            <ActionButton 
              style={{
                flex: 1,
                background: friendIsBankrupt ? 'rgba(255,68,68,0.1)' : 'rgba(0,230,118,0.1)',
                color: friendIsBankrupt ? '#ff4444' : '#00e676',
                borderColor: friendIsBankrupt ? '#ff4444' : '#00e676'
              }}
              onClick={() => onAction('BAILOUT', data)}
              label={friendIsBankrupt ? 'BAILOUT' : 'HELP'}
            />
          )}
          
          {/* Icon Buttons Group */}
          <div style={iconButtonGroupStyle}>
            {/* Voice Check-in */}
            {actionType === 'CHECKIN' && (
              <IconButton 
                onClick={() => onAction('VOICE_CHECKIN', data)}
                icon={<MicIcon size={18} color="#888" />}
                borderColor="#444"
                title="Voice Check-in"
              />
            )}
            
            {/* Debt Roulette - show when in debt but not bankrupt */}
            {myStats.totalDebt > 0 && !iAmBankrupt && (
              <IconButton 
                onClick={() => onAction('ROULETTE', data)}
                icon={<RouletteIcon size={18} color="#ff00ff" />}
                borderColor="#ff00ff"
                bgColor="rgba(255,0,255,0.1)"
                title="Debt Roulette"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Styles - Cleaner design with shadows instead of borders
const cardContainerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  borderRadius: '16px',
  padding: '20px',
  position: 'relative',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
  }
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '15px',
  paddingBottom: '15px',
  borderBottom: '1px solid rgba(255,255,255,0.05)'
};

const avatarStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: 'linear-gradient(145deg, #1a1a1a, #0d0d0d)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontWeight: '600',
  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
};

const badgeStyle = {
  fontSize: '0.65rem',
  padding: '4px 12px',
  borderRadius: '20px',
  fontWeight: '500',
  letterSpacing: '0.5px',
  background: 'rgba(255,255,255,0.05)'
};

const iconButtonStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '8px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
  ':hover': {
    background: 'rgba(255,255,255,0.05)'
  }
};

const mainDebtContainerStyle = {
  textAlign: 'center',
  padding: '24px 20px',
  background: 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1))',
  borderRadius: '12px',
  marginBottom: '16px',
  fontSize: '3rem',
  fontWeight: '700',
  color: '#fff'
};

const statusMessageStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '20px',
  fontSize: '0.7rem',
  fontWeight: 'bold',
  marginTop: '10px'
};

const statsRowStyle = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: '12px 16px',
  background: 'linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.15))',
  borderRadius: '10px',
  marginBottom: '16px'
};

const statBoxStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px'
};

const statLabelStyle = {
  fontSize: '0.6rem',
  color: '#666',
  letterSpacing: '1.5px',
  fontWeight: 'bold'
};

const statValueStyle = {
  fontSize: '1rem',
  fontWeight: 'bold',
  color: '#fff'
};

const statDividerStyle = {
  width: '1px',
  height: '25px',
  background: 'rgba(255,255,255,0.1)'
};

const friendDebtContainerStyle = {
  padding: '12px',
  background: 'rgba(0,0,0,0.15)',
  border: '1px solid',
  borderRadius: '10px',
  marginBottom: '15px'
};

const buttonRowStyle = {
  display: 'flex',
  gap: '8px',
  alignItems: 'stretch'
};

const iconButtonGroupStyle = {
  display: 'flex',
  gap: '6px'
};

const actionButtonStyle = {
  padding: '12px 16px',
  border: '1px solid',
  borderRadius: '10px',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  transition: 'all 0.15s ease',
  fontFamily: 'inherit',
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
  },
  ':active': {
    transform: 'translateY(0)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  }
};

const iconActionButtonStyle = {
  padding: '12px',
  border: '1px solid',
  borderRadius: '10px',
  background: '#1a1a1a',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  ':hover': {
    transform: 'scale(1.05)',
    background: '#222'
  },
  ':active': {
    transform: 'scale(0.95)'
  }
};

const adminButtonStyle = {
  padding: '10px',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontFamily: 'inherit'
};

// Interactive Button Components with hover states
const ActionButton = ({ style, onClick, label }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      style={{
        ...actionButtonStyle,
        ...style,
        transform: isPressed ? 'translateY(0)' : isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isPressed 
          ? '0 2px 4px rgba(0,0,0,0.2)' 
          : isHovered 
            ? '0 4px 12px rgba(0,0,0,0.4)' 
            : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

const IconButton = ({ onClick, icon, borderColor, bgColor = '#1a1a1a', title }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      style={{
        ...iconActionButtonStyle,
        borderColor,
        background: isHovered ? '#222' : bgColor,
        transform: isPressed ? 'scale(0.95)' : isHovered ? 'scale(1.05)' : 'scale(1)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  );
};

export default NenCard;
