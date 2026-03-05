import React, { useState } from 'react';
import { Mail, Clock, AlertCircle } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { sendFriendInvitation } from '../../../services/friendshipService';
import { useAuth } from '../../../contexts/AuthContext';

export const AddFriendModal = ({ isOpen, onClose, onRefresh, showToast }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [limit, setLimit] = useState(7);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await sendFriendInvitation(user.uid || user.id, email, limit);
      if (result.success) {
        showToast('CONTRACT INITIATED: WAITING FOR AUTHORIZATION', 'SUCCESS');
        onRefresh();
        onClose();
        setEmail('');
      } else {
        showToast(result.error || 'FAILED TO INITIATE CONTRACT', 'ERROR');
      }
    } catch (err) {
      showToast('SYSTEM ERROR: UNABLE TO SEND INVITATION', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="INITIATE NEW CONTRACT"
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ 
          background: 'rgba(255, 215, 0, 0.05)', 
          padding: '16px', 
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(255, 215, 0, 0.1)',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <AlertCircle size={20} color="var(--aura-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Warning: Initiating a contract binds both parties to the Hakoware interest protocol. 
            Ensure the recipient is prepared for the consequences of bankruptcy.
          </p>
        </div>

        <Input 
          label="RECIPIENT EMAIL"
          type="email"
          placeholder="target@hunter.org"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input 
          label="GRACE PERIOD (DAYS)"
          type="number"
          min="1"
          max="30"
          icon={Clock}
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value))}
          required
        />

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            ABORT
          </Button>
          <Button variant="aura" className="flex-1" type="submit" loading={loading}>
            INITIATE
          </Button>
        </div>
      </form>
    </Modal>
  );
};
