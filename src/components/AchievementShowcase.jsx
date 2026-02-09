import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserAchievements, RARITY_TIERS, ACHIEVEMENTS } from '../services/achievementService';
import { TrophyIcon, LockIcon } from './icons/Icons';

const AchievementShowcase = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRarity, setSelectedRarity] = useState('all');

  useEffect(() => {
    loadAchievements();
  }, [user]);

  const loadAchievements = async () => {
    if (!user) return;
    setLoading(true);
    const data = await getUserAchievements(user.uid);
    setUnlockedIds(data.unlockedAchievements.map(a => a.id));
    setTotalPoints(data.totalPoints);
    setAchievements(Object.values(ACHIEVEMENTS));
    setLoading(false);
  };

  const filteredAchievements = selectedRarity === 'all' 
    ? achievements 
    : achievements.filter(a => a.rarity === selectedRarity);

  const unlockedCount = unlockedIds.length;
  const totalCount = achievements.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  const getRarityCount = (rarity) => {
    return achievements.filter(a => a.rarity === rarity && unlockedIds.includes(a.id)).length;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Loading Collection...
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <TrophyIcon size={32} color="#ffd700" />
          <div>
            <h2 style={{ margin: 0, color: '#ffd700', fontSize: '1.3rem' }}>COLLECTION PLAQUES</h2>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '0.8rem' }}>
              {unlockedCount} of {totalCount} Unlocked • {totalPoints} Aura Points
            </p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div style={progressContainerStyle}>
          <div style={{ ...progressBarStyle, width: `${progressPercent}%` }} />
          <span style={progressTextStyle}>{progressPercent}%</span>
        </div>
      </div>

      {/* Rarity Filter */}
      <div style={filterContainerStyle}>
        <button
          style={{ ...filterButtonStyle, ...(selectedRarity === 'all' ? filterActiveStyle : {}) }}
          onClick={() => setSelectedRarity('all')}
        >
          ALL ({unlockedCount})
        </button>
        {Object.entries(RARITY_TIERS).map(([key, tier]) => (
          <button
            key={key}
            style={{ 
              ...filterButtonStyle, 
              color: tier.color,
              borderColor: tier.color,
              ...(selectedRarity === key ? { 
                ...filterActiveStyle, 
                background: `${tier.color}20`,
                boxShadow: tier.glow
              } : {})
            }}
            onClick={() => setSelectedRarity(key)}
          >
            {tier.label} ({getRarityCount(key)})
          </button>
        ))}
      </div>

      {/* Achievement Grid */}
      <div style={gridStyle}>
        {filteredAchievements.map(achievement => {
          const isUnlocked = unlockedIds.includes(achievement.id);
          const rarityStyle = RARITY_TIERS[achievement.rarity];
          
          return (
            <div
              key={achievement.id}
              style={{
                ...cardStyle,
                opacity: isUnlocked ? 1 : 0.5,
                borderColor: isUnlocked ? rarityStyle.color : '#333',
                boxShadow: isUnlocked ? rarityStyle.glow : 'none'
              }}
            >
              {/* Icon */}
              <div style={{
                ...iconContainerStyle,
                background: isUnlocked ? `${rarityStyle.color}15` : '#111',
                borderColor: isUnlocked ? rarityStyle.color : '#222'
              }}>
                <span style={{ fontSize: '2rem' }}>{achievement.icon}</span>
                {!isUnlocked && (
                  <div style={lockOverlayStyle}>
                    <LockIcon size={20} color="#444" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={contentStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{
                    ...rarityBadgeStyle,
                    color: rarityStyle.color,
                    borderColor: rarityStyle.color
                  }}>
                    {rarityStyle.label}
                  </span>
                  <span style={{ color: '#666', fontSize: '0.75rem' }}>
                    +{achievement.points} pts
                  </span>
                </div>
                
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '0.95rem',
                  color: isUnlocked ? '#fff' : '#666'
                }}>
                  {achievement.name}
                </h3>
                
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.8rem', 
                  color: isUnlocked ? '#888' : '#444',
                  lineHeight: '1.4'
                }}>
                  {achievement.description}
                </p>
              </div>

              {/* Unlock Indicator */}
              {isUnlocked && (
                <div style={unlockedIndicatorStyle}>
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #0a0a0a, #111)',
  border: '1px solid #222',
  borderRadius: '16px',
  padding: '25px',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
  paddingBottom: '20px',
  borderBottom: '1px solid #222',
  flexWrap: 'wrap',
  gap: '15px'
};

const progressContainerStyle = {
  position: 'relative',
  width: '150px',
  height: '8px',
  background: '#1a1a1a',
  borderRadius: '4px',
  overflow: 'hidden'
};

const progressBarStyle = {
  height: '100%',
  background: 'linear-gradient(90deg, #ffd700, #ffaa00)',
  borderRadius: '4px',
  transition: 'width 0.5s ease'
};

const progressTextStyle = {
  position: 'absolute',
  right: '0',
  top: '-18px',
  fontSize: '0.75rem',
  color: '#ffd700',
  fontWeight: 'bold'
};

const filterContainerStyle = {
  display: 'flex',
  gap: '10px',
  marginBottom: '20px',
  flexWrap: 'wrap'
};

const filterButtonStyle = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: '20px',
  color: '#888',
  fontSize: '0.8rem',
  cursor: 'pointer',
  transition: 'all 0.2s',
  textTransform: 'uppercase',
  letterSpacing: '1px'
};

const filterActiveStyle = {
  background: '#333',
  color: '#fff',
  borderColor: '#666'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '15px'
};

const cardStyle = {
  background: 'rgba(17, 17, 17, 0.8)',
  border: '1px solid #333',
  borderRadius: '12px',
  padding: '15px',
  display: 'flex',
  gap: '15px',
  position: 'relative',
  transition: 'all 0.3s ease',
  backdropFilter: 'blur(10px)'
};

const iconContainerStyle = {
  width: '60px',
  height: '60px',
  borderRadius: '12px',
  border: '1px solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  position: 'relative'
};

const lockOverlayStyle = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const contentStyle = {
  flex: 1,
  minWidth: 0
};

const rarityBadgeStyle = {
  fontSize: '0.65rem',
  padding: '2px 8px',
  border: '1px solid',
  borderRadius: '4px',
  fontWeight: 'bold',
  letterSpacing: '1px'
};

const unlockedIndicatorStyle = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  width: '20px',
  height: '20px',
  background: '#00e676',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#000',
  fontSize: '0.7rem',
  fontWeight: 'bold'
};

export default AchievementShowcase;
