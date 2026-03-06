import React, { useState } from 'react';
import { Mail, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { api } from '../../../lib/api';

export const ForgotPasswordModal = ({ isOpen, onClose, showToast }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      showToast('RECOVERY PROTOCOL INITIATED', 'SUCCESS');
    } catch (err) {
      showToast(err.message || 'RECOVERY FAILED', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="PASSWORD RECOVERY"
      size="md"
    >
      <div className="recovery-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {!submitted ? (
          <>
            <div className="association-notice glass" style={{ 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={20} color="var(--aura-gold)" />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Provide your registered email address to receive a recovery link from the Association.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Input 
                label="EMAIL ADDRESS"
                type="email"
                placeholder="hunter@association.org"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button variant="aura" type="submit" loading={loading} icon={ArrowRight} className="w-full">
                SEND RECOVERY LINK
              </Button>
            </form>
          </>
        ) : (
          <div className="success-view" style={{ textAlign: 'center', padding: '20px 0' }}>
             <ShieldCheck size={48} color="var(--aura-green)" style={{ margin: '0 auto 20px auto' }} />
             <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>TRANSMISSION SUCCESSFUL</h3>
             <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
               The Association has dispatched a recovery protocol to <strong>{email}</strong>.
             </p>
             <Button variant="secondary" onClick={onClose} style={{ marginTop: '32px' }} className="w-full">
               RETURN TO LOGIN
             </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
