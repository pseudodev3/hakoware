import React, { useEffect, useState } from 'react';
import { Activity, Dice5, Plus, Search, ShieldCheck, Sword, Target, Zap } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { CreateBountyModal } from './CreateBountyModal';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import './Arena.css';

export const Arena = ({ friendships, worldEvent, showToast }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('bounties');
  const [bounties, setBounties] = useState([]);
  const [shame, setShame] = useState([]);
  const [hunterCount, setHunterCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const userId = String(user.uid || user.id || user._id);

  const loadArenaData = async () => {
    setLoading(true);
    try {
      const [bountiesRes, huntersRes, shameRes] = await Promise.all([
        api.get('/bounties/active'),
        api.get('/users/hunters'),
        api.get('/users/leaderboard')
      ]);
      setBounties(bountiesRes || []);
      setHunterCount(huntersRes?.count || 0);
      setShame(shameRes || []);
    } catch (error) {
      console.error('Failed to load Arena:', error);
      showToast?.(error.message || 'Could not load Arena', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArenaData(); }, []);

  const filtered = bounties.filter((bounty) => bounty.targetName?.toLowerCase().includes(search.toLowerCase()));
  const bountyPool = bounties.reduce((total, bounty) => total + (bounty.amount || 0), 0);
  const activeAnomalies = friendships.filter((friendship) => friendship.chaos?.activeEvent).length;

  const hunt = async (bounty) => {
    try {
      await api.post(`/bounties/${bounty._id || bounty.id}/hunt`);
      showToast?.(`You picked up ${bounty.targetName}'s bounty`, 'SUCCESS');
      await loadArenaData();
    } catch (error) {
      showToast?.(error.message || 'Could not pick up bounty', 'ERROR');
    }
  };

  return (
    <div className="arena-view">
      <header className="arena-hero">
        <div>
          <p className="eyebrow">Arena</p>
          <h1>This is where pressure becomes public.</h1>
          <p>Bounties, hunters, overdue contracts and whatever Chaos started this week.</p>
        </div>
        <Button variant="danger" icon={Plus} onClick={() => setShowCreateModal(true)} disabled={friendships.length === 0}>Place bounty</Button>
      </header>

      {worldEvent && (
        <section className="arena-live-event">
          <div className="arena-live-icon">{worldEvent.id === 'ANOMALY_SEASON' ? <Dice5 size={20} /> : <Activity size={20} />}</div>
          <div><span>WORLD EVENT · {worldEvent.theme}</span><strong>{worldEvent.name}</strong><p>{worldEvent.description}</p></div>
          <b>LIVE</b>
        </section>
      )}

      <section className="arena-summary">
        <div><small>Open bounties</small><strong>{bounties.length}</strong><span>{bountyPool} Aura escrowed</span></div>
        <div><small>Hunters</small><strong>{hunterCount}</strong><span>licensed by activity</span></div>
        <div className={activeAnomalies ? 'hot' : ''}><small>Live anomalies</small><strong>{activeAnomalies}</strong><span>{activeAnomalies ? 'contracts unstable' : 'quiet for now'}</span></div>
      </section>

      <div className="arena-tabs" role="tablist" aria-label="Arena views">
        <button className={tab === 'bounties' ? 'active' : ''} onClick={() => setTab('bounties')} role="tab" aria-selected={tab === 'bounties'}>Bounties</button>
        <button className={tab === 'shame' ? 'active' : ''} onClick={() => setTab('shame')} role="tab" aria-selected={tab === 'shame'}>Shame board</button>
      </div>

      {tab === 'bounties' ? (
        <section className="arena-panel">
          <div className="arena-panel-head">
            <div><Target size={18} strokeWidth={1.8} /><strong>Open targets</strong></div>
            <label className="arena-search"><Search size={15} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a target" /></label>
          </div>
          <div className="arena-list">
            {loading ? <div className="arena-empty">Loading Arena…</div> : filtered.length === 0 ? <div className="arena-empty">{search ? 'No matching targets.' : 'No active bounties. The circle is suspiciously quiet.'}</div> : filtered.map((bounty) => {
              const isTarget = String(bounty.targetId) === userId;
              const isSender = String(bounty.senderId) === userId;
              return (
                <article className="bounty-item" key={bounty._id || bounty.id}>
                  <div className="bounty-avatar">{bounty.targetName?.[0]?.toUpperCase() || '?'}</div>
                  <div className="bounty-copy"><strong>{bounty.targetName}</strong><span>{bounty.message || 'Check in to close this bounty.'}</span></div>
                  <div className="bounty-reward"><Zap size={13} /> {bounty.amount}</div>
                  {bounty.status === 'HUNTING' ? (
                    <div className="hunter-lock" title={bounty.hunterName ? `Hunted by ${bounty.hunterName}` : 'Hunter assigned'}><ShieldCheck size={16} /><span>{bounty.hunterName || 'Hunting'}</span></div>
                  ) : isTarget ? (
                    <div className="bounty-owner-state">On you</div>
                  ) : isSender ? (
                    <div className="bounty-owner-state">Your bounty</div>
                  ) : (
                    <button className="hunt-button" onClick={() => hunt(bounty)} aria-label={`Hunt ${bounty.targetName}`}><Sword size={17} strokeWidth={1.8} /></button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="arena-panel">
          <div className="arena-panel-head"><div><Target size={18} strokeWidth={1.8} /><strong>Most overdue</strong></div><span className="arena-privacy-note">Opt-out respected</span></div>
          <div className="arena-list shame-list-new">
            {loading ? <div className="arena-empty">Loading board…</div> : shame.length === 0 ? <div className="arena-empty">Nobody is bankrupt right now.</div> : shame.map((person, index) => (
              <article className="shame-item-new" key={person._id}>
                <span className="shame-rank">{String(index + 1).padStart(2, '0')}</span>
                <div className="bounty-avatar">{person.displayName?.[0]?.toUpperCase() || '?'}</div>
                <div className="bounty-copy"><strong>{person.displayName}</strong><span>{person.nenType ? person.nenType.toLowerCase() : 'No affinity'}</span></div>
                <strong className="shame-debt">{person.totalDebt} debt</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      <CreateBountyModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} friendships={friendships} onRefresh={loadArenaData} showToast={showToast} />
    </div>
  );
};
