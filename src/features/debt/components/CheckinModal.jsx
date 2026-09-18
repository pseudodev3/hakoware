import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { getContractBounty } from '../../../services/bountyService';
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
      if (!isOpen || !friendship) {
        setBounty(null);
        setBountySyncError(false);
        setBountyLoading(false);
        return;
      }
      setBountyLoading(true);
      setBountySyncError(false);
      try {
        const result = await getContractBounty(friendship._id || friendship.id);
        if (active) setBounty(result || null);
      } catch {
        if (active) {
          setBounty(null);
          setBountySyncError(true);
        }
      } finally {
        if (active) setBountyLoading(false);
      }
    };
    loadBounty();
    return () => { active = false; };
  }, [isOpen, friendship?._id, friendship?.id]);

  if (!friendship || !friend || !stats) return null;

  const pressureReady = bounty?.status === 'PRESSURE_SENT' && bounty?.hunterName;
  const hasOpenBounty = Boolean(bounty && ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'].includes(bounty.status));

  const handleCheckin = async (creditHunter = false) => {
    if (bountyLoading) return showToast?.('Arena state is still syncing', 'ERROR');
    if (bountySyncError) return showToast?.('Could not verify the live bounty. Close and reopen this check-in.', 'ERROR');

    setLoading(true);
    const creditId = creditHunter && pressureReady ? bounty._id : null;
    const bountyDecision = pressureReady ? (creditHunter ? 'CREDIT' : 'ESCAPE') : null;
    const result = await performCheckin(friendship._id || friendship.id, 'TEXT', creditId, bountyDecision);
    if (result.success) {
      const xp = result.game?.xp;
      const chaos = result.game?.chaosResolved ? ' · anomaly survived' : '';
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
      showToast?.(`Checked in with ${friend.displayName}${xp ? ` · +${xp} Duo XP` : ''}${chaos}${bountyResult}${recovery}`, 'SUCCESS');
      await onRefresh?.();
      onClose?.();
    } else {
      showToast?.(result.error || 'Could not check in', 'ERROR');
    }
    setLoading(false);
  };

  const lastInteraction = perspective?.lastInteraction ? new Date(perspective.lastInteraction) : null;
  const activeChaos = friendship.chaos?.activeEvent;
  const isChaosTarget = activeChaos && String(activeChaos.targetUserId) === String(currentUserId);
  const checkinBlocked = bountyLoading || bountySyncError;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Check in with ${friend.displayName}`} size="md">
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
            <div><span>ARENA SYNC FAILED</span><strong>Proof state could not be verified.</strong><p>Close and reopen this check-in before submitting so no hunter credit or escape can happen by accident.</p></div>
          </div>
        )}

        {hasOpenBounty && !bountySyncError && (
          <div className={`checkin-bounty-proof ${pressureReady ? 'pressure-ready' : ''}`}>
            <div className="checkin-bounty-icon">{pressureReady ? <ShieldCheck size={18} /> : <Target size={18} />}</div>
            <div>
              <span>{pressureReady ? 'PROOF OF PRESSURE' : 'BOUNTY LIVE'}</span>
              <strong>{bounty.amount} Aura on this check-in</strong>
              <p>
                {pressureReady
                  ? `${bounty.hunterName} sent pressure. Credit them only if they actually got you back here; checking in normally lets you escape.`
                  : bounty.status === 'HUNTING'
                    ? `${bounty.hunterName || 'A hunter'} picked this up but has not sent pressure yet. Check in now to escape.`
                    : 'No hunter has earned proof yet. Check in now to close the bounty and return the escrow.'}
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
                ? `This check-in starts recovery. Debt drops to ${stats.limit}; one more clean check-in gets you back to stable.`
                : stats.isRecovering
                  ? 'One more valid check-in completes bankruptcy recovery.'
                  : stats.totalDebt > 0
                    ? 'Checking in clears your current debt.'
                    : 'You are inside the grace period.'}
            </p>
          </div>
        </div>

        <div className="checkin-meta">
          <div><Clock3 size={15} strokeWidth={1.8} /><span><small>Last check-in</small><strong>{lastInteraction ? lastInteraction.toLocaleDateString() : 'Never'}</strong></span></div>
          <div><span className="grace-dot" /><span><small>Your grace period</small><strong>{stats.limit} day{stats.limit === 1 ? '' : 's'}</strong></span></div>
        </div>

        <p className="checkin-note">
          {stats.isBankrupt
            ? 'Bankruptcy takes two clean check-ins to fully recover. The first stops the spiral; the second clears the recovery debt.'
            : 'A check-in can be logged once every 20 hours. It resets your side of this contract and grows your Duo level.'}
        </p>

        {pressureReady ? (
          <div className="checkin-proof-actions">
            <Button type="button" variant="secondary" disabled={checkinBlocked} loading={loading} onClick={() => handleCheckin(false)}>Check in normally</Button>
            <Button variant="aura" icon={ShieldCheck} disabled={checkinBlocked} loading={loading} onClick={() => handleCheckin(true)}>Credit {bounty.hunterName}</Button>
          </div>
        ) : (
          <div className="checkin-actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="aura" icon={Check} disabled={checkinBlocked} loading={loading || bountyLoading} onClick={() => handleCheckin(false)}>
              {bountyLoading ? 'Syncing Arena…' : hasOpenBounty ? 'Check in & escape' : 'Check in now'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
