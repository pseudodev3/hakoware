import React, { useState } from 'react';
import { Mail, ShieldCheck, AlertCircle } from 'lucide-react';
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
      showToast('Password reset email sent', 'SUCCESS');
    } catch (err) {
      showToast(err.message || 'Could not send reset email', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Password recovery"
      size="md"
    >
      <div className="recovery-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {!submitted ? (
          <>
            <div className="association-notice glass" style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-soft)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={20} color="var(--aura-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.55' }}>
                Enter the email address connected to your Hakoware account and we will send you a password reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button variant="aura" type="submit" loading={loading} className="w-full">
                Send reset link
              </Button>
            </form>
          </>
        ) : (
          <div className="success-view" style={{ textAlign: 'center', padding: '20px 0' }}>
            <ShieldCheck size={48} color="var(--aura-green)" style={{ margin: '0 auto 20px auto' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 560, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Check your email
            </h3>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              We sent a password reset link to <strong>{email}</strong>.
            </p>
            <Button variant="secondary" onClick={onClose} style={{ marginTop: '28px' }} className="w-full">
              Return to login
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
