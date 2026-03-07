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
import { CreateBountyModal } from './CreateBountyModal';
import { api } from '../../../lib/api';
import './Arena.css';

/**
 * Professional Arena / Bounty Board module.
 * Competitive HxH environment with visual hierarchy.
 */
export const Arena = ({ friendships, showToast }) => {
  const [bounties, setBounties] = useState([]);
  const [hunterCount, setHunterCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadArenaData = async () => {
    setLoading(true);
    try {
      const [bountiesRes, huntersRes] = await Promise.all([
        api.get('/bounties/active'),
        api.get('/users/hunters')
      ]);
      setBounties(bountiesRes || []);
      setHunterCount(huntersRes?.count || 0);
    } catch (error) {
      console.error('Failed to load arena data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArenaData();
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
            <span className="value">
              {bounties.reduce((acc, b) => acc + (b.amount || 0), 0)} AURA
            </span>
          </div>
        </div>
        <div className="stat-card glass">
          <div className="stat-icon"><Users size={20} color="var(--aura-blue)" /></div>
          <div className="stat-info">
            <span className="label">ACTIVE HUNTERS</span>
            <span className="value">{hunterCount}</span>
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
            <Button variant="danger" icon={Plus} size="sm" onClick={() => setShowCreateModal(true)}>PLACE BOUNTY</Button>
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

          {loading && bounties.length === 0 ? (
            <div className="board-loading">
              <div className="loading-spinner" />
              <p>ACCESSING HUNTER ASSOCIATION RECORDS...</p>
            </div>
          ) : bounties.length === 0 ? (
            <div className="board-loading">
               <p>NO ACTIVE BOUNTIES ON THE BLACKLIST</p>
            </div>
          ) : (
            bounties
              .filter(b => b.targetName?.toLowerCase().includes(search.toLowerCase()))
              .map((b) => (
              <motion.div 
                key={b.id || b._id} 
                className={`bounty-row ${b.amount > 50 ? 'critical' : 'high'}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="target-cell">
                  <div className="target-avatar">{b.targetName ? b.targetName[0] : 'T'}</div>
                  <span className="target-name">{b.targetName}</span>
                </div>
                <div className="type-cell">
                  <span className="type-tag">{b.amount > 100 ? 'LEGENDARY GHOST' : 'GHOSTING'}</span>
                </div>
                <div className="reward-cell">
                  <Zap size={12} color="var(--aura-gold)" />
                  <span className="reward-value">{b.amount} AURA</span>
                </div>
                <div className="hunter-cell">
                  {b.hunterName ? (
                    <span className="hunter-name active">@{b.hunterName.toLowerCase()}</span>
                  ) : (
                    <span className="hunter-name">OPEN CONTRACT</span>
                  )}
                </div>
                <div className="status-cell">
                  <div className={`status-pill ${b.status === 'HUNTING' ? 'hunting' : b.amount > 50 ? 'critical' : 'high'}`}>
                    {b.status === 'HUNTING' ? 'HUNTING' : b.amount > 50 ? 'CRITICAL' : 'HIGH'}
                  </div>
                </div>
                <div className="action-cell">
                   {b.status === 'ACTIVE' ? (
                     <button 
                      className="challenge-btn"
                      onClick={async () => {
                        try {
                          await api.post(`/bounties/${b.id || b._id}/hunt`);
                          showToast(`CONTRACT: APPREHEND ${b.targetName.toUpperCase()}! Reward claimed when target performs check-in.`, 'SUCCESS');
                          loadArenaData();
                        } catch (err) {
                          showToast(err.message || 'FAILED TO CLAIM CONTRACT', 'ERROR');
                        }
                      }}
                     >
                       <Sword size={16} />
                     </button>
                   ) : (
                     <div className="hunter-assigned">
                        <ShieldCheck size={14} color="var(--aura-blue)" />
                     </div>
                   )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <CreateBountyModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        friendships={friendships || []}
        onRefresh={loadArenaData}
        showToast={showToast}
      />
    </div>
  );
};
