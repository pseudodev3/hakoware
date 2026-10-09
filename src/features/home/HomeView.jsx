import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock3, Plus, Radio, Swords, UserPlus, X } from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { respondToInvitation } from '../../services/friendshipService';
import { FriendCard } from '../friendship/components/FriendCard';
import { HomePlay } from './HomePlay';
import { getBankruptPartner, getContractSides } from '../friendship/contractState';
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

const priority = (friendship, userId, socialContracts = {}) => {
  const social = socialContracts?.[friendship._id || friendship.id];
  const { ownDebt } = getContractSides(friendship, userId);
  if (getBankruptPartner(friendship, userId) || ownDebt?.isBankrupt) return 60000;
  if (friendship.chaos?.wantedUserId && friendship.chaos?.wantedUntil) return 55000;
  if (friendship.chaos?.activeEvent) return 50000;
  if (social?.unseenActivity?.some((item) => item.type === 'MESSAGE')) return 49500;
  if (friendship.season?.status === 'COMPLETE') return 49000;
  if (ownDebt?.isRecovering) return 48000;
  const state = contractState(friendship, userId);
  if (state.debt > 0) return 47000 + Math.min(state.debt, 9) * 100;
  if (social?.moment?.status === 'OPEN') return 46000;
  if (social?.mutualMenace) return 44000;
  if (social?.firstMutualCheckin) return 30000;
  if (social?.unseenActivity?.length) return 20000;
  if (social?.moment?.status === 'BREWING') return 1500;
  if (state.daysLeft <= 1) return 1000 + (1 - state.daysLeft) * 10;
  return -state.daysLeft;
};


export const HomeView = ({ user, friendships, pendingInvitations, pendingOutboundCount = 0, worldEvent, onAction, onAddFriend, onNavigate, onRefresh, showToast, socialPresence = { pulse: [], contracts: {} }, onActivitySeen, onOpenFriend, onAcceptedFriend }) => {
  const userId = user.uid || user.id || user._id;
  const socialContracts = socialPresence?.contracts || {};
  const newestActivityAt = (friendship) => {
    const state = socialContracts[friendship._id || friendship.id];
    return new Date(state?.firstMutualCheckin?.createdAt || state?.unseenActivity?.[0]?.createdAt || 0).getTime();
  };
  const sorted = [...friendships].sort((a, b) => priority(b, userId, socialContracts) - priority(a, userId, socialContracts)
    || newestActivityAt(b) - newestActivityAt(a));
  const hot = sorted.filter((friendship) => {
    const state = contractState(friendship, userId);
    const social = socialContracts?.[friendship._id || friendship.id];
    return getBankruptPartner(friendship, userId)
      || getContractSides(friendship, userId).ownDebt?.isBankrupt
      || getContractSides(friendship, userId).ownDebt?.isRecovering
      || (friendship.chaos?.wantedUserId && friendship.chaos?.wantedUntil)
      || friendship.chaos?.activeEvent
      || social?.moment?.status === 'OPEN'
      || Boolean(social?.mutualMenace)
      || friendship.season?.status === 'COMPLETE'
      || state.debt > 0
      || state.daysLeft <= 1;
  });
  const [showAllPulse, setShowAllPulse] = useState(false);
  const visible = sorted.slice(0, 3);
  const hasNewUpdates = sorted.some((item) => {
    const social = socialContracts[item._id || item.id];
    return social?.firstMutualCheckin || social?.unseenActivity?.length;
  });
  const highestDuo = friendships.reduce((best, friendship) => (friendship.duoLevel || 1) > (best?.duoLevel || 0) ? friendship : best, null);
  const liveChaos = friendships.filter((friendship) => friendship.chaos?.activeEvent).length;
  const activeSeasons = friendships.filter((item) => item.season?.status === 'ACTIVE').length;
  const completeReports = friendships.filter((item) => item.season?.status === 'COMPLETE').length;
  const [, refreshBriefingState] = useState(0);
  const [respondingInviteId, setRespondingInviteId] = useState(null);
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

  const previewedMessageIds = new Set(visible.map((friendship) => socialContracts[friendship._id || friendship.id]?.lastMessage?.id).filter(Boolean));
  // Only the exact latest message is already represented above. Older replies
  // and messages from friends outside these three cards stay in this list.
  const pulse = (socialPresence?.pulse || []).filter((item) => item.type !== 'MESSAGE' || !previewedMessageIds.has(item.id));
  const shownPulse = showAllPulse ? pulse : pulse.slice(0, 4);

  const openPulse = (item) => {
    const friendship = friendships.find((entry) => String(entry._id || entry.id) === String(item.friendshipId));
    if (friendship) onOpenFriend?.(friendship, { focusEventId: item.id });
  };

  const pulseTime = (value) => {
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    if (diff < 60 * 1000) return 'now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m`;
    return `${Math.floor(diff / 3600000)}h`;
  };

  const dismissSeasonBriefing = () => {
    if (briefingKey) localStorage.setItem(briefingKey, 'seen');
    refreshBriefingState((value) => value + 1);
  };

  const respondToPending = async (invitation, action) => {
    const id = invitation?._id || invitation?.id;
    if (!id || respondingInviteId) return;
    setRespondingInviteId(id);
    const result = await respondToInvitation(id, action);
    if (result.success) {
      showToast?.(action === 'ACCEPT' ? 'Contract accepted.' : 'Contract declined.', 'SUCCESS');
      const refreshedContracts = await onRefresh?.();
      if (action === 'ACCEPT') onAcceptedFriend?.(invitation, refreshedContracts);
    } else {
      showToast?.(result.error || 'Could not update contract', 'ERROR');
    }
    setRespondingInviteId(null);
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
          <div className="first-contract-actions">
            <Button
              variant="secondary"
              disabled={respondingInviteId === (invitation._id || invitation.id)}
              onClick={() => respondToPending(invitation, 'DECLINE')}
            >
              Decline
            </Button>
            <Button
              variant="aura"
              icon={ArrowRight}
              loading={respondingInviteId === (invitation._id || invitation.id)}
              onClick={() => respondToPending(invitation, 'ACCEPT')}
            >
              Accept & start
            </Button>
          </div>
          {pendingInvitations.length > 1 && (
            <button className="pending-count-note pending-count-button" type="button" onClick={() => onNavigate('contracts')}>
              +{pendingInvitations.length - 1} more challenge{pendingInvitations.length === 2 ? '' : 's'} waiting · Review all
            </button>
          )}
        </section>
        <HomePlay user={user} onNavigate={onNavigate} />
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
        <HomePlay user={user} onNavigate={onNavigate} />
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
          <div className="first-contract-actions">
            <Button variant="aura" icon={Swords} onClick={onAddFriend}>Add a friend</Button>
            <Button variant="secondary" icon={Radio} onClick={() => onNavigate('afterHours')}>After Hours</Button>
          </div>
          <p className="onboarding-short-rule">Invite someone you know, or meet someone in After Hours. Your conversation starts when they accept.</p>
        </section>
        <HomePlay user={user} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="home-view circle-first-home crew-home">
      <header className="circle-first-header">
        <div className="circle-first-title">
          <h1>Your circle</h1>
          <p>{hot.length ? 'A few things to catch up on.' : hasNewUpdates ? 'Pick up where you left off.' : 'Make time for your people.'}</p>
        </div>
        <div className="home-crew-sigil" aria-hidden="true"><img src="/textures/hakoware-crew-mark.webp" alt="" /></div>
      </header>

      {pendingInvitations.length > 0 && (() => {
        const invitation = pendingInvitations[0];
        const id = invitation?._id || invitation?.id;
        const inviter = invitation?.user1?.username
          ? `@${invitation.user1.username}`
          : (invitation?.user1?.displayName || 'Someone');
        return (
          <div className="circle-pending-link">
            <span><strong>{inviter}</strong> challenged you{pendingInvitations.length > 1 ? ` · +${pendingInvitations.length - 1}` : ''}</span>
            <div>
              <button type="button" className="circle-pending-review" onClick={() => onNavigate('contracts')}>Review</button>
              <button
                type="button"
                className="circle-pending-accept"
                disabled={respondingInviteId === id}
                onClick={() => respondToPending(invitation, 'ACCEPT')}
              >
                {respondingInviteId === id ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          </div>
        );
      })()}

      <div className="home-hangout">
        <section className="home-friends" aria-label="Conversations">
          <div className="circle-contracts crew-conversations">{visible.map((friendship, index) => (
            <FriendCard
              key={friendship._id || friendship.id}
              variant={index === 0 ? 'featured' : 'crew'}
              friendship={friendship}
              currentUserId={userId}
              onAction={onAction}
              onOpen={onOpenFriend}
              socialState={socialPresence?.contracts?.[friendship._id || friendship.id]}
            />
          ))}</div>

          {pulse.length > 0 && (
            <section className="circle-pulse" aria-label="While you were gone">
              <div className="circle-pulse-heading">
                <span>While you were gone</span>
                <button type="button" onClick={() => onActivitySeen?.(shownPulse)} aria-label={`Dismiss these ${shownPulse.length} updates`}>Dismiss shown</button>
              </div>
              <div className="circle-pulse-list">
                {shownPulse.map((item) => (
                  <button type="button" className={`circle-pulse-row ${item.tone || 'neutral'}`} key={item.id} onClick={() => openPulse(item)}>
                    <i aria-hidden="true" />
                    <span>{item.text}</span>
                    <time dateTime={item.createdAt}>{pulseTime(item.createdAt)}</time>
                    <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" />
                  </button>
                ))}
              </div>
              {pulse.length > 4 && <button className="circle-pulse-more" type="button" onClick={() => setShowAllPulse((value) => !value)}>{showAllPulse ? 'Show less' : `See ${pulse.length - 4} more`}</button>}
            </section>
          )}
        </section>

        <HomePlay user={user} onNavigate={onNavigate} />
      </div>

      {showSeasonBriefing && firstSeasonBriefing && (() => {
        const partner = partnerFor(firstSeasonBriefing, userId);
        const partnerName = partner?.username ? '@' + partner.username : (partner?.displayName || 'your partner');
        const limit = Number(perspectiveFor(firstSeasonBriefing, userId)?.limit) || 3;
        return (
          <section className="circle-season-briefing">
            <div>
              <span>First move</span>
              <p>Check in with {partnerName}.</p>
              <small>Then get them to match you. Debt starts after {limit} day{limit === 1 ? '' : 's'} of silence.</small>
            </div>
            <button type="button" onClick={dismissSeasonBriefing} aria-label="Dismiss Season 1 briefing"><X size={16} strokeWidth={1.6} /></button>
          </section>
        );
      })()}

      <div className="circle-summary" aria-label="Circle summary">
        <span><b>{activeSeasons}</b>Active</span>
        <span><b>Lv. {highestDuo?.duoLevel || 1}</b>Strongest Duo</span>
        {completeReports > 0 && <span><b>{completeReports}</b>Reports</span>}
        <span><b className={liveChaos > 0 ? 'danger' : ''}>{liveChaos > 0 ? liveChaos + ' live' : 'Clear'}</b>Chaos</span>
        {worldEvent && (
          <span className="circle-world-rule">
            <b>{worldEvent.name}</b>
            {WORLD_RULE_COPY[worldEvent.id] || worldEvent.description}
          </span>
        )}
      </div>

    </div>
  );
};
