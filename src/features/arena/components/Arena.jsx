import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Flame, Plus, Search, ShieldCheck, Sword, Target, Zap } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { CreateBountyModal } from './CreateBountyModal';
import { PressureMoveModal } from './PressureMoveModal';
import { huntBounty, sendBountyPressure } from '../../../services/bountyService';
import { useAuth } from '../../../contexts/AuthContext';
import { calculateDebt } from '../../../hooks/useDebt';
import { getArenaSnapshot, peekArenaSnapshot } from '../../../services/prefetchService';
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

export const Arena = ({ friendships, showToast }) => {
  const { user, refreshUser } = useAuth();
  const cachedArena = peekArenaSnapshot();
  const [tab, setTab] = useState('bounties');
  const [bounties, setBounties] = useState(cachedArena?.bounties || []);
  const [shame, setShame] = useState(cachedArena?.shame || []);
  const [grudges, setGrudges] = useState(cachedArena?.grudges || []);
  const [hunterProfile, setHunterProfile] = useState(cachedArena?.hunterProfile || { rep: 0, rank: 'Rookie Hunter', successfulHunts: 0, attempts: 0, conversionRate: 0, auraCollected: 0, activeHunts: 0 });
  const [meta, setMeta] = useState(cachedArena?.meta || { pressureMoves: [], huntWindowHours: 12 });
  const [loading, setLoading] = useState(!cachedArena);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pressureBounty, setPressureBounty] = useState(null);
  const [pressureLoading, setPressureLoading] = useState(false);
  const userId = String(user.uid || user.id || user._id);

  const loadArenaData = async ({ force = true, silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const snapshot = await getArenaSnapshot({ force });
      setBounties(snapshot.bounties || []);
      setShame(snapshot.shame || []);
      setHunterProfile(snapshot.hunterProfile || {});
      setMeta(snapshot.meta || { pressureMoves: [], huntWindowHours: 12 });
      setGrudges(snapshot.grudges || []);
    } catch (error) {
      console.error('Failed to load Arena:', error);
      if (!silent) showToast?.(error.message || 'Could not load Arena', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const warm = Boolean(peekArenaSnapshot());
    void loadArenaData({ force: warm, silent: warm });
  }, []);

  const filtered = useMemo(
    () => bounties.filter((bounty) => bounty.targetName?.toLowerCase().includes(search.toLowerCase())),
    [bounties, search]
  );
  const bankruptFriendships = useMemo(
    () => friendships.filter((friendship) => {
      if (friendship.season?.status === 'COMPLETE') return false;
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
      showToast?.(`Hunt started · ${bond} Aura staked. Send pressure next.`, 'SUCCESS');
      await Promise.all([loadArenaData({ force: true }), refreshUser()]);
    } catch (error) {
      showToast?.(error.message || 'Could not start hunt', 'ERROR');
    }
  };

  const sendPressure = async (moveId) => {
    if (!pressureBounty) return;
    setPressureLoading(true);
    try {
      await sendBountyPressure(pressureBounty._id || pressureBounty.id, moveId);
      showToast?.('Pressure sent · proof armed', 'SUCCESS');
      setPressureBounty(null);
      await loadArenaData({ force: true });
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
          <h1>Bankruptcy opens the Arena.</h1>
          <p>Post Aura on a bankrupt partner. Hunters stake a bond, send pressure, and only get paid if the target credits them.</p>
        </div>
        <Button variant="danger" icon={Plus} onClick={() => setShowCreateModal(true)} disabled={bankruptFriendships.length === 0}>
          {bankruptFriendships.length === 0 ? 'No bankrupt targets' : 'Place bounty'}
        </Button>
      </header>


      <div className="arena-meta-line" aria-label="Arena summary">
        <span><b>{hunterProfile.rank || 'Rookie Hunter'}</b> · {hunterProfile.rep || 0} Rep · {hunterProfile.successfulHunts || 0} closes</span>
        <span><b>{hunterProfile.auraCollected || 0}</b> Aura collected</span>
        <span><b>{openTargets}</b> open target{openTargets === 1 ? '' : 's'}</span>
        <span><b>{bountyPool}</b> Aura in escrow</span>
        {grudges.length > 0 && <span><b>{grudges.length}</b> grudge{grudges.length === 1 ? '' : 's'}</span>}
        {activeAnomalies > 0 && <span className="danger"><b>{activeAnomalies}</b> live anomal{activeAnomalies === 1 ? 'y' : 'ies'}</span>}
      </div>

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
            {loading ? <div className="arena-empty">Loading Arena…</div> : filtered.length === 0 ? <div className="arena-empty">{search ? 'No matching targets.' : 'No active bounties.'}</div> : filtered.map((bounty) => {
              const isTarget = bounty.viewerRole ? bounty.viewerRole === 'TARGET' : String(bounty.targetId) === userId;
              const isSender = bounty.viewerRole ? bounty.viewerRole === 'SENDER' : String(bounty.senderId) === userId;
              const isHunter = bounty.viewerRole ? bounty.viewerRole === 'HUNTER' : String(bounty.hunterId || '') === userId;
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
            {loading ? <div className="arena-empty">Loading beef…</div> : grudges.length === 0 ? <div className="arena-empty">No public Grudges.</div> : grudges.map((grudge) => (
              <article className="bounty-item proof-armed-item" key={`${grudge.claimantName}:${grudge.victimName}:${grudge.createdAt}`}>
                <div className="bounty-avatar"><Flame size={17} /></div>
                <div className="bounty-copy">
                  <div className="bounty-title-row"><strong>{grudge.victimName} vs {grudge.claimantName}</strong><span className="bounty-status proof">GRUDGE</span></div>
                  <span>{grudge.claimantName} Claimed {grudge.originalClaimAmount} Aura from {grudge.victimName}. Revenge opens if they go bankrupt.</span>
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
              <article className="shame-item-new" key={person.username || `${person.displayName}:${index}`}>
                <span className="shame-rank">{String(index + 1).padStart(2, '0')}</span>
                <div className="bounty-avatar">{person.displayName?.[0]?.toUpperCase() || '?'}</div>
                <div className="bounty-copy"><strong>{person.displayName}</strong><span>{person.username ? `@${person.username}` : 'Hakoware player'}</span></div>
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
