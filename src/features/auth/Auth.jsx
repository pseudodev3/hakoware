import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import './Auth.css';

/**
 * Professional, high-fidelity Login page.
 * Implements HxH theme with smooth animations and aura effects.
 */
export const Login = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'INVALID AUTHENTICATION');
      }
    } catch (err) {
      setError('SYSTEM ERROR: UNREACHABLE');
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
        transition={{ duration: 0.6 }}
      >
        <div className="auth-header">
          <div className="auth-logo">H</div>
          <h1>HAKOWARE</h1>
          <p>CHAPTER 7 BANKRUPTCY PROTOCOL</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error-banner">{error}</div>}
          
          <Input 
            label="EMAIL ADDRESS"
            type="email"
            placeholder="hunter@association.org"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input 
            label="SECURITY PIN / PASSWORD"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button 
            variant="primary" 
            className="w-full" 
            size="lg"
            loading={loading}
            icon={ArrowRight}
            type="submit"
          >
            AUTHORIZE ACCESS
          </Button>
        </form>

        <div className="auth-footer">
          <p>NEW HUNTER DETECTED? <button onClick={onToggle}>REGISTER CONTRACT</button></p>
        </div>
      </motion.div>
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
      if (!result.success) {
        setError(result.error || 'REGISTRATION FAILED');
      }
    } catch (err) {
      setError('SYSTEM ERROR: REGISTRATION FAILED');
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
          <h1>REGISTER</h1>
          <p>NEW DEBTOR ENROLLMENT</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error-banner">{error}</div>}
          
          <Input 
            label="DISPLAY NAME"
            type="text"
            placeholder="Gon Freecss"
            icon={User}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input 
            label="EMAIL ADDRESS"
            type="email"
            placeholder="hunter@association.org"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input 
            label="SECURITY PIN / PASSWORD"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            CREATE CONTRACT
          </Button>
        </form>

        <div className="auth-footer">
          <p>ALREADY ENROLLED? <button onClick={onToggle}>AUTHORIZE ACCESS</button></p>
        </div>
      </motion.div>
    </div>
  );
};
