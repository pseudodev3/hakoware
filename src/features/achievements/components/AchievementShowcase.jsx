import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Award, 
  Lock, 
  Unlock, 
  Star, 
  Zap, 
  ShieldCheck, 
  Trophy,
  Activity,
  User,
  Target,
  Package,
  Medal,
  Flame,
  CheckCircle2,
  TrendingUp,
  Skull
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserAchievements, ACHIEVEMENTS } from '../../../services/achievementService';
import './AchievementShowcase.css';

/**
 * Professional Achievement Showcase module.
 * Visualizes hunter progress with a premium aesthetic.
 */
export const AchievementShowcase = () => {
  const { user } = useAuth();
  const [achievementsData, setAchievementsData] = useState({
    unlockedAchievements: [],
    totalPoints: 0,
    stats: {}
  });
  const [loading, setLoading] = useState(true);

  // Map of icons for display
  const iconMap = {
    '💀': Skull,
    '🔥': Flame,
    '👑': Trophy,
    '📈': TrendingUp,
    '⚡': Zap,
    '✨': Star,
    '😇': ShieldCheck,
    '🦸': User,
    '🚁': Activity,
    '🏦': Award,
    '🥺': Unlock,
    '📅': Target,
    '🤖': Package,
    '🔥': Flame,
    '💎': Star,
    '🌟': Star,
    '📱': Activity,
    '🙏': Unlock,
    '❤️': Award,
    '🦉': Activity,
    '📊': TrendingUp,
    '🐦': Unlock
  };

  const loadAchievements = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserAchievements(user.uid || user.id);
      setAchievementsData(data);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAchievements();
  }, [user]);

  // Merge unlocked state with all achievement definitions
  const allAchievementsList = Object.values(ACHIEVEMENTS).map(def => {
    const unlockedInfo = achievementsData.unlockedAchievements.find(ua => ua.id === def.id);
    return {
      ...def,
      unlocked: !!unlockedInfo,
      unlockedAt: unlockedInfo?.unlockedAt
    };
  });

  const unlockedCount = allAchievementsList.filter(a => a.unlocked).length;

  return (
    <div className="achievements-container">
      {/* Progress Header */}
      <div className="achievements-header glass">
        <div className="header-info">
          <div className="title-group">
            <Award size={32} color="var(--aura-gold)" />
            <div className="label-group">
              <h3>HUNTER MEDALS</h3>
              <p>TRACK YOUR ASCENSION THROUGH THE ASSOCIATION</p>
            </div>
          </div>
          <div className="progress-stat">
            <div className="points-badge">
              <Zap size={14} />
              <span>{achievementsData.totalPoints} PTS</span>
            </div>
            <div className="count-badge">
              <span className="current">{unlockedCount}</span>
              <span className="divider">/</span>
              <span className="total">{allAchievementsList.length}</span>
              <span className="label">UNLOCKED</span>
            </div>
          </div>
        </div>
        
        <div className="header-progress-bar">
          <div className="bar-bg">
            <motion.div 
              className="bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${(unlockedCount / allAchievementsList.length) * 100}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Grid of Achievements */}
      <div className="achievements-grid">
        {loading ? (
          <div className="grid-loading">
            <div className="loading-spinner" />
            <p>DECODING HUNTER RECORDS...</p>
          </div>
        ) : (
          allAchievementsList.map((a, idx) => {
            const IconComponent = iconMap[a.icon] || Award;
            return (
              <motion.div 
                key={a.id} 
                className={`achievement-card glass ${a.unlocked ? 'unlocked' : 'locked'}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="achievement-icon-wrapper" style={{ borderColor: a.unlocked ? a.color : 'rgba(255,255,255,0.05)' }}>
                  {a.unlocked ? <IconComponent size={24} color={a.color} /> : <Lock size={24} color="var(--text-muted)" />}
                  {a.unlocked && <div className="icon-glow" style={{ backgroundColor: a.color }} />}
                </div>
                
                <div className="achievement-info">
                  <div className="info-header">
                    <span className="achievement-title">{a.name}</span>
                    {a.unlocked && <span className="achievement-date">{new Date(a.unlockedAt).toLocaleDateString()}</span>}
                  </div>
                  <p className="achievement-desc">{a.description}</p>
                  <div className="achievement-footer">
                    <span className={`rarity-badge ${a.rarity}`}>{a.rarity.toUpperCase()}</span>
                    <span className="points-value">+{a.points} XP</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
