import React from 'react';
import { ArrowRight, Clock3, Plus, Sparkles, UserPlus } from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { NenCard } from '../debt/components/NenCard';
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
  const state = contractState(friendship, userId);
  if (state.debt > 0) return 10000 + state.debt * 100 + state.daysMissed;
  if (state.daysLeft <= 1) return 1000 + (1 - state.daysLeft) * 10;
  return -state.daysLeft;
};

export const HomeView = ({ user, friendships, pendingInvitations, pendingOutboundCount = 0, onAction, onAddFriend, onNavigate }) => {
  const userId = user.uid || user.id || user._id;
  const sorted = [...friendships].sort((a, b) => priority(b, userId) - priority(a, userId));
  const needsAttention = sorted.filter((friendship) => {
    const state = contractState(friendship, userId);
    return state.debt > 0 || state.daysLeft <= 1;
  }).slice(0, 3);
  const visible = needsAttention.length ? needsAttention : sorted.slice(0, 3);

  if (friendships.length === 0 && pendingInvitations.length > 0) {
    const inviter = pendingInvitations[0]?.user1?.displayName || 'Someone';
    return (
      <div className="home-view">
        <section className="first-contract-card pending-first-contract">
          <div className="first-contract-mark pending"><UserPlus size={24} strokeWidth={1.7} /></div>
          <p className="eyebrow">Contract waiting</p>
          <h1>{inviter} wants to start something with you.</h1>
          <p className="first-contract-copy">Review the grace period and decide whether to accept. Nothing starts counting until you do.</p>
          <Button variant="aura" icon={ArrowRight} onClick={() => onNavigate('contracts')}>Review request</Button>
          {pendingInvitations.length > 1 && <p className="pending-count-note">+{pendingInvitations.length - 1} more request{pendingInvitations.length === 2 ? '' : 's'} waiting</p>}
        </section>
      </div>
    );
  }

  if (friendships.length === 0 && pendingOutboundCount > 0) {
    return (
      <div className="home-view">
        <section className="first-contract-card pending-first-contract">
          <div className="first-contract-mark pending"><Clock3 size={24} strokeWidth={1.7} /></div>
          <p className="eyebrow">In motion</p>
          <h1>Your first contract is waiting on them.</h1>
          <p className="first-contract-copy">The request is saved. Once they accept, the grace period starts and this becomes part of your active circle.</p>
          <div className="first-contract-actions">
            <Button variant="secondary" onClick={() => onNavigate('contracts')}>View request</Button>
            <Button variant="aura" icon={Plus} onClick={onAddFriend}>Invite another</Button>
          </div>
        </section>
      </div>
    );
  }

  if (friendships.length === 0) {
    return (
      <div className="home-view">
        <section className="first-contract-card">
          <div className="first-contract-mark"><img src="/hakoware-mark.svg" alt="" /></div>
          <p className="eyebrow">Your first contract</p>
          <h1>Hakoware gets interesting when someone else is in it.</h1>
          <p className="first-contract-copy">Start with one person you actually want to stay close to. Pick a grace period, send the request, then let the system keep score quietly.</p>
          <Button variant="aura" icon={Plus} onClick={onAddFriend}>Start a contract</Button>
          <div className="onboarding-rail" aria-label="How Hakoware works">
            <span><b>01</b> Invite someone</span>
            <span><b>02</b> Check in</span>
            <span><b>03</b> Miss the window, gain debt</span>
          </div>
        </section>

        <section className="home-note">
          <Sparkles size={17} strokeWidth={1.8} />
          <p>You have <strong>{user.auraBalance || 0} Aura</strong>. Aura matters once your contracts start moving.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="home-view">
      <header className="home-hero">
        <div>
          <p className="eyebrow">Home</p>
          <h1>Hey, {user.displayName}.</h1>
          <p>{needsAttention.length ? `${needsAttention.length} contract${needsAttention.length === 1 ? '' : 's'} need your attention.` : 'Your contracts are in good shape.'}</p>
        </div>
        <button className="aura-chip" onClick={() => onNavigate('you')} aria-label={`${user.auraBalance || 0} Aura, open profile`}>
          <span>{user.auraBalance || 0}</span> Aura
        </button>
      </header>

      {pendingInvitations.length > 0 && (
        <button className="pending-banner" onClick={() => onNavigate('contracts')}>
          <span><strong>{pendingInvitations.length}</strong> contract request{pendingInvitations.length === 1 ? '' : 's'} waiting</span>
          <ArrowRight size={17} strokeWidth={1.8} />
        </button>
      )}

      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{needsAttention.length ? 'Needs attention' : 'Your circle'}</p>
            <h2>{needsAttention.length ? 'Don’t let these drift.' : 'Everything is quiet.'}</h2>
          </div>
          <button className="text-action" onClick={() => onNavigate('contracts')}>All contracts <ArrowRight size={15} /></button>
        </div>
        <div className="home-contract-list">
          {visible.map((friendship) => (
            <NenCard
              key={friendship._id || friendship.id}
              friendship={friendship}
              currentUserId={userId}
              onAction={onAction}
            />
          ))}
        </div>
      </section>

      <section className="home-footer-action">
        <div>
          <p className="eyebrow">Grow the circle</p>
          <h3>One more person changes the game.</h3>
        </div>
        <Button variant="secondary" icon={Plus} onClick={onAddFriend}>New contract</Button>
      </section>
    </div>
  );
};
