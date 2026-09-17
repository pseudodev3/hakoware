import React from 'react';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { NenCard } from '../debt/components/NenCard';
import './HomeView.css';

const urgency = (friendship, userId) => {
  const user1Id = friendship.user1?._id || friendship.user1;
  const perspective = String(user1Id) === String(userId) ? friendship.user1Perspective : friendship.user2Perspective;
  const limit = Number(perspective?.limit) || 7;
  const days = Math.floor(Math.max(0, Date.now() - new Date(perspective?.lastInteraction || Date.now())) / 86400000);
  const debt = (perspective?.baseDebt || 0) + Math.max(0, days - limit);
  return debt * 100 + days;
};

export const HomeView = ({ user, friendships, pendingInvitations, onAction, onAddFriend, onNavigate }) => {
  const userId = user.uid || user.id || user._id;
  const sorted = [...friendships].sort((a, b) => urgency(b, userId) - urgency(a, userId));
  const needsAttention = sorted.filter((friendship) => urgency(friendship, userId) >= 6).slice(0, 3);
  const visible = needsAttention.length ? needsAttention : sorted.slice(0, 3);

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
