import React, { useState } from 'react';
import { Check, Clock3 } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { useDebt } from '../../../hooks/useDebt';
import './CheckinModal.css';

export const CheckinModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const user1Id = friendship?.user1?._id || friendship?.user1;
  const isUser1 = String(user1Id) === String(currentUserId);
  const perspective = isUser1 ? friendship?.user1Perspective : friendship?.user2Perspective;
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;
  const stats = useDebt(perspective);

  if (!friendship || !friend || !stats) return null;

  const handleCheckin = async () => {
    setLoading(true);
    const result = await performCheckin(friendship._id || friendship.id);
    if (result.success) {
      showToast?.(`Checked in with ${friend.displayName}`, 'SUCCESS');
      await onRefresh?.();
      onClose?.();
    } else {
      showToast?.(result.error || 'Could not check in', 'ERROR');
    }
    setLoading(false);
  };

  const lastInteraction = perspective?.lastInteraction ? new Date(perspective.lastInteraction) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Check in with ${friend.displayName}`} size="md">
      <div className="checkin-content">
        <div className="checkin-state">
          <span className={`checkin-debt ${stats.totalDebt > 0 ? 'has-debt' : ''}`}>{stats.totalDebt}</span>
          <div><strong>Current debt</strong><p>{stats.totalDebt > 0 ? 'Checking in clears your current debt.' : 'You are inside the grace period.'}</p></div>
        </div>

        <div className="checkin-meta">
          <div><Clock3 size={15} strokeWidth={1.8} /><span><small>Last check-in</small><strong>{lastInteraction ? lastInteraction.toLocaleDateString() : 'Never'}</strong></span></div>
          <div><span className="grace-dot" /><span><small>Your grace period</small><strong>{stats.limit} day{stats.limit === 1 ? '' : 's'}</strong></span></div>
        </div>

        <p className="checkin-note">A check-in can be logged once every 20 hours. It resets your side of this contract; your friend keeps their own schedule.</p>

        <div className="checkin-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="aura" icon={Check} loading={loading} onClick={handleCheckin}>Check in now</Button>
        </div>
      </div>
    </Modal>
  );
};
