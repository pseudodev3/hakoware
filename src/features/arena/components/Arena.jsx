import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Target,
  Sword,
  Skull,
  Users,
  Search,
  Plus,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { CreateBountyModal } from './CreateBountyModal';
import { api } from '../../../lib/api';
import './Arena.css';

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

  const filteredBounties = bounties.filter(bounty => bounty.targetName?.toLowerCase().includes(search.toLowerCase()));
  const bountyPool = bounties.reduce((total, bounty) => total + (bounty.amount || 0), 0);

  return (
    <div className="arena-container">
      <div className="arena-stats">
        <div className="stat-card">
          <div className="stat-icon gold"><Trophy size={19} strokeWidth={1.8} /></div>
          <div className="stat-info">
            <span className="label">Active bounties</span>
            <span className="value">{bounties.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Skull size={19} strokeWidth={1.8} /></div>
          <div className="stat-info">
            <span className="label">Bounty pool</span>
            <span className="value">{bountyPool} Aura</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={19} strokeWidth={1.8} /></div>
          <div className="stat-info">
            <span className="label">Active hunters</span>
            <span className="value">{hunterCount}</span>
          </div>
        </div>
      </div>

      <section className="bounty-board" aria-labelledby="blacklist-board-title">
        <header className="board-header">
          <div className="title-group">
            <Target size={19} strokeWidth={1.8} />
            <h3 id="blacklist-board-title">Blacklist board</h3>
          </div>

          <div className="board-actions">
            <label className="search-wrapper">
              <Search size={16} strokeWidth={1.8} />
              <input
                type="search"
                placeholder="Search targets"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search bounty targets"
              />
            </label>
            <Button variant="danger" icon={Plus} size="sm" onClick={() => setShowCreateModal(true)}>Place bounty</Button>
          </div>
        </header>

        <div className="bounty-list">
          <div className="list-header" aria-hidden="true">
            <span>Target</span>
            <span>Type</span>
            <span>Reward</span>
            <span>Hunter</span>
            <span>Status</span>
          </div>

          {loading && bounties.length === 0 ? (
            <div className="board-loading" aria-live="polite">
              <div className="loading-spinner" />
              <p>Loading bounty records…</p>
            </div>
          ) : filteredBounties.length === 0 ? (
            <div className="board-loading">
              <p>{search ? 'No targets match your search.' : 'No active bounties on the blacklist.'}</p>
            </div>
          ) : (
            filteredBounties.map((bounty) => (
              <div key={bounty.id || bounty._id} className={`bounty-row ${bounty.amount > 50 ? 'critical' : 'high'}`}>
                <div className="target-cell">
                  <div className="target-avatar">{bounty.targetName?.[0]?.toUpperCase() || 'T'}</div>
                  <span className="target-name">{bounty.targetName}</span>
                </div>
                <div className="type-cell">
                  <span className="type-tag">{bounty.amount > 100 ? 'Legendary ghost' : 'Ghosting'}</span>
                </div>
                <div className="reward-cell">
                  <Zap size={12} strokeWidth={1.8} />
                  <span className="reward-value">{bounty.amount} Aura</span>
                </div>
                <div className="hunter-cell">
                  {bounty.hunterName ? (
                    <span className="hunter-name active">@{bounty.hunterName.toLowerCase()}</span>
                  ) : (
                    <span className="hunter-name">Open contract</span>
                  )}
                </div>
                <div className="status-cell">
                  <div className={`status-pill ${bounty.status === 'HUNTING' ? 'hunting' : bounty.amount > 50 ? 'critical' : 'high'}`}>
                    {bounty.status === 'HUNTING' ? 'Hunting' : bounty.amount > 50 ? 'Critical' : 'High'}
                  </div>
                </div>
                <div className="action-cell">
                  {bounty.status === 'ACTIVE' ? (
                    <button
                      className="challenge-btn"
                      aria-label={`Hunt bounty for ${bounty.targetName}`}
                      onClick={async () => {
                        try {
                          await api.post(`/bounties/${bounty.id || bounty._id}/hunt`);
                          showToast?.(`CONTRACT: APPREHEND ${bounty.targetName.toUpperCase()}! Reward claimed when target performs check-in.`, 'SUCCESS');
                          loadArenaData();
                        } catch (err) {
                          showToast?.(err.message || 'FAILED TO CLAIM CONTRACT', 'ERROR');
                        }
                      }}
                    >
                      <Sword size={16} strokeWidth={1.8} />
                    </button>
                  ) : (
                    <div className="hunter-assigned" aria-label="Hunter assigned">
                      <ShieldCheck size={14} strokeWidth={1.8} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

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
