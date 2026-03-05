import React, { useState } from 'react';
import { Settings, Clock, Trash2, ShieldAlert } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { api } from '../../../lib/api';

export const FriendshipSettingsModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  const isUser1 = friendship?.user1?._id === currentUserId || friendship?.user1 === currentUserId;
  const perspective = isUser1 ? friendship?.user1Perspective : friendship?.user2Perspective;
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;
  
  const [limit, setLimit] = useState(perspective?.limit || 7);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleUpdateLimit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/friendships/${friendship.id || friendship._id}/limit`, { limit });
      showToast('CONTRACT UPDATED: GRACE PERIOD MODIFIED', 'SUCCESS');
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.message || 'FAILED TO UPDATE CONTRACT', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminate = async () => {
    if (!window.confirm(`TERMINATE CONTRACT WITH ${friend.displayName.toUpperCase()}? THIS CANNOT BE UNDONE.`)) return;
    
    setDeleteLoading(true);
    try {
      await api.delete(`/friendships/${friendship.id || friendship._id}`);
      showToast('CONTRACT TERMINATED: CONNECTION SEVERED', 'SUCCESS');
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.message || 'TERMINATION FAILED', 'ERROR');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!friendship) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="CONTRACT PARAMETERS"
      size="md"
    >
      <div className="settings-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ textAlign: 'center' }}>
           <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Managing binding agreement with <strong>{friend.displayName}</strong></p>
        </div>

        <form onSubmit={handleUpdateLimit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
           <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
             Changing your grace period affects how quickly you accumulate debt. 
             Setting a lower limit increases your risk of bankruptcy.
           </p>
           <Button variant="primary" type="submit" loading={loading} className="w-full">
             UPDATE LIMIT
           </Button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px' }}>
           <div style={{ 
             background: 'rgba(255, 77, 77, 0.05)', 
             padding: '20px', 
             borderRadius: 'var(--radius-md)',
             border: '1px solid rgba(255, 77, 77, 0.1)',
             display: 'flex',
             flexDirection: 'column',
             gap: '16px'
           }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <ShieldAlert size={20} color="var(--aura-red)" />
                 <h4 style={{ color: 'var(--aura-red)', fontSize: '0.85rem', fontWeight: 800 }}>DANGER ZONE</h4>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Terminating a contract will clear all associated debt history and remove the friend from your radar.
              </p>
              <Button variant="danger" icon={Trash2} onClick={handleTerminate} loading={deleteLoading}>
                TERMINATE CONTRACT
              </Button>
           </div>
        </div>
      </div>
    </Modal>
  );
};
