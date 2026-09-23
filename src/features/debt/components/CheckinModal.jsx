import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { getContractBounty, peekContractBounty } from '../../../services/bountyService';
import { useDebt } from '../../../hooks/useDebt';
import './CheckinModal.css';

export const CheckinModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [bounty, setBounty] = useState(null);
  const [bountyLoading, setBountyLoading] = useState(false);
  const [bountySyncError, setBountySyncError] = useState(false);
  const user1Id = friendship?.user1?._id || friendship?.user1;
  const isUser1 = String(user1Id) === String(currentUserId);
  const perspective = isUser1 ? friendship?.user1Perspective : friendship?.user2Perspective;
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;
  const stats = useDebt(perspective);

  useEffect(() => {
    let active = true;
    const loadBounty = async () => {
      const friendshipId = friendship?._id || friendship?.id;
      if (!isOpen || !friendshipId) {
        setBounty(null);
        setBountySyncError(false);
        setBountyLoading(false);
        return;
      }

      const cached = peekContractBounty(friendshipId);
      const hasWarmState = cached !== undefined;

      if (hasWarmState) {
        setBounty(cached || null);
        setBountyLoading(false);
      } else {
        setBountyLoading(true);
      }
      setBountySyncError(false);

      try {
        const result = await getContractBounty(friendshipId, { force: hasWarmState });
        if (active) setBounty(result || null);
      } catch {
        if (active && !hasWarmState) {
          setBounty(null);
          setBountySyncError(true);
        }
      } finally {
        if (active) setBountyLoading(false);
      }
    };

    void loadBounty();
    return () => { active = false; };
  }, [isOpen, friendship?._id, friendship?.id]);

  if (!friendship || !friend || !stats) return null;

  const pressureReady = bounty?.status === 'PRESSURE_SENT' && bounty?.hunterName;
  const hasOpenBounty = Boolean(bounty && ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'].includes(bounty.status));
  const fundingBreakdown = bounty?.chaosAmount > 0
    ? `${bounty.chaosAmount} Chaos${bounty.partnerAmount > 0 ? ` + ${bounty.partnerAmount} Partner` : ''}`
    : null;

  const handleCheckin = async (creditHunter = false) => {
    if (bountyLoading) return showToast?.('Arena is still syncing', 'ERROR');
    if (bountySyncError) return showToast?.('Could not verify the bounty. Reopen this check-in.', 'ERROR');

    setLoading(true);
    const creditId = creditHunter && pressureReady ? bounty._id : null;
    const bountyDecision = pressureReady ? (creditHunter ? 'CREDIT' : 'ESCAPE') : null;
    const result = await performCheckin(friendship._id || friendship.id, 'TEXT', creditId, bountyDecision);
    if (result.success) {
      const xp = result.game?.xp;
      const chaos = result.game?.chaosResolved ? ' · anomaly survived' : '';
      const wanted = result.game?.wantedCleared ? ' · Wanted cleared' : '';
      const bountyResult = result.bounty?.outcome === 'CLAIMED'
        ? ` · ${bounty?.hunterName || 'hunter'} credited`
        : result.bounty?.outcome === 'ESCAPED'
          ? ' · bounty escaped'
          : '';
      const recovery = result.recovery?.started
        ? ' · recovery started · 1 clean check-in left'
        : result.recovery?.completed
          ? ' · bankruptcy recovery complete'
          : '';
      showToast?.(`Checked in with ${friend.displayName}${xp ? ` · +${xp} Duo XP` : ''}${chaos}${wanted}${bountyResult}${recovery}`, 'SUCCESS');
      await onRefresh?.();
      onClose?.();
    } else {
      showToast?.(result.error || 'Could not check in', 'ERROR');
      try {
        const refreshedBounty = await getContractBounty(friendship._id || friendship.id, { force: true });
        setBounty(refreshedBounty || null);
        setBountySyncError(false);
      } catch {
        // Keep the current UI state; the server already rejected the unsafe submission.
      }
    }
    setLoading(false);
  };

  const lastInteraction = perspective?.lastInteraction ? new Date(perspective.lastInteraction) : null;
  const activeChaos = friendship.chaos?.activeEvent;
  const isChaosTarget = activeChaos && String(activeChaos.targetUserId) === String(currentUserId);
  const checkinBlocked = bountyLoading || bountySyncError;
  const actions = pressureReady ? (
    <div className="checkin-proof-actions">
      <Button type="button" variant="secondary" disabled={checkinBlocked} loading={loading} onClick={() => handleCheckin(false)}>Escape</Button>
      <Button variant="aura" icon={ShieldCheck} disabled={checkinBlocked} loading={loading} onClick={() => handleCheckin(true)}>Credit {bounty.hunterName}</Button>
    </div>
  ) : (
    <div className="checkin-actions">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="aura" icon={Check} disabled={checkinBlocked} loading={loading || bountyLoading} onClick={() => handleCheckin(false)}>
        {bountyLoading ? 'Syncing Arena…' : hasOpenBounty ? 'Check in & escape' : 'Check in'}
      </Button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Check in with ${friend.displayName}`} size="md" footer={actions}>
      <div className="checkin-content">
        {isChaosTarget && (
          <div className="checkin-chaos">
            <Sparkles size={17} strokeWidth={1.8} />
            <div><strong>{activeChaos.name}</strong><p>{activeChaos.description}</p></div>
          </div>
        )}

        {bountySyncError && (
          <div className="checkin-bounty-proof sync-error">
            <div className="checkin-bounty-icon"><AlertTriangle size={18} /></div>
            <div><span>ARENA SYNC FAILED</span><strong>Bounty not verified.</strong><p>Reopen this check-in before submitting.</p></div>
          </div>
        )}

        {hasOpenBounty && !bountySyncError && (
          <div className={`checkin-bounty-proof ${pressureReady ? 'pressure-ready' : ''}`}>
            <div className="checkin-bounty-icon">{pressureReady ? <ShieldCheck size={18} /> : <Target size={18} />}</div>
            <div>
              <span>{pressureReady ? 'PROOF OF PRESSURE' : 'BOUNTY LIVE'}</span>
              <strong>{bounty.amount} Aura on this check-in</strong>
              <p>
                {fundingBreakdown ? `${fundingBreakdown}. ` : ''}{pressureReady
                  ? `Credit ${bounty.hunterName} only if their pressure brought you back. Otherwise, escape.`
                  : bounty.status === 'HUNTING'
                    ? `${bounty.hunterName || 'A hunter'} picked this up. Check in to escape.`
                    : bounty?.chaosAmount > 0
                      ? bounty?.partnerAmount > 0
                        ? 'No proof yet. Check in to escape; partner Aura returns.'
                        : 'No proof yet. Check in to escape before a hunter gets paid.'
                      : 'No proof yet. Check in to close the bounty and return escrow.'}
              </p>
            </div>
          </div>
        )}

        <div className="checkin-state">
          <span className={`checkin-debt ${stats.totalDebt > 0 ? 'has-debt' : ''}`}>{stats.totalDebt}</span>
          <div>
            <strong>Current debt</strong>
            <p>
              {stats.isBankrupt
                ? `Recovery starts now. Debt drops to ${stats.limit}; one more clean check-in to stabilize.`
                : stats.isRecovering
                  ? 'One more check-in completes recovery.'
                  : stats.totalDebt > 0
                    ? 'This clears your debt.'
                    : 'Inside grace period.'}
            </p>
          </div>
        </div>

        <div className="checkin-meta">
          <div><Clock3 size={15} strokeWidth={1.8} /><span><small>Last check-in</small><strong>{lastInteraction ? lastInteraction.toLocaleDateString() : 'Never'}</strong></span></div>
          <div><span className="grace-dot" /><span><small>Grace</small><strong>{stats.limit} day{stats.limit === 1 ? '' : 's'}</strong></span></div>
        </div>

        <p className="checkin-note">
          {stats.isBankrupt
            ? 'Recovery takes two clean check-ins, at least 20h apart.'
            : 'One check-in every 20h. Resets your side + earns Duo XP.'}
        </p>

      </div>
    </Modal>
  );
};
