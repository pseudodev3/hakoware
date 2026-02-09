import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const Login = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const { login, resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (!result.success) {
      setError(getErrorMessage(result.error));
    }
    
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await resetPassword(resetEmail);
    
    if (result.success) {
      setResetSent(true);
    } else {
      setError(getErrorMessage(result.error));
    }
    
    setLoading(false);
  };

  const getErrorMessage = (error) => {
    if (!error) return 'An unknown error occurred.';
    if (error.includes('user-not-found')) return 'No account found with this email.';
    if (error.includes('wrong-password')) return 'Incorrect password.';
    if (error.includes('invalid-email')) return 'Invalid email address.';
    if (error.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
    return error;
  };

  if (showReset) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1 className="auth-title glitch" data-text="HAKOWARE">HAKOWARE</h1>
          <p className="auth-subtitle">RESET PASSWORD</p>
          
          {resetSent ? (
            <div className="auth-success">
              <p>Password reset email sent!</p>
              <p>Check your inbox for instructions.</p>
              <button 
                className="auth-btn secondary" 
                onClick={() => { setShowReset(false); setResetSent(false); }}
                style={{ marginTop: '20px' }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword}>
              {error && <div className="auth-error">{error}</div>}
              
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="auth-btn"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button 
                type="button" 
                className="auth-btn secondary"
                onClick={() => setShowReset(false)}
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title glitch" data-text="HAKOWARE">HAKOWARE</h1>
        <p className="auth-subtitle">CHAPTER 7 BANKRUPTCY</p>
        
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          
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
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            className="auth-btn"
            disabled={loading}
          >
            {loading ? 'Accessing...' : 'ENTER SYSTEM'}
          </button>
        </form>

        <div className="auth-links">
          <button 
            className="link-btn"
            onClick={() => setShowReset(true)}
          >
            Forgot Password?
          </button>
          <span className="divider">|</span>
          <button 
            className="link-btn"
            onClick={onToggle}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
