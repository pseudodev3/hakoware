import React, { useState } from 'react';
import { Clock3, Mail } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { sendFriendInvitation } from '../../../services/friendshipService';
import './AddFriendModal.css';

export const AddFriendModal = ({ isOpen, onClose, onRefresh, showToast }) => {
  const [email, setEmail] = useState('');
  const [limit, setLimit] = useState(7);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const result = await sendFriendInvitation(email, limit);
    if (result.success) {
      showToast?.('Contract request sent', 'SUCCESS');
      setEmail('');
      setLimit(7);
      await onRefresh();
      onClose();
    } else {
      showToast?.(result.error || 'Could not send contract request', 'ERROR');
    }
    setLoading(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start a contract" size="md">
      <form className="new-contract-form" onSubmit={handleSubmit}>
        <div className="contract-modal-intro">
          <strong>Pick one person and a grace period.</strong>
          <p>If either of you goes longer than the grace period without checking in, debt starts to build.</p>
        </div>

        <Input
          label="Their email"
          type="email"
          placeholder="friend@example.com"
          icon={Mail}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <Input
          label="Grace period"
          type="number"
          min="1"
          max="30"
          icon={Clock3}
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          required
        />
        <p className="contract-field-note">{limit === 1 ? 'Debt starts after 1 day without a check-in.' : `Debt starts after ${limit} days without a check-in.`}</p>

        <div className="new-contract-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="aura" loading={loading}>Send request</Button>
        </div>
      </form>
    </Modal>
  );
};
