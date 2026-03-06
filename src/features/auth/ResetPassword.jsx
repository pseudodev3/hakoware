import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { api } from '../../lib/api';
import './Auth.css';

export const ResetPassword = ({ showToast }) => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('PIN MISMATCH');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      showToast('SECURITY PIN UPDATED', 'SUCCESS');
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message || 'RECOVERY FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <motion.div 
        className="auth-card glass"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="auth-header">
          <div className="auth-logo">H</div>
          <h1>RECOVERY</h1>
          <p>AUTHORIZING NEW SECURITY PIN</p>
        </div>

        {!success ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error-banner">{error}</div>}
            
            <Input 
              label="NEW SECURITY PIN"
              type="password"
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Input 
              label="CONFIRM NEW PIN"
              type="password"
              placeholder="••••••••"
              icon={Lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button 
              variant="aura" 
              className="w-full" 
              size="lg"
              loading={loading}
              icon={ArrowRight}
              type="submit"
            >
              AUTHORIZE PIN
            </Button>
          </form>
        ) : (
          <div className="success-view" style={{ textAlign: 'center', padding: '20px 0' }}>
             <ShieldCheck size={48} color="var(--aura-green)" style={{ margin: '0 auto 20px auto' }} />
             <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>AUTHORIZATION GRANTED</h3>
             <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
               Security pin synchronized. Redirecting...
             </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
