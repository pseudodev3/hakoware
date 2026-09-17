import React, { useEffect, useState } from 'react';
import { Clock3, Trash2 } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { api } from '../../../lib/api';
import './FriendshipSettingsModal.css';

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
        <form className="contract-settings-form" onSubmit={updateLimit}>
          <div>
            <h3>Grace period</h3>
            <p>This is your personal window. Your friend can keep a different one.</p>
          </div>
          <Input
            label="Days"
            type="number"
            min="1"
            max="30"
            icon={Clock3}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            required
          />
          <p className="settings-help">Debt begins after {limit} day{limit === 1 ? '' : 's'} without your check-in.</p>
          <Button variant="primary" type="submit" loading={loading}>Save grace period</Button>
        </form>

        <div className="contract-danger">
          <div><strong>End contract</strong><p>This removes the connection and its open bounties. This cannot be undone.</p></div>
          <Button variant="danger" icon={Trash2} loading={deleteLoading} onClick={terminate}>End contract</Button>
        </div>
      </div>
    </Modal>
  );
};
