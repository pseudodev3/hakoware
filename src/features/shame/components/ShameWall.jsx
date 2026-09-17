import React, { useState, useEffect } from 'react';
import { Skull, TrendingDown, Target, Award } from 'lucide-react';
import { api } from '../../../lib/api';
import './ShameWall.css';

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
      <section className="shame-header" aria-labelledby="shame-board-title">
        <div className="header-icon-group">
          <div className="shame-header-icon"><Skull size={22} strokeWidth={1.8} /></div>
          <div>
            <span className="shame-kicker">Shame Board</span>
            <h2 id="shame-board-title">The Chimera Ant Selection</h2>
            <p>Ranking the most notorious debtors in the Association.</p>
          </div>
        </div>
        <div className="shame-stats">
          <div className="stat">
            <span className="val">{shameList.length}</span>
            <span className="lbl">Blacklisted</span>
          </div>
        </div>
      </section>

      <div className="shame-list">
        {loading ? (
          <div className="loading-state" aria-live="polite">
            <div className="loading-spinner" />
            <p>Loading the board…</p>
          </div>
        ) : shameList.length === 0 ? (
          <div className="loading-state">
            <p>No debtors found. The Association is unusually clean.</p>
          </div>
        ) : (
          shameList.map((hunter, index) => (
            <article key={hunter._id} className={`shame-card rank-${index + 1}`}>
              <div className="rank-indicator" aria-label={`Rank ${index + 1}`}>
                {index === 0 ? <Award size={21} strokeWidth={1.8} /> : `#${index + 1}`}
              </div>

              <div className="hunter-profile">
                <div className="hunter-avatar">{hunter.displayName?.[0]?.toUpperCase() || '?'}</div>
                <div className="hunter-details">
                  <span className="name">{hunter.displayName}</span>
                  <span className="nen-type">{hunter.nenType || 'Unknown Nen'}</span>
                </div>
              </div>

              <div className="debt-severity">
                <TrendingDown size={16} strokeWidth={1.8} />
                <span className="score">{hunter.totalDebt} APR debt</span>
              </div>

              <div className="shame-action">
                <button className="place-bounty-btn" aria-label={`Target ${hunter.displayName}`}>
                  <Target size={16} strokeWidth={1.8} />
                  <span>Target</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
