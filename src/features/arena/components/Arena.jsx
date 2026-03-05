import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  Sword, 
  Skull, 
  TrendingDown, 
  Users,
  Search,
  Plus,
  Zap
} from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { api } from '../../../lib/api';
import './Arena.css';

/**
 * Professional Arena / Bounty Board module.
 * Competitive HxH environment with visual hierarchy.
 */
export const Arena = () => {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadBounties = async () => {
    setLoading(true);
    try {
      // In a real app, this would be a real endpoint.
      // For now, we'll simulate some professional bounty data.
      const simulatedBounties = [
        { id: 1, target: 'Leorio Paradinight', amount: 500, type: 'GHOSTING', urgency: 'HIGH', hunter: 'Killua' },
        { id: 2, target: 'Kurapika', amount: 1200, type: 'DEBT_LIMIT', urgency: 'CRITICAL', hunter: 'Hisoka' },
        { id: 3, target: 'Isaac Netero', amount: 50, type: 'STREAK_RESET', urgency: 'LOW', hunter: 'Gon' }
      ];
      setBounties(simulatedBounties);
    } catch (error) {
      console.error('Failed to load arena data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBounties();
  }, []);

  return (
    <div className="arena-container">
      {/* Arena Header Stats */}
      <div className="arena-stats">
        <div className="stat-card glass">
          <div className="stat-icon"><Trophy size={20} color="var(--aura-gold)" /></div>
          <div className="stat-info">
            <span className="label">ACTIVE BOUNTIES</span>
            <span className="value">{bounties.length}</span>
          </div>
        </div>
        <div className="stat-card glass">
          <div className="stat-icon"><Skull size={20} color="var(--aura-red)" /></div>
          <div className="stat-info">
            <span className="label">TOTAL BOUNTY POOL</span>
            <span className="value">1,750 APR</span>
          </div>
        </div>
        <div className="stat-card glass">
          <div className="stat-icon"><Users size={20} color="var(--aura-blue)" /></div>
          <div className="stat-info">
            <span className="label">ACTIVE HUNTERS</span>
            <span className="value">12</span>
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div className="bounty-board glass">
        <header className="board-header">
          <div className="title-group">
            <Target size={24} color="var(--aura-red)" />
            <h3>THE BLACKLIST BOARD</h3>
          </div>
          
          <div className="board-actions">
            <div className="search-wrapper">
              <Search size={16} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="SEARCH TARGETS..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="danger" icon={Plus} size="sm">PLACE BOUNTY</Button>
          </div>
        </header>

        <div className="bounty-list">
          <div className="list-header">
            <span>TARGET</span>
            <span>TYPE</span>
            <span>REWARD</span>
            <span>HUNTER</span>
            <span>STATUS</span>
          </div>

          {loading ? (
            <div className="board-loading">
              <div className="loading-spinner" />
              <p>ACCESSING HUNTER ASSOCIATION RECORDS...</p>
            </div>
          ) : (
            bounties.map((b) => (
              <motion.div 
                key={b.id} 
                className={`bounty-row ${b.urgency.toLowerCase()}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="target-cell">
                  <div className="target-avatar">{b.target[0]}</div>
                  <span className="target-name">{b.target}</span>
                </div>
                <div className="type-cell">
                  <span className="type-tag">{b.type}</span>
                </div>
                <div className="reward-cell">
                  <Zap size={12} color="var(--aura-gold)" />
                  <span className="reward-value">{b.amount} APR</span>
                </div>
                <div className="hunter-cell">
                  <span className="hunter-name">@{b.hunter.toLowerCase()}</span>
                </div>
                <div className="status-cell">
                  <div className={`status-pill ${b.urgency.toLowerCase()}`}>
                    {b.urgency}
                  </div>
                </div>
                <div className="action-cell">
                   <button className="challenge-btn">
                     <Sword size={16} />
                   </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
