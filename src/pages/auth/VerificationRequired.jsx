import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const VerificationRequired = () => {
  const { user, logout, resendVerificationEmail } = useAuth();

  const handleResend = async () => {
    const result = await resendVerificationEmail();
    if (result.success) {
      alert('Verification email sent! Check your inbox.');
    } else {
      alert('Error: ' + result.error);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title glitch" data-text="HAKOWARE">HAKOWARE</h1>
        <div className="auth-success">
          <div className="success-icon">LOCKED</div>
          <h2 style={{ color: '#ffd700' }}>Email Verification Required</h2>
          <p>Please verify your email to access the system.</p>
          <p className="small-text">We sent a verification link to:<br/><strong>{user?.email}</strong></p>
          
          <div style={{ marginTop: '30px' }}>
            <button 
              className="auth-btn"
              onClick={handleResend}
              style={{ marginBottom: '10px' }}
            >
              Resend Verification Email
            </button>
            
            <button 
              className="auth-btn secondary"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
          
          <p className="small-text" style={{ marginTop: '20px' }}>
            Didn't receive it? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationRequired;
