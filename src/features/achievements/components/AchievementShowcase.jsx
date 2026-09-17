import React, { useState, useEffect } from 'react';
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
  Flame,
  TrendingUp,
  Skull
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserAchievements, ACHIEVEMENTS } from '../../../services/achievementService';
import './AchievementShowcase.css';

export const AchievementShowcase = () => {
  const { user } = useAuth();
  const [achievementsData, setAchievementsData] = useState({
    unlockedAchievements: [],
    totalPoints: 0,
    stats: {}
  });
  const [loading, setLoading] = useState(true);

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

  const allAchievementsList = Object.values(ACHIEVEMENTS).map(definition => {
    const unlockedInfo = achievementsData.unlockedAchievements.find(item => item.id === definition.id);
    return {
      ...definition,
      unlocked: !!unlockedInfo,
      unlockedAt: unlockedInfo?.unlockedAt
    };
  });

  const unlockedCount = allAchievementsList.filter(achievement => achievement.unlocked).length;
  const progress = allAchievementsList.length ? (unlockedCount / allAchievementsList.length) * 100 : 0;

  return (
    <div className="achievements-container">
      <section className="achievements-header" aria-labelledby="achievements-title">
        <div className="header-info">
          <div className="title-group">
            <div className="achievement-heading-icon"><Award size={21} strokeWidth={1.8} /></div>
            <div className="label-group">
              <h3 id="achievements-title">Hunter medals</h3>
              <p>Track your progress through the Association.</p>
            </div>
          </div>
          <div className="progress-stat">
            <div className="points-badge">
              <Zap size={14} strokeWidth={1.8} />
              <span>{achievementsData.totalPoints} pts</span>
            </div>
            <div className="count-badge">
              <span className="current">{unlockedCount}</span>
              <span className="divider">/</span>
              <span className="total">{allAchievementsList.length}</span>
              <span className="label">unlocked</span>
            </div>
          </div>
        </div>

        <div className="header-progress-bar" aria-label={`${Math.round(progress)}% of achievements unlocked`}>
          <div className="bar-bg">
            <div className="bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="achievements-grid">
        {loading ? (
          <div className="grid-loading" aria-live="polite">
            <div className="loading-spinner" />
            <p>Loading medals…</p>
          </div>
        ) : (
          allAchievementsList.map((achievement) => {
            const IconComponent = iconMap[achievement.icon] || Award;
            return (
              <article
                key={achievement.id}
                className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                style={{ '--achievement-color': achievement.color }}
              >
                <div className="achievement-icon-wrapper">
                  {achievement.unlocked ? <IconComponent size={23} strokeWidth={1.8} /> : <Lock size={22} strokeWidth={1.8} />}
                  {achievement.unlocked && <div className="icon-glow" aria-hidden="true" />}
                </div>

                <div className="achievement-info">
                  <div className="info-header">
                    <span className="achievement-title">{achievement.name}</span>
                    {achievement.unlocked && <span className="achievement-date">{new Date(achievement.unlockedAt).toLocaleDateString()}</span>}
                  </div>
                  <p className="achievement-desc">{achievement.description}</p>
                  <div className="achievement-footer">
                    <span className={`rarity-badge ${achievement.rarity}`}>{achievement.rarity}</span>
                    <span className="points-value">+{achievement.points} XP</span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
