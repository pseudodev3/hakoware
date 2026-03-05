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
  User
} from 'lucide-react';
import { api } from '../../../lib/api';
import './AchievementShowcase.css';

/**
 * Professional Achievement Showcase module.
 * Visualizes hunter progress with a premium aesthetic.
 */
export const AchievementShowcase = () => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAchievements = async () => {
    setLoading(true);
    try {
      // In a real app, this would be a real endpoint.
      // For now, we'll simulate some professional achievement data.
      const simulatedAchievements = [
        { id: 1, title: 'FIRST CONTRACT', description: 'BIND YOUR FIRST DEBTOR TO THE ASSOCIATION.', icon: User, unlocked: true, date: '2025-01-10' },
        { id: 2, title: 'HAKOWARE MASTER', description: 'USE THE HAKOWARE PROTOCOL 10 TIMES.', icon: Zap, unlocked: true, date: '2025-02-15' },
        { id: 3, title: 'GHOSTING SURVIVOR', description: 'ESCAPE A BANKRUPTCY WARNING WITH 24H TO SPARE.', icon: ShieldCheck, unlocked: false },
        { id: 4, title: 'WHALE HUNTER', description: 'INITIATE A CONTRACT WITH 1,000+ APR ACCRUAL.', icon: Trophy, unlocked: false },
        { id: 5, title: 'SYSTEM INTEGRITY', description: 'MAINTAIN AN AURA SCORE OF 900+ FOR 30 DAYS.', icon: Activity, unlocked: true, date: '2025-03-01' }
      ];
      setAchievements(simulatedAchievements);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAchievements();
  }, []);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

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
            <span className="current">{unlockedCount}</span>
            <span className="divider">/</span>
            <span className="total">{achievements.length}</span>
            <span className="label">UNLOCKED</span>
          </div>
        </div>
        
        <div className="header-progress-bar">
          <div className="bar-bg">
            <motion.div 
              className="bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${(unlockedCount / achievements.length) * 100}%` }}
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
          achievements.map((a, idx) => (
            <motion.div 
              key={a.id} 
              className={`achievement-card glass ${a.unlocked ? 'unlocked' : 'locked'}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="achievement-icon-wrapper">
                {a.unlocked ? <a.icon size={24} color="var(--aura-gold)" /> : <Lock size={24} color="var(--text-muted)" />}
                {a.unlocked && <div className="icon-glow" />}
              </div>
              
              <div className="achievement-info">
                <div className="info-header">
                  <span className="achievement-title">{a.title}</span>
                  {a.unlocked && <span className="achievement-date">{new Date(a.date).toLocaleDateString()}</span>}
                </div>
                <p className="achievement-desc">{a.description}</p>
                {!a.unlocked && (
                   <div className="lock-label">
                     <Unlock size={10} />
                     <span>LOCKED BY ASSOCIATION</span>
                   </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
