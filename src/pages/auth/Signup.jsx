import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const Signup = ({ onToggle }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { signup, resendVerificationEmail } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    const result = await signup(email, password, displayName);
    
    if (result.success) {
      // Logic handled in AuthContext (setting user state)
    } else {
      setError(getErrorMessage(result.error));
    }
    
    setLoading(false);
  };

  const handleResendEmail = async () => {
    setLoading(true);
    const result = await resendVerificationEmail();
    if (result.success) {
      alert('Verification email resent! Check your inbox.');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const getErrorMessage = (error) => {
    if (!error) return 'An unknown error occurred.';
    if (error.includes('email-already-in-use')) return 'An account with this email already exists.';
    if (error.includes('invalid-email')) return 'Invalid email address.';
    if (error.includes('weak-password')) return 'Password is too weak.';
    return error;
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1 className="auth-title glitch" data-text="HAKOWARE">HAKOWARE</h1>
          <div className="auth-success">
            <div className="success-icon">EMAIL SENT</div>
            <h2>Verification Email Sent!</h2>
            <p>Please check your inbox and verify your email before logging in.</p>
            <p className="small-text">Didn't receive it? Check your spam folder.</p>
            
            <div className="auth-links" style={{ marginTop: '20px' }}>
              <button 
                className="link-btn"
                onClick={handleResendEmail}
                disabled={loading}
              >
                Resend Email
              </button>
              <span className="divider">|</span>
              <button 
                className="link-btn"
                onClick={onToggle}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title glitch" data-text="HAKOWARE">HAKOWARE</h1>
        <p className="auth-subtitle">INITIATE CONTRACT</p>
        
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          
          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            className="auth-btn"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="auth-links">
          <span>Already have an account?</span>
          <button 
            className="link-btn"
            onClick={onToggle}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
