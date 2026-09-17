import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import './Auth.css';

const AuthBrand = ({ eyebrow, title, description }) => (
  <div className="auth-header">
    <img className="auth-logo" src="/hakoware-mark.svg" alt="" />
    <span className="auth-eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{description}</p>
  </div>
);

export const Login = ({ onToggle, showToast }) => {
  const [email, setEmail] = useState('');
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
      const result = await login(email, password);
      if (!result.success) setError(result.error || 'Could not sign you in.');
    } catch (err) {
      setError('Hakoware could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-orbit" aria-hidden="true" />
      <motion.div className="auth-card" initial={{ opacity: 0, y: 14, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', duration: .45, bounce: 0 }}>
        <AuthBrand eyebrow="Hakoware" title="Welcome back" description="Your contracts, Aura and unfinished business are right where you left them." />
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error-banner" role="alert">{error}</div>}
          <Input label="Email" type="email" placeholder="you@example.com" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="input-with-action-label">
            <Input label="Password" type="password" placeholder="••••••••" icon={Lock} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Forgot?</button>
          </div>
          <Button variant="aura" className="w-full" size="lg" loading={loading} icon={ArrowRight} type="submit">Enter Hakoware</Button>
        </form>
        <div className="auth-footer"><p>New here? <button onClick={onToggle}>Create an account</button></p></div>
      </motion.div>
      <ForgotPasswordModal isOpen={showForgot} onClose={() => setShowForgot(false)} showToast={showToast} />
    </div>
  );
};

export const Signup = ({ onToggle }) => {
  const [displayName, setDisplayName] = useState('');
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
      const result = await signup(email, password, displayName);
      if (!result.success) setError(result.error || 'Could not create your account.');
    } catch (err) {
      setError('Hakoware could not complete registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-orbit" aria-hidden="true" />
      <motion.div className="auth-card" initial={{ opacity: 0, y: 14, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', duration: .45, bounce: 0 }}>
        <AuthBrand eyebrow="Create your ID" title="Start a contract" description="Pick a name, bring a friend, then decide how long silence gets to stay free." />
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error-banner" role="alert">{error}</div>}
          <Input label="Display name" type="text" placeholder="How friends know you" icon={User} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input label="Email" type="email" placeholder="you@example.com" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="••••••••" icon={Lock} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button variant="aura" className="w-full" size="lg" loading={loading} icon={ArrowRight} type="submit">Create account</Button>
        </form>
        <div className="auth-footer"><p>Already have an account? <button onClick={onToggle}>Log in</button></p></div>
      </motion.div>
    </div>
  );
};
