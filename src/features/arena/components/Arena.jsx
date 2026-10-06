import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Flame, Plus, Search, ShieldCheck, Sword, Target, Zap } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import { CreateBountyModal } from './CreateBountyModal';
import { PressureMoveModal } from './PressureMoveModal';
import { huntBounty, sendBountyPressure } from '../../../services/bountyService';
import { useAuth } from '../../../contexts/AuthContext';
import { calculateDebt } from '../../../hooks/useDebt';
import { getArenaSnapshot, peekArenaSnapshot } from '../../../services/prefetchService';
import { CardCollection } from '../../cards/CardCollection';
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

export const Arena = ({ friendships, showToast, onNavigate, focusTradeId, initialView = 'cards' }) => {
  const { user, refreshUser } = useAuth();
  const cachedArena = peekArenaSnapshot();
  const [tab, setTab] = useState(initialView);
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

  useEffect(() => { setTab(focusTradeId ? 'cards' : initialView); }, [initialView, focusTradeId]);

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
          <p className="eyebrow">Arena · A few tricks up your sleeve</p>
          <h1>{tab === 'cards' ? 'Small cards. Big energy.' : 'Make your move.'}</h1>
          <p>{tab === 'cards' ? 'Collect something you like. Trade with a friend. Put it to use.' : 'Keep an eye on the pressure. Every move has a consequence.'}</p>
        </div>
        {tab === 'bounties' && bankruptFriendships.length > 0 && (
          <Button variant="danger" icon={Plus} onClick={() => setShowCreateModal(true)}>
            Place bounty
          </Button>
        )}
      </header>


      {tab !== 'cards' && <div className="arena-meta-line" aria-label="Arena summary">
        <span><b>{hunterProfile.rank || 'Rookie Hunter'}</b> · {hunterProfile.rep || 0} Rep</span>
        <span><b>{openTargets}</b> open target{openTargets === 1 ? '' : 's'}</span>
        <span><b>{bountyPool}</b> Aura on the board</span>
        {grudges.length > 0 && <span><b>{grudges.length}</b> grudge{grudges.length === 1 ? '' : 's'}</span>}
        {activeAnomalies > 0 && <span className="danger"><b>{activeAnomalies}</b> live anomal{activeAnomalies === 1 ? 'y' : 'ies'}</span>}
      </div>}

      <div className="arena-tabs" role="tablist" aria-label="Arena views">
        <button className={tab === 'cards' ? 'active' : ''} onClick={() => { setTab('cards'); onNavigate?.('arena', { section: 'cards' }); }} role="tab" aria-selected={tab === 'cards'}>Cards</button>
        <button className={tab === 'bounties' ? 'active' : ''} onClick={() => { setTab('bounties'); onNavigate?.('arena', { section: 'bounties' }); }} role="tab" aria-selected={tab === 'bounties'}>Bounties</button>
        <button className={tab === 'grudges' ? 'active' : ''} onClick={() => { setTab('grudges'); onNavigate?.('arena', { section: 'grudges' }); }} role="tab" aria-selected={tab === 'grudges'}>Grudges {grudges.length ? `· ${grudges.length}` : ''}</button>
        <button className={tab === 'shame' ? 'active' : ''} onClick={() => { setTab('shame'); onNavigate?.('arena', { section: 'shame' }); }} role="tab" aria-selected={tab === 'shame'}>Shame {shame.length ? `· ${shame.length}` : ''}</button>
      </div>

      {tab === 'cards' ? <CardCollection friendships={friendships} showToast={showToast} focusTradeId={focusTradeId} /> : tab === 'bounties' ? (
        <section className="arena-panel">
          <div className="arena-panel-head">
            <div><Target size={18} strokeWidth={1.8} /><strong>Live hunts</strong></div>
            {bounties.length > 6 && (
              <label className="arena-search"><Search size={15} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a target" /></label>
            )}
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
              const isPartner = bounty.viewerRole === 'PARTNER';
              const wantedLabel = bounty.wantedState === 'MOST_WANTED'
                ? 'MOST WANTED'
                : bounty.wantedState === 'WANTED'
                  ? 'WANTED'
                  : null;
              const exposureLabel = wantedLabel
                ? `${wantedLabel}${bounty.targetBankrupt ? ' · BANKRUPT' : ''}`
                : bounty.targetBankrupt
                  ? 'BANKRUPT'
                  : null;
              const fundingBreakdown = bounty.chaosAmount > 0
                ? `${bounty.chaosAmount} Chaos${bounty.partnerAmount > 0 ? ` + ${bounty.partnerAmount} Partner` : ''}`
                : null;

              return (
                <article className={`arena-target-card ${proofArmed ? 'proof-armed-item' : hunting ? 'hunting-item' : ''} ${wantedLabel ? 'wanted-item' : ''}`} key={bounty._id || bounty.id}>
                  <UserAvatar
                    person={{ displayName: bounty.targetName, avatar: bounty.targetAvatar }}
                    size="lg"
                    className="arena-target-avatar"
                    decorative
                  />

                  <div className="arena-target-main">
                    <div className="arena-target-title">
                      <strong>{bounty.targetName}</strong>
                      <span className={`bounty-status ${proofArmed ? 'proof' : hunting ? 'hunting' : wantedLabel ? 'wanted' : 'open'}`}>
                        {proofArmed ? 'PROOF ARMED' : hunting ? 'HUNTER ASSIGNED' : exposureLabel || 'OPEN'}
                      </span>
                    </div>

                    <p>{bounty.message || (wantedLabel ? 'Check in to escape.' : 'Public bounty is live.')}</p>

                    <div className="arena-target-meta">
                      {fundingBreakdown && <span>{fundingBreakdown}</span>}
                      {hunting && <span><Clock3 size={12} /> {bounty.hunterName || 'Hunter'} · {window || `${meta.huntWindowHours || 12}h window`}</span>}
                    </div>
                  </div>

                  <div className="arena-target-side">
                    <div className="arena-target-reward" aria-label={`${bounty.amount} Aura bounty`}>
                      <Zap size={14} strokeWidth={1.8} />
                      <strong>{bounty.amount}</strong>
                      <small>Aura</small>
                    </div>

                    {bounty.status === 'ACTIVE' && !isTarget && !isSender && !isPartner ? (
                      <button className="arena-target-cta danger" onClick={() => hunt(bounty)} aria-label={`Hunt ${bounty.targetName} for ${bounty.amount} Aura`}>
                        <Sword size={15} strokeWidth={1.8} />
                        <span>Hunt · {bond}</span>
                      </button>
                    ) : isHunter && bounty.status === 'HUNTING' ? (
                      <button className="arena-target-cta" onClick={() => setPressureBounty(bounty)}>
                        <Target size={15} strokeWidth={1.8} />
                        <span>Pressure</span>
                      </button>
                    ) : isHunter && proofArmed ? (
                      <div className="arena-target-state"><ShieldCheck size={15} /><span>Waiting</span></div>
                    ) : isTarget ? (
                      <div className={`arena-target-state ${proofArmed ? 'danger' : ''}`}>{proofArmed ? 'Pressure on you' : hunting ? 'Being hunted' : 'On you'}</div>
                    ) : isSender ? (
                      <div className="arena-target-state">{bounty.chaosAmount > 0 ? 'Your boost' : 'Your bounty'}</div>
                    ) : isPartner ? (
                      <div className="arena-target-state">Your contract</div>
                    ) : hunting ? (
                      <div className="arena-target-state"><ShieldCheck size={15} /><span>{proofArmed ? 'Proof armed' : bounty.hunterName || 'Hunting'}</span></div>
                    ) : null}
                  </div>
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
              <article className="arena-grudge-card" key={`${grudge.claimantName}:${grudge.victimName}:${grudge.createdAt}`}>
                <div className="arena-grudge-avatars" aria-hidden="true">
                  <UserAvatar
                    person={{ displayName: grudge.victimName, avatar: grudge.victimAvatar }}
                    size="lg"
                    className="arena-grudge-avatar victim"
                    decorative
                  />
                  <UserAvatar
                    person={{ displayName: grudge.claimantName, avatar: grudge.claimantAvatar }}
                    size="sm"
                    className="arena-grudge-avatar claimant"
                    decorative
                  />
                </div>

                <div className="arena-grudge-main">
                  <div className="arena-target-title">
                    <strong>{grudge.victimName}</strong>
                    <span className="bounty-status proof">GRUDGE</span>
                  </div>
                  <p><b>{grudge.claimantName}</b> took {grudge.originalClaimAmount} Aura.</p>
                  <span><Clock3 size={12} /> {grudgeTimeLeft(grudge.expiresAt)} · revenge if {grudge.claimantName} goes bankrupt</span>
                </div>

                <div className="arena-grudge-amount">
                  <Flame size={14} strokeWidth={1.8} />
                  <strong>{grudge.originalClaimAmount}</strong>
                  <small>Aura claimed</small>
                </div>
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
                <UserAvatar person={person} size="sm" className="bounty-avatar user-avatar-round" decorative />
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
