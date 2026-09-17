import React, { useState } from 'react';
import { Check, Clock3, Plus, X } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { NenCard } from '../../debt/components/NenCard';
import { respondToInvitation } from '../../../services/friendshipService';
import './ContractsView.css';

export const ContractsView = ({ user, friendships, pendingReceived, pendingSent, onAction, onAddFriend, onRefresh, showToast }) => {
  const [respondingId, setRespondingId] = useState(null);
  const userId = user.uid || user.id || user._id;

  const respond = async (friendship, action) => {
    const id = friendship._id || friendship.id;
    setRespondingId(id);
    const result = await respondToInvitation(id, action);
    if (result.success) {
      showToast?.(action === 'ACCEPT' ? 'Contract accepted' : 'Contract declined', 'SUCCESS');
      await onRefresh();
    } else {
      showToast?.(result.error || 'Could not update contract', 'ERROR');
    }
    setRespondingId(null);
  };

  return (
    <div className="contracts-view">
      <header className="contracts-header">
        <div>
          <p className="eyebrow">Contracts</p>
          <h1>Your people, with rules.</h1>
          <p>Each contract has its own grace period. Check in before the window closes and the debt stays at zero.</p>
        </div>
        <Button variant="aura" icon={Plus} onClick={onAddFriend}>New contract</Button>
      </header>

      {pendingReceived.length > 0 && (
        <section className="contract-section">
          <div className="contract-section-title">
            <h2>Waiting for you</h2>
            <span>{pendingReceived.length}</span>
          </div>
          <div className="invite-list">
            {pendingReceived.map((friendship) => {
              const inviter = friendship.user1;
              const id = friendship._id || friendship.id;
              return (
                <article className="invite-card" key={id}>
                  <div className="invite-avatar">{inviter?.displayName?.[0]?.toUpperCase() || '?'}</div>
                  <div className="invite-copy">
                    <strong>{inviter?.displayName || 'Someone'}</strong>
                    <span>{friendship.user2Perspective?.limit || 7}-day grace period</span>
                  </div>
                  <div className="invite-actions">
                    <button className="invite-action decline" disabled={respondingId === id} onClick={() => respond(friendship, 'DECLINE')} aria-label="Decline contract"><X size={17} /></button>
                    <button className="invite-action accept" disabled={respondingId === id} onClick={() => respond(friendship, 'ACCEPT')} aria-label="Accept contract"><Check size={17} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {pendingSent.length > 0 && (
        <section className="contract-section compact-section">
          <div className="contract-section-title"><h2>Waiting on them</h2></div>
          <div className="sent-list">
            {pendingSent.map((friendship) => (
              <div className="sent-row" key={friendship._id || friendship.id}>
                <Clock3 size={15} strokeWidth={1.8} />
                <span>{friendship.user2?.displayName || friendship.user2DisplayName}</span>
                <small>Pending</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="contract-section">
        <div className="contract-section-title">
          <h2>Active</h2>
          <span>{friendships.length}</span>
        </div>
        {friendships.length === 0 ? (
          <div className="contracts-empty">
            <p>No active contracts yet.</p>
            <Button variant="secondary" icon={Plus} onClick={onAddFriend}>Invite someone</Button>
          </div>
        ) : (
          <div className="contracts-grid">
            {friendships.map((friendship) => (
              <NenCard
                key={friendship._id || friendship.id}
                friendship={friendship}
                currentUserId={userId}
                onAction={onAction}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
