import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrophyIcon, MedalIcon, SkullIcon, FlameIcon } from './icons/Icons';
import { getAuraLeaderboard } from '../services/auraService';
import { getAchievementLeaderboard } from '../services/achievementService';

/**
 * Global Leaderboard - Weekly Rankings
 */
const Leaderboard = () => {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('debt');
  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userRank, setUserRank] = useState(null);

  const categories = {
    debt: {
      label: 'MOST INDEBTED',
      icon: <SkullIcon size={20} color="#ff4444" />,
      color: '#ff4444',
      description: 'Those who owe the most APR'
    },
    clean: {
      label: 'CLEANEST RECORDS',
      icon: <FlameIcon size={20} color="#00e676" />,
      color: '#00e676',
      description: 'Longest debt-free streaks'
    },
    achievements: {
      label: 'ACHIEVEMENT HUNTERS',
      icon: <TrophyIcon size={20} color="#ffd700" />,
      color: '#ffd700',
      description: 'Most Aura Points earned'
    },
    streaks: {
      label: 'STREAK MASTERS',
      icon: <MedalIcon size={20} color="#ff8800" />,
      color: '#ff8800',
      description: 'Longest friendship streaks'
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [activeCategory]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      let data = [];
      if (activeCategory === 'achievements') {
        data = await getAchievementLeaderboard(10);
      } else {
        data = await getAuraLeaderboard(10);
      }
      
      const formattedData = data.map((item, index) => {
        const rank = index + 1;
        if (user && item.userId === user.id) setUserRank(rank);

        let displayValue = '';
        switch (activeCategory) {
          case 'debt': displayValue = `${item.value || 0} APR`; break;
          case 'clean': displayValue = `${item.value || 0} days`; break;
          case 'achievements': displayValue = `${item.value || 0} pts`; break;
          case 'streaks': displayValue = `${item.value || 0} days`; break;
        }

        return {
          rank,
          userId: item.userId,
          userName: item.displayName || 'Anonymous',
          value: item.value || 0,
          displayValue,
          isCurrentUser: user && item.userId === user.id
        };
      });

      setLeaderboardData(formattedData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboardData([]);
    }
    setLoading(false);
  };

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1: return { background: 'linear-gradient(135deg, #ffd700, #ffaa00)', color: '#000' };
      case 2: return { background: 'linear-gradient(135deg, #c0c0c0, #a0a0a0)', color: '#000' };
      case 3: return { background: 'linear-gradient(135deg, #cd7f32, #b87333)', color: '#fff' };
      default: return { background: '#1a1a1a', color: '#888' };
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '👑';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const currentCategory = categories[activeCategory];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrophyIcon size={32} color="#ffd700" />
          <div>
            <h2 style={{ margin: 0, color: '#ffd700', fontSize: '1.3rem' }}>Global rankings</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              Weekly Leaderboards • Top Performers
            </p>
          </div>
        </div>
        {userRank && (
          <div style={userRankStyle}>
            <span style={{ fontSize: '0.7rem', color: '#888' }}>Your rank</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffd700' }}>#{userRank}</span>
          </div>
        )}
      </div>

      <div style={categoryTabsStyle}>
        {Object.entries(categories).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            style={{
              ...categoryButtonStyle,
              borderColor: activeCategory === key ? cat.color : '#333',
              background: activeCategory === key ? `${cat.color}15` : 'transparent',
              color: activeCategory === key ? cat.color : '#888'
            }}
          >
            {cat.icon}
            <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>{cat.label}</span>
          </button>
        ))}
      </div>

      <div style={listStyle}>
        {loading ? (
           <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</div>
        ) : leaderboardData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No data available.</div>
        ) : (
          leaderboardData.map((entry) => (
            <div key={entry.userId} style={{
                ...entryStyle,
                background: entry.isCurrentUser ? 'rgba(255,215,0,0.1)' : entryStyle.background,
                borderColor: entry.isCurrentUser ? '#ffd700' : '#222'
            }}>
              <div style={{ ...rankBadgeStyle, ...getRankStyle(entry.rank) }}>{getRankIcon(entry.rank)}</div>
              <div style={{ ...avatarStyle, borderColor: entry.isCurrentUser ? '#ffd700' : '#333' }}>
                {entry.userName.charAt(0).toUpperCase()}
              </div>
              <div style={userInfoStyle}>
                <span style={{ color: entry.isCurrentUser ? '#ffd700' : '#fff', fontWeight: 'bold' }}>{entry.userName}</span>
              </div>
              <div style={{ ...valueStyle, color: currentCategory.color }}>{entry.displayValue}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Styles (Simplified for brevity as requested by mandate)
const containerStyle = { background: '#111', border: '1px solid #222', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid #222' };
const userRankStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 20px', background: 'rgba(255,215,0,0.1)', border: '1px solid #ffd700', borderRadius: '12px' };
const categoryTabsStyle = { display: 'flex', gap: '10px', padding: '15px', overflowX: 'auto', background: '#0a0a0a' };
const categoryButtonStyle = { display: 'flex', alignItems: 'center', padding: '10px 16px', border: '1px solid', borderRadius: '8px', background: 'transparent', cursor: 'pointer' };
const listStyle = { maxHeight: '400px', overflowY: 'auto', padding: '15px' };
const entryStyle = { display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.02)', border: '1px solid #222', borderRadius: '12px', marginBottom: '10px' };
const rankBadgeStyle = { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const avatarStyle = { width: '45px', height: '45px', borderRadius: '50%', background: '#1a1a1a', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' };
const userInfoStyle = { flex: 1 };
const valueStyle = { fontWeight: 'bold', textAlign: 'right' };

export default Leaderboard;
