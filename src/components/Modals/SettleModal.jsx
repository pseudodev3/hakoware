import { useState } from 'react';
import { api } from '../../services/api';

const SettleModal = ({ isOpen, onClose, friendship, showToast, onSettleComplete }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !friendship) return null;

  const handleSettle = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/friendships/${friendship.id}/settle`);
      if (res.msg) throw new Error(res.msg);

      showToast('Debt settled successfully!', 'SUCCESS');
      onSettleComplete();
      onClose();
    } catch (error) {
      console.error('Settle error:', error);
      showToast('Failed to settle: ' + error.message, 'ERROR');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to end this contract? This cannot be undone.')) return;
    
    setLoading(true);
    try {
      const res = await api.delete(`/friendships/${friendship.id}`);
      if (res.msg) throw new Error(res.msg);

      showToast('Contract ended.', 'SUCCESS');
      onSettleComplete();
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Failed to end contract: ' + error.message, 'ERROR');
    }
    setLoading(false);
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ color: '#00e676', marginTop: 0 }}>Settle Contract</h2>
        <p style={{ color: '#888', marginBottom: '25px' }}>
          Reset the debt for this friendship or end the contract entirely.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleSettle}
            disabled={loading}
            style={{
              padding: '16px',
              background: '#004d40',
              color: '#00e676',
              border: '1px solid #00e676',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            SETTLE DEBT (RESET)
          </button>

          <button
            onClick={handleDelete}
            disabled={loading}
            style={{
              padding: '16px',
              background: 'transparent',
              color: '#ff4444',
              border: '1px solid #ff4444',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            END CONTRACT (DELETE)
          </button>
          
          <button
            onClick={onClose}
            style={{
              padding: '12px',
              background: 'transparent',
              color: '#666',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            CANCEL
          </button>
        </div>
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
  backgroundColor: 'rgba(0,0,0,0.8)',
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

export default SettleModal;
