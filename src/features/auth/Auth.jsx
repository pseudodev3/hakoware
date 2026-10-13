import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AtSign, Eye, EyeOff, Lock, Mail, MessageCircle, Moon, Sun, UsersRound } from 'lucide-react';
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

const PasswordInput = ({ autoComplete, ...props }) => {
  const [visible, setVisible] = useState(false);
  return <div className="auth-password">
    <Input label="Password" type={visible ? 'text' : 'password'} icon={Lock} autoComplete={autoComplete} {...props} />
    <button type="button" className="auth-password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
  </div>;
};

const AuthShell = ({ children, onBack, signup = false }) => {
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
        <button type="button" className="auth-toolbar-button auth-back" aria-label="Back to home" onClick={onBack}>
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
      <main className={`auth-layout ${signup ? 'is-signup' : ''}`}>
        {signup && <aside className="auth-invitation" aria-label="What your account unlocks">
          <span className="auth-invitation-tag"><UsersRound size={18} /> BETTER TOGETHER</span>
          <h2>The friend you keep meaning to catch up with?<br /><em>Start there.</em></h2>
          <p>A shared place to talk, show up and build a story. One person is all it takes.</p>
          <div className="auth-invitation-message"><MessageCircle size={22} /><span>“Same time next week?”<small>A small message. A reason to come back.</small></span></div>
          <ol><li>Make your account.</li><li>Invite your person.</li><li>Check in together.</li></ol>
        </aside>}
        {children}
      </main>
    </div>
  );
};

export const Login = ({ onToggle, onBack, showToast }) => {
  const reduceMotion = useReducedMotion();
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
      <motion.div className="auth-card" initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .25 }}>
        <AuthBrand eyebrow="Pick up where you left off" title="Your people are here." description="Sign in to your conversations, shared moments and Duos." />
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
            <PasswordInput placeholder="Your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Forgot password</button>
          </div>
          <Button variant="aura" className="w-full" size="lg" loading={loading} type="submit">Log in</Button>
        </form>
        <div className="auth-footer"><p>New here? <button type="button" onClick={onToggle}>Create an account</button></p></div>
      </motion.div>
      <ForgotPasswordModal isOpen={showForgot} onClose={() => setShowForgot(false)} showToast={showToast} />
    </AuthShell>
  );
};

export const Signup = ({ onToggle, onBack }) => {
  const reduceMotion = useReducedMotion();
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
    <AuthShell onBack={onBack} signup>
      <motion.div className="auth-card" initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .25 }}>
        <div className="auth-journey" aria-label="Step 1: your account. Next: invite your person."><span className="current">01 Your account</span><ArrowRight size={14} aria-hidden="true" /><span>02 Your person</span></div>
        <AuthBrand eyebrow="Start something together" title="Your Duo starts here." description="Claim a username. Then bring the person you want to stay close to." />
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
          <PasswordInput placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
          <Button variant="aura" className="w-full" size="lg" loading={loading} type="submit">Create account</Button>
        </form>
        <p className="auth-legal">Your email stays private. Read our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy policy</Link>.</p>
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
          <Button variant="aura" className="w-full" size="lg" loading={saving} type="submit">Claim @{username.replace(/^@+/, '') || 'username'}</Button>
        </form>
        <div className="auth-footer">
          <p>Signed in as {user?.email}. <button type="button" onClick={logout}>Use another account</button></p>
        </div>
      </motion.div>
    </div>
  );
};
