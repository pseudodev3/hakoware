import React from 'react';
import { ArrowRight, Clock3, Dice5, Flame, Plus, Sparkles, Swords, TriangleAlert, Trophy, UserPlus, UsersRound } from 'lucide-react';
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

const priority = (friendship, userId) => {
  if (getBankruptPartner(friendship, userId)) return 60000;
  if (friendship.chaos?.activeEvent) return 50000;
  if (friendship.season?.status === 'COMPLETE') return 40000;
  const state = contractState(friendship, userId);
  if (state.debt > 0) return 10000 + state.debt * 100 + state.daysMissed;
  if (state.daysLeft <= 1) return 1000 + (1 - state.daysLeft) * 10;
  return -state.daysLeft;
};

const worldIcon = (worldEvent) => worldEvent?.id === 'ANOMALY_SEASON' ? Dice5 : worldEvent?.id === 'OPEN_MIC' ? Sparkles : worldEvent?.id === 'DUO_RUSH' ? UsersRound : Flame;

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
  const WorldIcon = worldIcon(worldEvent);

  if (friendships.length === 0 && pendingInvitations.length > 0) {
    const invitation = pendingInvitations[0];
    const inviter = invitation?.user1?.displayName || 'Someone';
    const mode = String(invitation?.templateId || 'DONT_GHOST').replaceAll('_', ' ').toLowerCase();
    return (
      <div className="home-view onboarding-home">
        <section className="first-contract-card pending-first-contract">
          <div className="first-contract-mark pending"><UserPlus size={24} strokeWidth={1.8} /></div>
          <p className="eyebrow">Challenge received</p>
          <h1>{inviter} put you under contract.</h1>
          <p className="first-contract-copy">They picked <strong>{mode}</strong>. Accept it and Season 1 starts immediately—Duo XP, debt, Arena pressure and all.</p>
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
          <h1>The game starts when they accept.</h1>
          <p className="first-contract-copy">Your contract is saved. Once they join, Season 1 starts and Hakoware begins keeping score between you.</p>
          <div className="first-contract-actions">
            <Button variant="secondary" onClick={() => onNavigate('contracts')}>View request</Button>
            <Button variant="aura" icon={Plus} onClick={onAddFriend}>Start another</Button>
          </div>
        </section>
      </div>
    );
  }

  if (friendships.length === 0) {
    return (
      <div className="home-view onboarding-home">
        <section className="first-contract-card">
          <div className="first-contract-mark"><img src="/hakoware-mark-v2.png" alt="" /></div>
          <p className="eyebrow">Start the game</p>
          <h1>Pick a person. Pick your poison.</h1>
          <p className="first-contract-copy">Choose a contract mode, invite someone you actually care about, then survive the season together. Check-ins build Duo XP. Silence builds debt. Chaos makes its own rules.</p>
          <Button variant="aura" icon={Swords} onClick={onAddFriend}>Choose a contract</Button>
          <div className="onboarding-rail" aria-label="How Hakoware works">
            <span><b>01</b> Choose a game mode</span>
            <span><b>02</b> Build your Duo level</span>
            <span><b>03</b> Survive the season</span>
          </div>
        </section>
        <section className="home-note"><Sparkles size={17} strokeWidth={1.8} /><p>You start with <strong>{user.auraBalance || 0} Aura</strong>. Don’t waste it.</p></section>
      </div>
    );
  }

  return (
    <div className="home-view">
      <header className="home-hero game-home-hero">
        <div>
          <p className="eyebrow">Your circle</p>
          <h1>{hot.length ? 'Something is happening.' : 'Everybody survived.'}</h1>
          <p>{hot.length ? `${hot.length} contract${hot.length === 1 ? '' : 's'} need attention right now.` : `${friendships.length} active contract${friendships.length === 1 ? '' : 's'} · no immediate fires.`}</p>
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
              <span>{one ? 'Bounties and Claim are unlocked.' : 'Open Contracts to choose who to pressure.'}</span>
            </span>
            <ArrowRight size={17} strokeWidth={2} />
          </button>
        );
      })()}

      {worldEvent && (
        <section className="world-event-card">
          <span className="world-event-icon"><WorldIcon size={19} strokeWidth={1.9} /></span>
          <div><span className="world-label">LIVE WORLD EVENT · {worldEvent.theme}</span><strong>{worldEvent.name}</strong><p>{worldEvent.description}</p></div>
          <span className="world-live">LIVE</span>
        </section>
      )}

      {pendingInvitations.length > 0 && (
        <button className="pending-banner" onClick={() => onNavigate('contracts')}>
          <span><strong>{pendingInvitations.length}</strong> new challenge{pendingInvitations.length === 1 ? '' : 's'} waiting</span>
          <ArrowRight size={17} strokeWidth={1.8} />
        </button>
      )}

      <section className="home-game-summary">
        <div><span className="summary-icon"><UsersRound size={17} /></span><small>Strongest Duo</small><strong>Lv. {highestDuo?.duoLevel || 1}</strong><p>{highestDuo?.duoTitle || 'New Contract'}</p></div>
        <div><span className="summary-icon"><Trophy size={17} /></span><small>Active seasons</small><strong>{friendships.filter((item) => item.season?.status === 'ACTIVE').length}</strong><p>{friendships.filter((item) => item.season?.status === 'COMPLETE').length} reports ready</p></div>
        <div className={liveChaos ? 'hot' : ''}><span className="summary-icon"><Dice5 size={17} /></span><small>Live anomalies</small><strong>{liveChaos}</strong><p>{liveChaos ? 'Chaos is awake' : 'Quiet for now'}</p></div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div><p className="eyebrow">{hot.length ? 'Right now' : 'Active contracts'}</p><h2>{hot.length ? 'Handle these first.' : 'The circle is holding.'}</h2></div>
          <button className="text-action" onClick={() => onNavigate('contracts')}>All contracts <ArrowRight size={15} /></button>
        </div>
        <div className="home-contract-list">
          {visible.map((friendship) => <ContractCard key={friendship._id || friendship.id} friendship={friendship} currentUserId={userId} onAction={onAction} />)}
        </div>
      </section>

      <section className="home-footer-action">
        <div><p className="eyebrow">Add fuel</p><h3>One more person changes the whole circle.</h3></div>
        <Button variant="secondary" icon={Plus} onClick={onAddFriend}>New contract</Button>
      </section>
    </div>
  );
};
