import { useState } from 'react';
import { sendFriendInvitation } from '../../services/friendshipService';
import { useAuth } from '../../contexts/AuthContext';

const AddFriendModal = ({ isOpen, onClose, showToast }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const result = await sendFriendInvitation(user.uid, email.trim());
    setLoading(false);

    if (result.success) {
      showToast(result.message, 'SUCCESS');
      setEmail('');
      onClose();
    } else {
      showToast(result.message || result.error || 'Failed to send invitation', 'ERROR');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ color: '#ffd700', marginTop: 0 }}>ADD FRIEND</h2>
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '20px' }}>
          Enter your friend's email to send them an invitation.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#888', fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase' }}>
              Friend's Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@email.com"
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                background: loading ? '#333' : '#004d40',
                color: loading ? '#666' : '#00e676',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              {loading ? 'Sending...' : 'SEND INVITE'}
            </button>
            
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                color: '#888',
                border: '1px solid #444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.9)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const modalStyle = {
  background: '#111',
  padding: '30px',
  borderRadius: '12px',
  width: '90%',
  maxWidth: '400px',
  border: '1px solid #333',
  textAlign: 'center'
};

export default AddFriendModal;
