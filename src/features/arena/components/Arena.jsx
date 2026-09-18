import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Dice5, Flame, Plus, Search, ShieldCheck, Sword, Target, Zap } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { CreateBountyModal } from './CreateBountyModal';
import { PressureMoveModal } from './PressureMoveModal';
import { api } from '../../../lib/api';
import { getBountyMeta, getHunterProfile, huntBounty, sendBountyPressure } from '../../../services/bountyService';
import { getPublicGrudges } from '../../../services/auraService';
import { useAuth } from '../../../contexts/AuthContext';
import { calculateDebt } from '../../../hooks/useDebt';
import './Arena.css';

const hunterBondFor = (amount) => Math.max(5, Math.min(50, Math.ceil((Number(amount) || 0) * 0.1)));

const timeLeft = (date) => {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return 'closing';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${Math.max(1, minutes)}m left`;
};

const grudgeTimeLeft = (date) => {
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return 'ending';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${Math.max(1, hours)}h left`;
};

export const Arena = ({ friendships, worldEvent, showToast }) => {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('bounties');
  const [bounties, setBounties] = useState([]);
  const [shame, setShame] = useState([]);
  const [grudges, setGrudges] = useState([]);
  const [hunterProfile, setHunterProfile] = useState({ rep: 0, rank: 'Rookie Hunter', successfulHunts: 0, attempts: 0, conversionRate: 0, auraCollected: 0, activeHunts: 0 });
  const [meta, setMeta] = useState({ pressureMoves: [], huntWindowHours: 12 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pressureBounty, setPressureBounty] = useState(null);
  const [pressureLoading, setPressureLoading] = useState(false);
  const userId = String(user.uid || user.id || user._id);

  const loadArenaData = async () => {
    setLoading(true);
    try {
      const [bountiesRes, shameRes, profileRes, metaRes, grudgesRes] = await Promise.all([
        api.get('/bounties/active'),
        api.get('/users/leaderboard'),
        getHunterProfile(),
        getBountyMeta(),
        getPublicGrudges()
      ]);
      setBounties(bountiesRes || []);
      setShame(shameRes || []);
      setHunterProfile(profileRes || {});
      setMeta(metaRes || { pressureMoves: [], huntWindowHours: 12 });
      setGrudges(grudgesRes || []);
    } catch (error) {
      console.error('Failed to load Arena:', error);
      showToast?.(error.message || 'Could not load Arena', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArenaData(); }, []);

  const filtered = useMemo(
    () => bounties.filter((bounty) => bounty.targetName?.toLowerCase().includes(search.toLowerCase())),
    [bounties, search]
  );
  const bankruptFriendships = useMemo(
    () => friendships.filter((friendship) => {
      const isUser1 = String(friendship.user1?._id || friendship.user1) === userId;
      const targetPerspective = isUser1 ? friendship.user2Perspective : friendship.user1Perspective;
      return calculateDebt(targetPerspective)?.isBankrupt;
    }),
    [friendships, userId]
  );
  const bountyPool = bounties.reduce((total, bounty) => total + (bounty.amount || 0), 0);
  const activeAnomalies = friendships.filter((friendship) => friendship.chaos?.activeEvent).length;
  const openTargets = bounties.filter((bounty) => bounty.status === 'ACTIVE').length;

  const hunt = async (bounty) => {
    try {
      const result = await huntBounty(bounty._id || bounty.id);
      const bond = result?.hunterBond || hunterBondFor(bounty.amount);
      showToast?.(`Hunt started · ${bond} Aura bond staked · send pressure`, 'SUCCESS');
      await Promise.all([loadArenaData(), refreshUser()]);
    } catch (error) {
      showToast?.(error.message || 'Could not start hunt', 'ERROR');
    }
  };

  const sendPressure = async (moveId) => {
    if (!pressureBounty) return;
    setPressureLoading(true);
    try {
      await sendBountyPressure(pressureBounty._id || pressureBounty.id, moveId);
      showToast?.(`Pressure sent to ${pressureBounty.targetName} · proof armed`, 'SUCCESS');
      setPressureBounty(null);
      await loadArenaData();
    } catch (error) {
      showToast?.(error.message || 'Could not send pressure', 'ERROR');
    } finally {
      setPressureLoading(false);
    }
  };

  return (
    <div className="arena-view">
      <header className="arena-hero">
        <div>
          <p className="eyebrow">Arena</p>
          <h1>Pressure has to earn its payout.</h1>
          <p>Hunters stake Aura, send one pressure move, and only get paid when the target says it actually worked.</p>
        </div>
        <Button variant="danger" icon={Plus} onClick={() => setShowCreateModal(true)} disabled={bankruptFriendships.length === 0}>
          {bankruptFriendships.length === 0 ? 'No bankrupt targets' : 'Place bounty'}
        </Button>
      </header>

      {worldEvent && (
        <section className="arena-live-event">
          <div className="arena-live-icon">{worldEvent.id === 'ANOMALY_SEASON' ? <Dice5 size={20} /> : <Activity size={20} />}</div>
          <div><span>WORLD EVENT · {worldEvent.theme}</span><strong>{worldEvent.name}</strong><p>{worldEvent.description}</p></div>
          <b>LIVE</b>
        </section>
      )}

      <section className="hunter-profile-strip">
        <div className="hunter-profile-mark"><Sword size={20} strokeWidth={1.8} /></div>
        <div className="hunter-profile-copy"><span>YOUR HUNTER RECORD</span><strong>{hunterProfile.rank || 'Rookie Hunter'}</strong><p>{hunterProfile.rep || 0} Rep · {hunterProfile.successfulHunts || 0} closes · {hunterProfile.conversionRate || 0}% conversion</p></div>
        <div className="hunter-profile-earned"><small>Aura collected</small><strong>{hunterProfile.auraCollected || 0}</strong></div>
      </section>

      <section className="arena-summary">
        <div><small>Open targets</small><strong>{openTargets}</strong><span>{bounties.length - openTargets} currently hunted</span></div>
        <div><small>Aura in escrow</small><strong>{bountyPool}</strong><span>moves only on proof or escape</span></div>
        <div><small>Public grudges</small><strong>{grudges.length}</strong><span>{grudges.length ? 'somebody made it personal' : 'peace, somehow'}</span></div>
        <div className={activeAnomalies ? 'hot' : ''}><small>Live anomalies</small><strong>{activeAnomalies}</strong><span>{activeAnomalies ? 'contracts unstable' : 'quiet for now'}</span></div>
      </section>

      <div className="arena-tabs" role="tablist" aria-label="Arena views">
        <button className={tab === 'bounties' ? 'active' : ''} onClick={() => setTab('bounties')} role="tab" aria-selected={tab === 'bounties'}>Bounties</button>
        <button className={tab === 'grudges' ? 'active' : ''} onClick={() => setTab('grudges')} role="tab" aria-selected={tab === 'grudges'}>Grudges {grudges.length ? `· ${grudges.length}` : ''}</button>
        <button className={tab === 'shame' ? 'active' : ''} onClick={() => setTab('shame')} role="tab" aria-selected={tab === 'shame'}>Shame board {shame.length ? `· ${shame.length}` : ''}</button>
      </div>

      {tab === 'bounties' ? (
        <section className="arena-panel">
          <div className="arena-panel-head">
            <div><Target size={18} strokeWidth={1.8} /><strong>Live hunts</strong></div>
            <label className="arena-search"><Search size={15} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a target" /></label>
          </div>
          <div className="arena-list">
            {loading ? <div className="arena-empty">Loading Arena…</div> : filtered.length === 0 ? <div className="arena-empty">{search ? 'No matching targets.' : 'No active bounties. The circle is suspiciously quiet.'}</div> : filtered.map((bounty) => {
              const isTarget = String(bounty.targetId) === userId;
              const isSender = String(bounty.senderId) === userId;
              const isHunter = String(bounty.hunterId || '') === userId;
              const proofArmed = bounty.status === 'PRESSURE_SENT';
              const hunting = bounty.status === 'HUNTING' || proofArmed;
              const window = timeLeft(bounty.huntExpiresAt);
              const bond = hunterBondFor(bounty.amount);

              return (
                <article className={`bounty-item ${proofArmed ? 'proof-armed-item' : hunting ? 'hunting-item' : ''}`} key={bounty._id || bounty.id}>
                  <div className="bounty-avatar">{bounty.targetName?.[0]?.toUpperCase() || '?'}</div>
                  <div className="bounty-copy">
                    <div className="bounty-title-row"><strong>{bounty.targetName}</strong><span className={`bounty-status ${proofArmed ? 'proof' : hunting ? 'hunting' : 'open'}`}>{proofArmed ? 'PROOF ARMED' : hunting ? 'HUNTER ASSIGNED' : 'OPEN'}</span></div>
                    <span>{bounty.message || 'Check in to close this bounty.'}</span>
                    {hunting && <small className="bounty-hunt-meta"><Clock3 size={12} /> {bounty.hunterName || 'Hunter'} · {window || `${meta.huntWindowHours || 12}h window`}</small>}
                  </div>
                  <div className="bounty-reward"><Zap size={13} /> {bounty.amount}</div>

                  {bounty.status === 'ACTIVE' && !isTarget && !isSender ? (
                    <button className="hunt-button hunt-cta" onClick={() => hunt(bounty)} aria-label={`Hunt ${bounty.targetName} for ${bounty.amount} Aura`}><Sword size={16} strokeWidth={1.8} /><span>Hunt · {bond} bond</span></button>
                  ) : isHunter && bounty.status === 'HUNTING' ? (
                    <button className="pressure-button" onClick={() => setPressureBounty(bounty)}><Target size={15} /><span>Send pressure</span></button>
                  ) : isHunter && proofArmed ? (
                    <div className="proof-armed-state"><ShieldCheck size={15} /><span>Waiting for credit</span></div>
                  ) : isTarget ? (
                    <div className={`bounty-owner-state ${proofArmed ? 'danger' : ''}`}>{proofArmed ? 'Pressure on you' : hunting ? 'Being hunted' : 'On you'}</div>
                  ) : isSender ? (
                    <div className="bounty-owner-state">Your bounty</div>
                  ) : hunting ? (
                    <div className="hunter-lock" title={bounty.hunterName ? `Hunted by ${bounty.hunterName}` : 'Hunter assigned'}><ShieldCheck size={16} /><span>{proofArmed ? 'Proof armed' : bounty.hunterName || 'Hunting'}</span></div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : tab === 'grudges' ? (
        <section className="arena-panel">
          <div className="arena-panel-head"><div><Flame size={18} strokeWidth={1.8} /><strong>Public grudges</strong></div><span className="arena-privacy-note">Claims are public until settled or expired</span></div>
          <div className="arena-list">
            {loading ? <div className="arena-empty">Loading beef…</div> : grudges.length === 0 ? <div className="arena-empty">Nobody has public beef right now. Suspiciously mature.</div> : grudges.map((grudge) => (
              <article className="bounty-item proof-armed-item" key={grudge.friendshipId}>
                <div className="bounty-avatar"><Flame size={17} /></div>
                <div className="bounty-copy">
                  <div className="bounty-title-row"><strong>{grudge.victimName} vs {grudge.claimantName}</strong><span className="bounty-status proof">GRUDGE</span></div>
                  <span>{grudge.claimantName} Claimed {grudge.originalClaimAmount} Aura from {grudge.victimName}. Revenge is live if the claimer slips.</span>
                  <small className="bounty-hunt-meta"><Clock3 size={12} /> {grudgeTimeLeft(grudge.expiresAt)}</small>
                </div>
                <div className="bounty-owner-state">Public</div>
              </article>
            ))}
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

      <CreateBountyModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} friendships={bankruptFriendships} onRefresh={loadArenaData} showToast={showToast} />
      <PressureMoveModal bounty={pressureBounty} moves={meta.pressureMoves || []} loading={pressureLoading} onClose={() => setPressureBounty(null)} onSend={sendPressure} />
    </div>
  );
};
