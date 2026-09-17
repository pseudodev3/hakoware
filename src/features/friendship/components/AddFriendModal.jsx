import React, { useState } from 'react';
import { Check, Clock3, Copy, Mail, Share2 } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { sendFriendInvitation } from '../../../services/friendshipService';
import './AddFriendModal.css';

export const AddFriendModal = ({ isOpen, onClose, onRefresh, showToast }) => {
  const [email, setEmail] = useState('');
  const [limit, setLimit] = useState(7);
  const [loading, setLoading] = useState(false);
  const [shareInvite, setShareInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail('');
    setLimit(7);
    setShareInvite(null);
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const result = await sendFriendInvitation(email, limit);
    if (result.success && result.requiresSignup) {
      setShareInvite(result);
      await onRefresh?.();
      showToast?.('Invite saved — share Hakoware with them', 'SUCCESS');
    } else if (result.success) {
      showToast?.('Contract request sent', 'SUCCESS');
      reset();
      await onRefresh?.();
      onClose();
    } else {
      showToast?.(result.error || 'Could not send contract request', 'ERROR');
    }
    setLoading(false);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareInvite.inviteUrl);
      setCopied(true);
      showToast?.('Invite link copied', 'SUCCESS');
    } catch {
      showToast?.('Could not copy the invite link', 'ERROR');
    }
  };

  const share = async () => {
    if (!shareInvite) return;
    const text = `Join me on Hakoware and sign up with ${shareInvite.recipientEmail} so our contract request appears automatically.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Hakoware contract', text, url: shareInvite.inviteUrl });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyInvite();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={shareInvite ? 'Invite ready' : 'Start a contract'} size="md">
      {shareInvite ? (
        <div className="invite-share-state">
          <div className="invite-share-icon"><Check size={20} strokeWidth={2} /></div>
          <div className="invite-share-copy">
            <strong>They’re not on Hakoware yet.</strong>
            <p>Share the link below. When <b>{shareInvite.recipientEmail}</b> signs up, your contract request will already be waiting for them.</p>
          </div>
          <button type="button" className="invite-link" onClick={copyInvite} aria-label="Copy Hakoware invite link">
            <span>{shareInvite.inviteUrl}</span>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <div className="new-contract-actions">
            <Button type="button" variant="secondary" onClick={close}>Done</Button>
            <Button type="button" variant="aura" icon={Share2} onClick={share}>Share invite</Button>
          </div>
        </div>
      ) : (
        <form className="new-contract-form" onSubmit={handleSubmit}>
          <div className="contract-modal-intro">
            <strong>Pick one person and a grace period.</strong>
            <p>If either of you goes longer than the grace period without checking in, debt starts to build. They do not need an account yet.</p>
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
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" variant="aura" loading={loading}>Send request</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
