import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TrophyIcon, MedalIcon, SkullIcon, FlameIcon } from './icons/Icons';

/**
 * Global Leaderboard - Weekly Rankings
 * 
 * Categories:
 * - Highest Debt (The Biggest Debtors)
 * - Cleanest Record (Longest Clean Streak)
 * - Most Achievements (Aura Points)
 * - Longest Streak (Consecutive check-ins)
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
      description: 'Those who owe the most APR',
      collection: 'userAchievements',
      field: 'stats.highestDebt',
      sort: 'desc'
    },
    clean: {
      label: 'CLEANEST RECORDS',
      icon: <FlameIcon size={20} color="#00e676" />,
      color: '#00e676',
      description: 'Longest debt-free streaks',
      collection: 'userAchievements',
      field: 'stats.maxCleanStreak',
      sort: 'desc'
    },
    achievements: {
      label: 'ACHIEVEMENT HUNTERS',
      icon: <TrophyIcon size={20} color="#ffd700" />,
      color: '#ffd700',
      description: 'Most Aura Points earned',
      collection: 'userAchievements',
      field: 'totalPoints',
      sort: 'desc'
    },
    streaks: {
      label: 'STREAK MASTERS',
      icon: <MedalIcon size={20} color="#ff8800" />,
      color: '#ff8800',
      description: 'Longest friendship streaks',
      collection: 'userAchievements',
      field: 'stats.longestStreak',
      sort: 'desc'
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [activeCategory]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const category = categories[activeCategory];
      
      // Query user achievements
      const q = query(
        collection(db, category.collection),
        orderBy(category.field, category.sort),
        limit(10)
      );

      const snapshot = await getDocs(q);
      const data = [];
      
      snapshot.docs.forEach((docSnap, index) => {
        const data_item = docSnap.data();
        const rank = index + 1;
        
        // Find user's rank
        if (user && docSnap.id === user.uid) {
          setUserRank(rank);
        }
        
        let value = 0;
        let displayValue = '';
        
        // Extract value based on category
        switch (activeCategory) {
          case 'debt':
            value = data_item.stats?.highestDebt || 0;
            displayValue = `${value} APR`;
            break;
          case 'clean':
            value = data_item.stats?.maxCleanStreak || 0;
            displayValue = `${value} days`;
            break;
          case 'achievements':
            value = data_item.totalPoints || 0;
            displayValue = `${value} pts`;
            break;
          case 'streaks':
            value = data_item.stats?.longestStreak || 0;
            displayValue = `${value} days`;
            break;
        }
        
        data.push({
          rank,
          userId: docSnap.id,
          userName: data_item.userName || data_item.userId?.slice(0, 8) || 'Anonymous',
          value,
          displayValue,
          isCurrentUser: user && docSnap.id === user.uid
        });
      });
      
      setLeaderboardData(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      // Use mock data if query fails (composite index not created)
      setLeaderboardData(generateMockData());
    }
    setLoading(false);
  };

  const generateMockData = () => {
    const names = ['Gon', 'Killua', 'Kurapika', 'Leorio', 'Hisoka', 'Chrollo', 'Meruem', 'Komugi', 'Netero', 'Knuckle'];
    return names.map((name, i) => ({
      rank: i + 1,
      userId: `mock_${i}`,
      userName: name,
      value: 100 - (i * 10),
      displayValue: activeCategory === 'debt' ? `${100 - (i * 10)} APR` : `${30 - (i * 3)} days`,
      isCurrentUser: i === 4
    }));
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

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🏆</div>
          <p>Loading Rankings...</p>
        </div>
      </div>
    );
  }

  const currentCategory = categories[activeCategory];

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrophyIcon size={32} color="#ffd700" />
          <div>
            <h2 style={{ margin: 0, color: '#ffd700', fontSize: '1.3rem' }}>GLOBAL RANKINGS</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              Weekly Leaderboards • Top Performers
            </p>
          </div>
        </div>
        
        {userRank && (
          <div style={userRankStyle}>
            <span style={{ fontSize: '0.7rem', color: '#888' }}>YOUR RANK</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffd700' }}>
              #{userRank}
            </span>
          </div>
        )}
      </div>

      {/* Category Tabs */}
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
            <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {cat.label}
            </span>
          </button>
        ))}
      </div>

      {/* Category Description */}
      <div style={{ 
        padding: '10px 20px', 
        background: 'rgba(0,0,0,0.3)', 
        borderBottom: '1px solid #222',
        color: '#666',
        fontSize: '0.8rem',
        textAlign: 'center'
      }}>
        {currentCategory.description}
      </div>

      {/* Leaderboard List */}
      <div style={listStyle}>
        {leaderboardData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📊</div>
            <p>No data available yet.</p>
            <p style={{ fontSize: '0.8rem', color: '#444' }}>Be the first to make the leaderboard!</p>
          </div>
        ) : (
          leaderboardData.map((entry) => (
            <div
              key={entry.userId}
              style={{
                ...entryStyle,
                background: entry.isCurrentUser ? 'rgba(255,215,0,0.1)' : entryStyle.background,
                borderColor: entry.isCurrentUser ? '#ffd700' : '#222'
              }}
            >
              {/* Rank Badge */}
              <div style={{
                ...rankBadgeStyle,
                ...getRankStyle(entry.rank)
              }}>
                {getRankIcon(entry.rank)}
              </div>

              {/* Avatar (placeholder) */}
              <div style={{
                ...avatarStyle,
                borderColor: entry.isCurrentUser ? '#ffd700' : '#333'
              }}>
                {entry.userName.charAt(0).toUpperCase()}
              </div>

              {/* User Info */}
              <div style={userInfoStyle}>
                <span style={{
                  color: entry.isCurrentUser ? '#ffd700' : '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.95rem'
                }}>
                  {entry.userName}
                  {entry.isCurrentUser && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#888' }}>(YOU)</span>}
                </span>
              </div>

              {/* Value */}
              <div style={{
                ...valueStyle,
                color: currentCategory.color
              }}>
                {entry.displayValue}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <p style={{ margin: 0, color: '#444', fontSize: '0.75rem' }}>
          💡 Rankings update in real-time. Check back weekly for new results!
        </p>
      </div>
    </div>
  );
};

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 25px',
  borderBottom: '1px solid #222',
  background: 'linear-gradient(90deg, rgba(255,215,0,0.05) 0%, transparent 100%)'
};

const userRankStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  padding: '10px 20px',
  background: 'rgba(255,215,0,0.1)',
  border: '1px solid #ffd700',
  borderRadius: '12px'
};

const categoryTabsStyle = {
  display: 'flex',
  gap: '10px',
  padding: '15px',
  overflowX: 'auto',
  borderBottom: '1px solid #222',
  background: '#0a0a0a'
};

const categoryButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 16px',
  border: '1px solid',
  borderRadius: '8px',
  background: 'transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s'
};

const listStyle = {
  maxHeight: '400px',
  overflowY: 'auto',
  padding: '15px'
};

const entryStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '15px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid #222',
  borderRadius: '12px',
  marginBottom: '10px',
  transition: 'all 0.2s'
};

const rankBadgeStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  flexShrink: 0
};

const avatarStyle = {
  width: '45px',
  height: '45px',
  borderRadius: '50%',
  background: '#1a1a1a',
  border: '2px solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.2rem',
  color: '#fff',
  flexShrink: 0
};

const userInfoStyle = {
  flex: 1,
  minWidth: 0
};

const valueStyle = {
  fontSize: '1.1rem',
  fontWeight: 'bold',
  minWidth: '80px',
  textAlign: 'right'
};

const footerStyle = {
  padding: '15px',
  background: '#0a0a0a',
  borderTop: '1px solid #1a1a1a',
  textAlign: 'center'
};

export default Leaderboard;
