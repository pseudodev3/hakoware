import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, History, Info } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { useDebt } from '../../../hooks/useDebt';

export const CheckinModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const isUser1 = friendship?.user1?._id === currentUserId || friendship?.user1 === currentUserId;
  const perspective = isUser1 ? friendship?.user1Perspective : friendship?.user2Perspective;
  const stats = useDebt(perspective);

  const handleCheckin = async () => {
    setLoading(true);
    try {
      const result = await performCheckin(friendship.id || friendship._id);
      if (result.success) {
        showToast('PROTOCOL EXECUTED: DEBT RESET', 'SUCCESS');
        onRefresh();
        onClose();
      } else {
        showToast(result.error || 'EXECUTION FAILED', 'ERROR');
      }
    } catch (err) {
      showToast('SYSTEM ERROR: UNABLE TO RESET DEBT', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  if (!friendship) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="HAKOWARE PROTOCOL"
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Status Breakdown */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '4rem', 
            fontFamily: 'var(--font-mono)', 
            fontWeight: 800,
            color: stats?.color || 'var(--text-primary)',
            lineHeight: 1
          }}>
            {stats?.totalDebt}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.2em', marginTop: '8px' }}>
            OUTSTANDING ACCUMULATION (APR)
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '1px', 
          background: 'var(--border-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
              <History size={12} /> LAST RESET
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {new Date(perspective?.lastInteraction).toLocaleDateString()}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
              <ShieldCheck size={12} /> GRACE PERIOD
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {perspective?.limit} DAYS
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div style={{ 
          background: 'rgba(255, 215, 0, 0.05)', 
          padding: '24px', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(255, 215, 0, 0.1)',
          textAlign: 'center'
        }}>
          <h4 style={{ color: 'var(--aura-gold)', fontSize: '0.85rem', marginBottom: '8px' }}>INITIALIZE SYNC?</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Resetting your debt requires a successful check-in. This action will synchronize your state and clear all accumulated APR interest.
          </p>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              CANCEL
            </Button>
            <Button variant="aura" className="flex-1" icon={Zap} loading={loading} onClick={handleCheckin}>
              RESET DEBT
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Info size={14} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>INTEREST ACCRUES AUTOMATICALLY AFTER LIMIT EXCEEDED</span>
        </div>
      </div>
    </Modal>
  );
};
