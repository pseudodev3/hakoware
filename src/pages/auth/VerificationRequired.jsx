import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const VerificationRequired = () => {
  const { logout } = useAuth();

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title glitch" data-text="HAKOWARE">HAKOWARE</h1>
        <p className="auth-subtitle">SYSTEM MAINTENANCE</p>
        
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>The verification system is currently being migrated.</p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>You should have been logged in automatically.</p>
          
          <button 
            className="auth-btn" 
            onClick={() => {
              logout();
              window.location.href = '/';
            }}
            style={{ marginTop: '20px' }}
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationRequired;
