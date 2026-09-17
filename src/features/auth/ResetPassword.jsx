import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { api } from '../../lib/api';
import { applyTheme, getInitialTheme } from '../../lib/theme';
import './Auth.css';

export const ResetPassword = ({ showToast }) => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getInitialTheme);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Use light mode' : 'Use dark mode';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      showToast('Password updated', 'SUCCESS');
      setTimeout(() => navigate('/'), 2200);
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-orbit" aria-hidden="true" />

      <div className="auth-toolbar">
        <button type="button" className="auth-toolbar-button auth-back" onClick={() => navigate('/')}>
          <ArrowLeft size={16} strokeWidth={1.8} />
          <span>Home</span>
        </button>
        <button
          type="button"
          className="auth-toolbar-button auth-theme-toggle"
          onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <ThemeIcon size={17} strokeWidth={1.8} />
        </button>
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 14, scale: .99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', duration: .45, bounce: 0 }}
      >
        <div className="auth-header">
          <img className="auth-logo" src="/hakoware-mark.svg" alt="Hakoware" />
          <span className="auth-eyebrow">Account recovery</span>
          <h1>{success ? 'Password updated' : 'Choose a new password'}</h1>
          <p>{success ? 'Your account is secured with the new password.' : 'Set a new password for your Hakoware account. Your reset link is single-use and time limited.'}</p>
        </div>

        {!success ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error-banner" role="alert">{error}</div>}

            <Input
              label="New password"
              type="password"
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <Input
              label="Confirm password"
              type="password"
              placeholder="••••••••"
              icon={Lock}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
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
              Update password
            </Button>
          </form>
        ) : (
          <div className="auth-success" role="status">
            <span className="auth-success-icon"><ShieldCheck size={26} strokeWidth={1.8} /></span>
            <div>
              <strong>Recovery complete</strong>
              <p>Taking you back to Hakoware…</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
