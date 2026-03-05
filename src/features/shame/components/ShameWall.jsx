import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Skull, TrendingDown, Target, ShieldAlert, Award } from 'lucide-react';
import { api } from '../../../lib/api';
import './ShameWall.css';

/**
 * Professional Wall of Shame module.
 * Visualizes the Chimera Ant "Selection" - ranking hunters with the lowest Aura/highest debt.
 */
export const ShameWall = () => {
  const [shameList, setShameList] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadShameList = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/leaderboard');
      setShameList(res || []);
    } catch (error) {
      console.error('Failed to load shame list:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShameList();
  }, []);

  return (
    <div className="shame-wall-container">
      <div className="shame-header glass">
        <div className="header-icon-group">
          <Skull size={40} color="var(--aura-red)" />
          <div>
            <h2>THE CHIMERA ANT SELECTION</h2>
            <p>RANKING THE MOST NOTORIOUS DEBTORS IN THE ASSOCIATION</p>
          </div>
        </div>
        <div className="shame-stats">
           <div className="stat">
              <span className="val">{shameList.length}</span>
              <span className="lbl">BLACKLISTED</span>
           </div>
        </div>
      </div>

      <div className="shame-list">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>ACCESSING THE DARK CONTINENT ARCHIVES...</p>
          </div>
        ) : shameList.length === 0 ? (
           <div className="loading-state">
             <p>NO DEBTORS FOUND. THE ASSOCIATION IS PURE.</p>
           </div>
        ) : (
          shameList.map((hunter, index) => (
            <motion.div 
              key={hunter._id}
              className={`shame-card glass rank-${index + 1}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="rank-indicator">
                {index === 0 ? <Award size={24} color="var(--aura-red)" /> : `#${index + 1}`}
              </div>
              
              <div className="hunter-profile">
                <div className="hunter-avatar">
                   {hunter.displayName[0]}
                </div>
                <div className="hunter-details">
                  <span className="name">{hunter.displayName}</span>
                  <span className="nen-type">{hunter.nenType || 'UNKNOWN NEN'}</span>
                </div>
              </div>

              <div className="debt-severity">
                <TrendingDown size={16} color="var(--aura-red)" />
                <span className="score">{hunter.totalDebt} APR DEBT</span>
              </div>
              
              <div className="shame-action">
                <button className="place-bounty-btn">
                  <Target size={16} /> TARGET
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
