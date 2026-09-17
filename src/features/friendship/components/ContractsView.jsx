import React, { useMemo, useState } from 'react';
import { Check, Clock3, Dice5, Mail, Plus, Swords, X } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { ContractCard } from './ContractCard';
import { respondToInvitation } from '../../../services/friendshipService';
import './ContractsView.css';

const FALLBACK_NAMES = {
  DONT_GHOST: "Don't Ghost Me",
  GYM_PACT: 'Gym Pact',
  STUDY_ARC: 'Study Arc',
  LOCK_IN: '30-Day Lock-In',
  LONG_DISTANCE: 'Long Distance',
  BUILD_IN_PUBLIC: 'Build in Public',
  CHAOS: 'Chaos Contract',
  CUSTOM: 'Custom'
};

export const ContractsView = ({ user, friendships, pendingReceived, pendingSent, pendingExternal = [], templates = [], worldEvent, onAction, onAddFriend, onRefresh, showToast }) => {
  const [respondingId, setRespondingId] = useState(null);
  const userId = user.uid || user.id || user._id;
  const waitingOnThem = pendingSent.length + pendingExternal.length;
  const modeNames = useMemo(() => Object.fromEntries(templates.map((item) => [item.id, item.name])), [templates]);
  const modeName = (id) => modeNames[id] || FALLBACK_NAMES[id] || FALLBACK_NAMES.DONT_GHOST;
  const completeSeasons = friendships.filter((item) => item.season?.status === 'COMPLETE').length;
  const chaosContracts = friendships.filter((item) => item.templateId === 'CHAOS').length;

  const respond = async (friendship, action) => {
    const id = friendship._id || friendship.id;
    setRespondingId(id);
    const result = await respondToInvitation(id, action);
    if (result.success) {
      showToast?.(action === 'ACCEPT' ? 'Season 1 started' : 'Challenge declined', 'SUCCESS');
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
          <h1>Your roster.</h1>
          <p>Every relationship is its own season. Build Duo XP, survive the rules, and keep the report respectable.</p>
        </div>
        <Button variant="aura" icon={Plus} onClick={onAddFriend}>New contract</Button>
      </header>

      <section className="contracts-overview">
        <div><small>Active</small><strong>{friendships.length}</strong><span>contracts in play</span></div>
        <div><small>Reports ready</small><strong>{completeSeasons}</strong><span>seasons complete</span></div>
        <div className={chaosContracts ? 'chaos' : ''}><small>Chaos</small><strong>{chaosContracts}</strong><span>{chaosContracts ? 'unstable contracts' : 'none active'}</span></div>
      </section>

      {worldEvent && (
        <div className="contracts-world-strip">
          <Swords size={15} strokeWidth={1.9} />
          <span><strong>{worldEvent.name}</strong> · {worldEvent.description}</span>
          <b>{worldEvent.theme}</b>
        </div>
      )}

      {pendingReceived.length > 0 && (
        <section className="contract-section">
          <div className="contract-section-title"><h2>Challenges waiting for you</h2><span>{pendingReceived.length}</span></div>
          <div className="invite-list">
            {pendingReceived.map((friendship) => {
              const inviter = friendship.user1;
              const id = friendship._id || friendship.id;
              const chaos = friendship.templateId === 'CHAOS';
              return (
                <article className={`invite-card ${chaos ? 'chaos' : ''}`} key={id}>
                  <div className="invite-avatar">{chaos ? <Dice5 size={18} /> : inviter?.displayName?.[0]?.toUpperCase() || '?'}</div>
                  <div className="invite-copy">
                    <strong>{inviter?.displayName || 'Someone'}</strong>
                    <span>{modeName(friendship.templateId)} · {friendship.user2Perspective?.limit || 7}-day rule</span>
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

      {waitingOnThem > 0 && (
        <section className="contract-section compact-section">
          <div className="contract-section-title"><h2>Waiting on them</h2><span>{waitingOnThem}</span></div>
          <div className="sent-list">
            {pendingSent.map((friendship) => (
              <div className="sent-row" key={friendship._id || friendship.id}>
                <Clock3 size={15} strokeWidth={1.8} />
                <div><span>{friendship.user2?.displayName || friendship.user2DisplayName}</span><small>{modeName(friendship.templateId)}</small></div>
                <b>Pending</b>
              </div>
            ))}
            {pendingExternal.map((invite) => (
              <div className="sent-row" key={invite.id}>
                <Mail size={15} strokeWidth={1.8} />
                <div><span>{invite.recipientEmail}</span><small>{modeName(invite.templateId)}</small></div>
                <b>Invite sent</b>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="contract-section active-contract-section">
        <div className="contract-section-title"><h2>In play</h2><span>{friendships.length}</span></div>
        {friendships.length === 0 ? (
          <div className="contracts-empty"><Swords size={24} strokeWidth={1.6} /><p>No active seasons yet.</p><Button variant="secondary" icon={Plus} onClick={onAddFriend}>Choose a mode</Button></div>
        ) : (
          <div className="contracts-grid">
            {friendships.map((friendship) => <ContractCard key={friendship._id || friendship.id} friendship={friendship} currentUserId={userId} onAction={onAction} />)}
          </div>
        )}
      </section>
    </div>
  );
};
