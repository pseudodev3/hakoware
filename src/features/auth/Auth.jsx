import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, AtSign, Lock, Mail, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { applyTheme, getInitialTheme } from '../../lib/theme';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import './Auth.css';

const AuthBrand = ({ eyebrow, title, description }) => (
  <div className="auth-header">
    <img className="auth-logo" src="/hakoware-mark-v2.png" alt="" />
    <span className="auth-eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{description}</p>
  </div>
);

const AuthShell = ({ children, onBack }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Use light mode' : 'Use dark mode';

  return (
    <div className="auth-container">
      <div className="auth-orbit" aria-hidden="true" />
      <div className="auth-toolbar">
        <button type="button" className="auth-toolbar-button auth-back" onClick={onBack}>
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
      {children}
    </div>
  );
};

export const Login = ({ onToggle, onBack, showToast }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login(identifier, password);
      if (!result.success) setError(result.error || 'Could not sign you in.');
    } catch {
      setError('Hakoware could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell onBack={onBack}>
      <motion.div className="auth-card" initial={{ opacity: 0, y: 14, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', duration: .45, bounce: 0 }}>
        <AuthBrand eyebrow="Hakoware" title="Welcome back" description="Your contracts, Aura and unfinished business are right where you left them." />
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error-banner" role="alert">{error}</div>}
          <Input
            label="Username or email"
            type="text"
            placeholder="@username or you@example.com"
            icon={AtSign}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <div className="input-with-action-label">
            <Input label="Password" type="password" placeholder="••••••••" icon={Lock} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Forgot password</button>
          </div>
          <Button variant="aura" className="w-full" size="lg" loading={loading} icon={ArrowRight} type="submit">Enter Hakoware</Button>
        </form>
        <div className="auth-footer"><p>New here? <button type="button" onClick={onToggle}>Create an account</button></p></div>
      </motion.div>
      <ForgotPasswordModal isOpen={showForgot} onClose={() => setShowForgot(false)} showToast={showToast} />
    </AuthShell>
  );
};

export const Signup = ({ onToggle, onBack }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signup(username, email, password);
      if (!result.success) setError(result.error || 'Could not create your account.');
    } catch {
      setError('Hakoware could not complete registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell onBack={onBack}>
      <motion.div className="auth-card" initial={{ opacity: 0, y: 14, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', duration: .45, bounce: 0 }}>
        <AuthBrand eyebrow="Create your ID" title="Claim your username" description="Your @username is how people find you on Hakoware. Email stays behind the scenes for recovery and important account messages." />
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error-banner" role="alert">{error}</div>}
          <Input
            label="Username"
            type="text"
            placeholder="ghostt"
            icon={AtSign}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={20}
            required
          />
          <p className="auth-field-note">3-20 characters. Letters, numbers, dots and underscores.</p>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <p className="auth-field-note">Used for recovery and important account notifications.</p>
          <Input label="Password" type="password" placeholder="••••••••" icon={Lock} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <Button variant="aura" className="w-full" size="lg" loading={loading} icon={ArrowRight} type="submit">Create account</Button>
        </form>
        <div className="auth-footer"><p>Already have an account? <button type="button" onClick={onToggle}>Log in</button></p></div>
      </motion.div>
    </AuthShell>
  );
};

export const ClaimUsername = () => {
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { user, claimUsername, logout } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await claimUsername(username);
    if (!result.success) setError(result.error || 'Could not claim that username.');
    setSaving(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-orbit" aria-hidden="true" />
      <motion.div className="auth-card" initial={{ opacity: 0, y: 14, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', duration: .45, bounce: 0 }}>
        <AuthBrand
          eyebrow="One-time setup"
          title="Claim your Hakoware username"
          description="This becomes your public @username. Your email stays private and continues handling recovery and important account messages."
        />
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error-banner" role="alert">{error}</div>}
          <Input
            label="Username"
            type="text"
            placeholder="ghostt"
            icon={AtSign}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={20}
            required
          />
          <p className="auth-field-note">3-20 characters. Letters, numbers, dots and underscores. Usernames are unique.</p>
          <Button variant="aura" className="w-full" size="lg" loading={saving} icon={ArrowRight} type="submit">Claim @{username || 'username'}</Button>
        </form>
        <div className="auth-footer">
          <p>Signed in as {user?.email}. <button type="button" onClick={logout}>Use another account</button></p>
        </div>
      </motion.div>
    </div>
  );
};
