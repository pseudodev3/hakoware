import React, { useEffect, useMemo, useState } from 'react';
import { Check, Target, Zap } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { createBounty } from '../../../services/bountyService';
import { useAuth } from '../../../contexts/AuthContext';
import './CreateBountyModal.css';

const listingFeeFor = (amount) => Math.max(1, Math.min(25, Math.ceil((Number(amount) || 0) * 0.05)));

export const CreateBountyModal = ({ isOpen, onClose, friendships, onRefresh, showToast }) => {
  const { user, refreshUser } = useAuth();
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState(25);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const userId = user.uid || user.id || user._id;
  const balance = Number(user.auraBalance) || 0;
  const validAmount = Number.isInteger(amount) && amount >= 10 && amount <= 500;
  const listingFee = useMemo(() => listingFeeFor(amount), [amount]);
  const totalCost = amount + listingFee;
  const canAfford = totalCost <= balance;

  useEffect(() => {
    if (!isOpen) return;
    const validIds = new Set(friendships.map((friendship) => String(friendship._id || friendship.id)));
    if (selectedId && !validIds.has(String(selectedId))) setSelectedId('');
  }, [isOpen, friendships, selectedId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedId) {
      showToast?.('Choose a contract first', 'ERROR');
      return;
    }
    if (!validAmount || !canAfford) {
      showToast?.(canAfford ? 'Bounty must be between 10 and 500 Aura' : `You need ${totalCost} Aura including the Arena fee`, 'ERROR');
      return;
    }

    setLoading(true);
    const result = await createBounty({ friendshipId: selectedId, amount, message });
    if (result?.error || result?.success === false) {
      showToast?.(result.error || result.msg || 'Could not place bounty', 'ERROR');
    } else {
      showToast?.(`${amount} Aura bounty placed · ${listingFee} Aura Arena fee burned`, 'SUCCESS');
      setSelectedId('');
      setAmount(25);
      setMessage('');
      await Promise.all([onRefresh(), refreshUser()]);
      onClose();
    }
    setLoading(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Place a bounty" size="md">
      <form className="bounty-form" onSubmit={handleSubmit}>
        <div className="bounty-explainer">
          <Target size={18} strokeWidth={1.8} />
          <p>Bounties unlock only after a contract partner goes bankrupt. Your reward goes into escrow; hunters must stake Aura, send pressure, and earn target credit to get paid.</p>
        </div>

        <div className="bounty-field">
          <label>Contract</label>
          <div className="bounty-friend-grid">
            {friendships.length === 0 && <p className="bounty-empty-targets">Nobody on your contracts is bankrupt right now.</p>}
            {friendships.map((friendship) => {
              const id = friendship._id || friendship.id;
              const isUser1 = String(friendship.user1?._id || friendship.user1) === String(userId);
              const friend = isUser1 ? friendship.user2 : friendship.user1;
              const selected = selectedId === id;
              return (
                <button type="button" key={id} className={`bounty-friend ${selected ? 'selected' : ''}`} onClick={() => setSelectedId(id)}>
                  <span className="bounty-friend-avatar">{selected ? <Check size={15} /> : friend?.displayName?.[0]?.toUpperCase()}</span>
                  <span>{friend?.displayName || 'Contract partner'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bounty-field">
          <div className="bounty-field-label-row">
            <label htmlFor="bounty-amount">Reward</label>
            <span className={!canAfford ? 'insufficient' : ''}>{balance} Aura available</span>
          </div>
          <div className={`bounty-amount-row ${!canAfford ? 'invalid' : ''}`}>
            <Zap size={18} strokeWidth={1.8} />
            <input id="bounty-amount" type="number" min="10" max="500" step="5" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            <span>Aura</span>
          </div>
          <div className="bounty-presets">
            {[10, 25, 50, 100].map((value) => {
              const presetCost = value + listingFeeFor(value);
              return <button type="button" key={value} disabled={presetCost > balance} className={amount === value ? 'active' : ''} onClick={() => setAmount(value)}>{value}</button>;
            })}
          </div>
          <div className="bounty-cost-breakdown">
            <span><small>Escrow</small><strong>{amount} Aura</strong></span>
            <span><small>Arena fee · burned</small><strong>{listingFee} Aura</strong></span>
            <span><small>Total now</small><strong>{totalCost} Aura</strong></span>
          </div>
        </div>

        <div className="bounty-field">
          <label htmlFor="bounty-message">Message <span>optional</span></label>
          <textarea id="bounty-message" maxLength="180" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Give the Arena some context." />
        </div>

        <div className="bounty-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={loading} disabled={!selectedId || !validAmount || !canAfford}>
            {!canAfford ? 'Not enough Aura' : `Place bounty · ${totalCost}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
