import React, { useEffect, useState } from 'react';
import { Clock3, Dice5, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { api } from '../../../lib/api';
import './FriendshipSettingsModal.css';

const MODE_NAMES = {
  DONT_GHOST: "Don't Ghost Me",
  GYM_PACT: 'Gym Pact',
  STUDY_ARC: 'Study Arc',
  LOCK_IN: '30-Day Lock-In',
  LONG_DISTANCE: 'Long Distance',
  BUILD_IN_PUBLIC: 'Build in Public',
  CHAOS: 'Chaos Contract',
  CUSTOM: 'Custom'
};

export const FriendshipSettingsModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  const user1Id = friendship?.user1?._id || friendship?.user1;
  const isUser1 = String(user1Id) === String(currentUserId);
  const perspective = isUser1 ? friendship?.user1Perspective : friendship?.user2Perspective;
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;
  const [limit, setLimit] = useState(7);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setLimit(perspective?.limit || 7);
  }, [isOpen, perspective?.limit, friendship?._id]);

  if (!friendship || !friend) return null;
  const id = friendship._id || friendship.id;
  const templateId = friendship.templateId || 'DONT_GHOST';
  const isCustom = templateId === 'CUSTOM';
  const isChaos = templateId === 'CHAOS';
  const modeName = MODE_NAMES[templateId] || MODE_NAMES.DONT_GHOST;
  const season = friendship.season || {};

  const updateLimit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.put(`/friendships/${id}/limit`, { limit });
      showToast?.('Grace period updated', 'SUCCESS');
      await onRefresh();
      onClose();
    } catch (error) {
      showToast?.(error.message || 'Could not update contract', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const terminate = async () => {
    if (!window.confirm(`End your contract with ${friend.displayName}?`)) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/friendships/${id}`);
      showToast?.('Contract ended', 'SUCCESS');
      await onRefresh();
      onClose();
    } catch (error) {
      showToast?.(error.message || 'Could not end contract', 'ERROR');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Contract with ${friend.displayName}`} size="md">
      <div className="contract-settings-content">
        <section className={`contract-rule-summary ${isChaos ? 'chaos' : ''}`}>
          <span className="contract-rule-icon">{isChaos ? <Dice5 size={18} /> : <ShieldCheck size={18} />}</span>
          <div>
            <strong>{modeName}</strong>
            <p>{perspective?.limit || 7}-day rule · Season {season.number || 1} · {season.status?.toLowerCase() || 'active'}</p>
          </div>
          <span className="contract-duo-badge"><Trophy size={12} /> Duo Lv. {friendship.duoLevel || 1}</span>
        </section>

        {isCustom ? (
          <form className="contract-settings-form" onSubmit={updateLimit}>
            <div><h3>Your grace period</h3><p>Custom contracts let each side choose its own window.</p></div>
            <Input label="Days" type="number" min="1" max="30" icon={Clock3} value={limit} onChange={(event) => setLimit(Number(event.target.value))} required />
            <p className="settings-help">Debt begins after {limit} day{limit === 1 ? '' : 's'} without your check-in.</p>
            <Button variant="primary" type="submit" loading={loading}>Save rule</Button>
          </form>
        ) : (
          <section className="fixed-rule-panel">
            <Clock3 size={17} strokeWidth={1.8} />
            <div><strong>{perspective?.limit || 7}-day grace period</strong><p>{modeName} has fixed rules for the whole season. Start another mode if you want a different cadence.</p></div>
          </section>
        )}

        {isChaos && (
          <section className="chaos-settings-panel">
            <div><span>CHAOS LEVEL</span><strong>{friendship.chaos?.level || 1} / 5</strong></div>
            <p>{friendship.chaos?.activeEvent ? `${friendship.chaos.activeEvent.name} is active now.` : friendship.chaos?.nextEventAt ? `Next anomaly can strike around ${new Date(friendship.chaos.nextEventAt).toLocaleString()}.` : 'The next anomaly is unscheduled.'}</p>
          </section>
        )}

        <div className="contract-danger">
          <div><strong>End contract</strong><p>This ends the season, removes the connection and refunds open bounty escrow. It cannot be undone.</p></div>
          <Button variant="danger" icon={Trash2} loading={deleteLoading} onClick={terminate}>End contract</Button>
        </div>
      </div>
    </Modal>
  );
};
