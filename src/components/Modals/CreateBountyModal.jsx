import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createBounty } from '../../services/bountyService';
import { TargetIcon, ZapIcon } from '../icons/Icons';

const CreateBountyModal = ({ isOpen, onClose, friendship, showToast, onBountyCreated }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const target = isUser1 ? friendship.user2 : friendship.user1;

  const presetMessages = [
    `I haven't heard from ${target.displayName} in forever!`,
    `Someone make ${target.displayName} check their phone!`,
    `${target.displayName} has entered the spirit realm.`,
    `Reward for contact with ${target.displayName}!`,
    `Missing: One friend. Last seen texting "lol" 3 weeks ago.`
  ];

  const randomMessage = () => {
    setMessage(presetMessages[Math.floor(Math.random() * presetMessages.length)]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (amount < 5) {
      showToast('Minimum bounty is 5 Aura Points', 'ERROR');
      return;
    }

    setLoading(true);
    const result = await createBounty(
      user.uid,
      user.displayName || 'Anonymous',
      target.userId,
      target.displayName,
      friendship.id,
      amount,
      message
    );

    if (result.success) {
      showToast(result.message, 'SUCCESS');
      onBountyCreated?.();
      onClose();
    } else {
      showToast(result.error, 'ERROR');
    }
    setLoading(false);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <TargetIcon size={32} color="#ff8800" />
          <h2 style={{ margin: '10px 0 0 0', color: '#ff8800' }}>PLACE BOUNTY</h2>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.85rem' }}>
            Put a price on {target.displayName}'s head
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Target Info */}
          <div style={targetCardStyle}>
            <div style={{ fontSize: '2.5rem' }}>👤</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>{target.displayName}</div>
              <div style={{ color: '#ff4444', fontSize: '0.8rem' }}>
                Wanted for Excessive Ghosting
              </div>
            </div>
          </div>

          {/* Amount Selection */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Bounty Amount (Aura Points)</label>
            <div style={amountDisplayStyle}>
              <ZapIcon size={24} color="#ffd700" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(5, parseInt(e.target.value) || 0))}
                style={amountInputStyle}
                min="5"
              />
            </div>
            <div style={presetContainerStyle}>
              {[5, 10, 25, 50, 100].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  style={{
                    ...presetButtonStyle,
                    background: amount === preset ? '#ff8800' : '#1a1a1a',
                    color: amount === preset ? '#000' : '#888',
                    borderColor: amount === preset ? '#ff8800' : '#333'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={labelStyle}>Message (optional)</label>
              <button type="button" onClick={randomMessage} style={randomButtonStyle}>
                🎲 Random
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why are you placing this bounty?"
              style={textareaStyle}
              rows={3}
            />
          </div>

          {/* Warning */}
          <div style={warningStyle}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>
              <strong style={{ color: '#ff8800' }}>Terms:</strong> Bounty expires in 7 days. 
              If unclaimed, points are refunded. Anyone can claim by getting the target to check in.
            </p>
          </div>

          {/* Actions */}
          <div style={actionsStyle}>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...submitButtonStyle,
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'PLACING BOUNTY...' : `PLACE ${amount} AURA BOUNTY`}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={cancelButtonStyle}
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
  background: 'rgba(0,0,0,0.9)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(5px)'
};

const modalStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #333',
  borderRadius: '16px',
  padding: '30px',
  width: '90%',
  maxWidth: '450px',
  maxHeight: '90vh',
  overflowY: 'auto'
};

const headerStyle = {
  textAlign: 'center',
  marginBottom: '25px'
};

const targetCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '20px',
  background: 'rgba(255,68,68,0.1)',
  border: '1px solid #3a0000',
  borderRadius: '12px',
  marginBottom: '20px'
};

const sectionStyle = {
  marginBottom: '20px'
};

const labelStyle = {
  display: 'block',
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '8px'
};

const amountDisplayStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '15px 20px',
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: '10px',
  marginBottom: '12px'
};

const amountInputStyle = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  color: '#ffd700',
  fontSize: '2rem',
  fontWeight: 'bold',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%'
};

const presetContainerStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap'
};

const presetButtonStyle = {
  padding: '8px 16px',
  border: '1px solid',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  transition: 'all 0.2s'
};

const randomButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#ff8800',
  cursor: 'pointer',
  fontSize: '0.75rem'
};

const textareaStyle = {
  width: '100%',
  padding: '12px',
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: '8px',
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  resize: 'vertical',
  boxSizing: 'border-box'
};

const warningStyle = {
  display: 'flex',
  gap: '10px',
  padding: '15px',
  background: 'rgba(255,136,0,0.1)',
  border: '1px solid #332200',
  borderRadius: '8px',
  marginBottom: '20px'
};

const actionsStyle = {
  display: 'flex',
  gap: '10px'
};

const submitButtonStyle = {
  flex: 1,
  padding: '16px',
  background: '#ff8800',
  border: 'none',
  borderRadius: '10px',
  color: '#000',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  cursor: 'pointer',
  letterSpacing: '1px'
};

const cancelButtonStyle = {
  padding: '16px 24px',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: '10px',
  color: '#666',
  cursor: 'pointer'
};

export default CreateBountyModal;
