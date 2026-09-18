import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Plus, Swords, TriangleAlert, UserPlus, X } from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { ContractCard } from '../friendship/components/ContractCard';
import { getBankruptPartner } from '../friendship/contractState';
import './HomeView.css';

const contractState = (friendship, userId) => {
  const user1Id = friendship.user1?._id || friendship.user1;
  const perspective = String(user1Id) === String(userId) ? friendship.user1Perspective : friendship.user2Perspective;
  const limit = Number(perspective?.limit) || 7;
  const daysMissed = Math.floor(Math.max(0, Date.now() - new Date(perspective?.lastInteraction || Date.now())) / 86400000);
  const debt = (perspective?.baseDebt || 0) + Math.max(0, daysMissed - limit);
  return { debt, daysLeft: Math.max(0, limit - daysMissed), daysMissed };
};

const perspectiveFor = (friendship, userId) => {
  const user1Id = friendship.user1?._id || friendship.user1;
  return String(user1Id) === String(userId) ? friendship.user1Perspective : friendship.user2Perspective;
};

const partnerFor = (friendship, userId) => {
  const user1Id = friendship.user1?._id || friendship.user1;
  return String(user1Id) === String(userId) ? friendship.user2 : friendship.user1;
};

const WORLD_RULE_COPY = {
  DUO_RUSH: '+25% Duo XP',
  OPEN_MIC: 'Voice check-ins +10 XP',
  CLEAN_SWEEP: 'Check-ins +5 XP',
  ANOMALY_SEASON: 'Chaos cycles faster'
};

const priority = (friendship, userId) => {
  if (getBankruptPartner(friendship, userId)) return 60000;
  if (friendship.chaos?.activeEvent) return 50000;
  if (friendship.season?.status === 'COMPLETE') return 40000;
  const state = contractState(friendship, userId);
  if (state.debt > 0) return 10000 + state.debt * 100 + state.daysMissed;
  if (state.daysLeft <= 1) return 1000 + (1 - state.daysLeft) * 10;
  return -state.daysLeft;
};


export const HomeView = ({ user, friendships, pendingInvitations, pendingOutboundCount = 0, worldEvent, onAction, onAddFriend, onNavigate }) => {
  const userId = user.uid || user.id || user._id;
  const sorted = [...friendships].sort((a, b) => priority(b, userId) - priority(a, userId));
  const bankruptPartners = friendships.map((friendship) => getBankruptPartner(friendship, userId)).filter(Boolean);
  const hot = sorted.filter((friendship) => {
    const state = contractState(friendship, userId);
    return getBankruptPartner(friendship, userId) || friendship.chaos?.activeEvent || friendship.season?.status === 'COMPLETE' || state.debt > 0 || state.daysLeft <= 1;
  });
  const visible = (hot.length ? hot : sorted).slice(0, 3);
  const highestDuo = friendships.reduce((best, friendship) => (friendship.duoLevel || 1) > (best?.duoLevel || 0) ? friendship : best, null);
  const liveChaos = friendships.filter((friendship) => friendship.chaos?.activeEvent).length;
  const activeSeasons = friendships.filter((item) => item.season?.status === 'ACTIVE').length;
  const completeReports = friendships.filter((item) => item.season?.status === 'COMPLETE').length;
  const [, refreshBriefingState] = useState(0);
  const firstSeasonBriefing = useMemo(() => friendships.find((friendship) => {
    if (friendship.season?.status !== 'ACTIVE' || Number(friendship.season?.number || 1) !== 1) return false;
    if (Number(friendship.duoXP) > 0 || !friendship.season?.startedAt) return false;
    const age = Date.now() - new Date(friendship.season.startedAt).getTime();
    return age >= 0 && age <= 72 * 60 * 60 * 1000;
  }) || null, [friendships]);
  const briefingKey = firstSeasonBriefing
    ? `hakoware-season-briefing:${firstSeasonBriefing._id || firstSeasonBriefing.id}:1`
    : null;
  const showSeasonBriefing = Boolean(briefingKey && localStorage.getItem(briefingKey) !== 'seen');

  const dismissSeasonBriefing = () => {
    if (briefingKey) localStorage.setItem(briefingKey, 'seen');
    refreshBriefingState((value) => value + 1);
  };

  if (friendships.length === 0 && pendingInvitations.length > 0) {
    const invitation = pendingInvitations[0];
    const inviter = invitation?.user1?.username ? `@${invitation.user1.username}` : (invitation?.user1?.displayName || 'Someone');
    const mode = String(invitation?.templateId || 'DONT_GHOST').replaceAll('_', ' ').toLowerCase();
    return (
      <div className="home-view onboarding-home">
        <section className="first-contract-card pending-first-contract">
          <div className="first-contract-mark pending"><UserPlus size={24} strokeWidth={1.8} /></div>
          <p className="eyebrow">Challenge received</p>
          <h1>{inviter} put you under contract.</h1>
          <p className="first-contract-copy">They picked <strong>{mode}</strong>. Accept to start Season 1.</p>
          <Button variant="aura" icon={ArrowRight} onClick={() => onNavigate('contracts')}>Review challenge</Button>
          {pendingInvitations.length > 1 && <p className="pending-count-note">+{pendingInvitations.length - 1} more challenge{pendingInvitations.length === 2 ? '' : 's'} waiting</p>}
        </section>
      </div>
    );
  }

  if (friendships.length === 0 && pendingOutboundCount > 0) {
    return (
      <div className="home-view onboarding-home">
        <section className="first-contract-card pending-first-contract">
          <div className="first-contract-mark pending"><Clock3 size={24} strokeWidth={1.8} /></div>
          <p className="eyebrow">Challenge sent</p>
          <h1>Waiting on them.</h1>
          <p className="first-contract-copy">Season 1 starts when they accept.</p>
          <div className="first-contract-actions">
            <Button variant="secondary" onClick={() => onNavigate('contracts')}>View</Button>
            <Button variant="aura" icon={Plus} onClick={onAddFriend}>Start another</Button>
          </div>
        </section>
      </div>
    );
  }

  if (friendships.length === 0) {
    const identity = user.username ? `@${user.username}` : user.displayName;
    return (
      <div className="home-view onboarding-home">
        <section className="first-contract-card">
          <div className="first-contract-mark"><img src="/hakoware-mark-v2.png" alt="" /></div>
          <p className="eyebrow">You’re in, {identity}</p>
          <h1>Start with one person.</h1>
          <Button variant="aura" icon={Swords} onClick={onAddFriend}>Start a contract</Button>
          <div className="onboarding-rail" aria-label="How your first contract starts">
            <span><b>01</b> Pick a person</span>
            <span><b>02</b> Set the rules</span>
            <span><b>03</b> Survive the season</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="home-view">
      <header className="home-hero game-home-hero">
        <div>
          <p className="eyebrow">Your circle</p>
          <h1>{hot.length ? 'Something is happening.' : 'Everybody survived.'}</h1>
          <p>{hot.length ? `${hot.length} need${hot.length === 1 ? 's' : ''} attention.` : `${friendships.length} active · all clear.`}</p>
        </div>
        <button className="aura-chip" onClick={() => onNavigate('you')} aria-label={`${user.auraBalance || 0} Aura, open profile`}><span>{user.auraBalance || 0}</span> Aura</button>
      </header>

      {bankruptPartners.length > 0 && (() => {
        const visibleNames = bankruptPartners
          .slice(0, 2)
          .map(({ partner }) => partner?.displayName || 'Contract partner');
        const remaining = bankruptPartners.length - visibleNames.length;
        const names = `${visibleNames.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`;
        const one = bankruptPartners.length === 1;

        return (
          <button
            className="bankruptcy-alert-strip"
            type="button"
            onClick={() => onNavigate(one ? 'arena' : 'contracts')}
          >
            <span className="bankruptcy-alert-icon"><TriangleAlert size={19} strokeWidth={2} /></span>
            <span className="bankruptcy-alert-copy">
              <small>{one ? 'Partner bankrupt' : `${bankruptPartners.length} partners bankrupt`}</small>
              <strong>{names}</strong>
              <span>{one ? 'Bounties + Claim unlocked.' : 'Choose who to pressure.'}</span>
            </span>
            <ArrowRight size={17} strokeWidth={2} />
          </button>
        );
      })()}

      {showSeasonBriefing && firstSeasonBriefing && (() => {
        const partner = partnerFor(firstSeasonBriefing, userId);
        const partnerName = partner?.username ? `@${partner.username}` : (partner?.displayName || 'your partner');
        const limit = Number(perspectiveFor(firstSeasonBriefing, userId)?.limit) || 3;
        return (
          <section className="season-start-briefing">
            <span className="season-start-mark"><CheckCircle2 size={18} strokeWidth={1.9} /></span>
            <div className="season-start-copy">
              <span>SEASON 1 STARTED</span>
              <strong>You and {partnerName} are live.</strong>
              <p>Debt starts after {limit} day{limit === 1 ? '' : 's'} of silence.</p>
            </div>
            <button type="button" className="season-start-dismiss" onClick={dismissSeasonBriefing} aria-label="Dismiss Season 1 briefing"><X size={15} /></button>
          </section>
        );
      })()}


      {pendingInvitations.length > 0 && (
        <button className="pending-banner" onClick={() => onNavigate('contracts')}>
          <span><strong>{pendingInvitations.length}</strong> challenge{pendingInvitations.length === 1 ? '' : 's'} waiting</span>
          <ArrowRight size={17} strokeWidth={1.8} />
        </button>
      )}

      <div className="home-context-line" aria-label="Circle summary">
        <span><b>Strongest Duo</b> Lv. {highestDuo?.duoLevel || 1} · {highestDuo?.duoTitle || 'New Contract'}</span>
        <span><b>Active</b> {activeSeasons}</span>
        {completeReports > 0 && <span><b>Reports</b> {completeReports}</span>}
        {liveChaos > 0 && <span className="danger"><b>Chaos</b> {liveChaos} live</span>}
        {worldEvent && (
          <span className="world-rule">
            <b>{worldEvent.name}</b>
            <i>·</i>
            {WORLD_RULE_COPY[worldEvent.id] || worldEvent.description}
          </span>
        )}
      </div>

      <section className="home-section">
        <div className="section-heading">
          <div><p className="eyebrow">{hot.length ? 'Right now' : 'Active contracts'}</p><h2>{hot.length ? 'Needs attention.' : 'All clear.'}</h2></div>
          <button className="text-action" onClick={() => onNavigate('contracts')}>All contracts <ArrowRight size={15} /></button>
        </div>
        <div className="home-contract-list">
          {visible.map((friendship) => <ContractCard key={friendship._id || friendship.id} friendship={friendship} currentUserId={userId} onAction={onAction} />)}
        </div>
      </section>

      <div className="home-footer-action">
        <span>Grow the circle.</span>
        <button type="button" onClick={onAddFriend}><Plus size={15} /> New contract</button>
      </div>
    </div>
  );
};
