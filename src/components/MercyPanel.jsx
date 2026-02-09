import { useState, useEffect } from 'react';
import { getPendingMercyRequests, respondToMercyRequest } from '../services/bankruptcyService';
import { notifyMercyResponse } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { ShieldIcon, CheckIcon, XIcon, MessageIcon, ChevronDownIcon, ChevronUpIcon } from './icons/Icons';

const MercyPanel = ({ onUpdate }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(null);
  const [condition, setCondition] = useState('');
  const [showConditionInput, setShowConditionInput] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    setLoading(true);
    const data = await getPendingMercyRequests(user.uid);
    setRequests(data);
    setLoading(false);
  };

  const handleResponse = async (requestId, response) => {
    if (response === 'countered') {
      setResponding(requestId);
      setShowConditionInput(true);
      return;
    }

    // Find the request data for notification
    const request = requests.find(r => r.id === requestId);

    setResponding(requestId);
    const result = await respondToMercyRequest(requestId, response);
    
    // Send notification to the requester
    if (result.success && request) {
      try {
        await notifyMercyResponse(request, response);
      } catch (error) {
        console.error('Error sending mercy notification:', error);
      }
    }
    
    setResponding(null);

    if (result.success) {
      await loadRequests();
      if (onUpdate) onUpdate();
    }
  };

  const handleCounterSubmit = async () => {
    if (!condition.trim()) return;

    // Find the request data for notification
    const request = requests.find(r => r.id === responding);

    setResponding('submitting');
    const result = await respondToMercyRequest(responding, 'countered', condition);
    
    // Send notification to the requester
    if (result.success && request) {
      try {
        await notifyMercyResponse(request, 'countered', condition);
      } catch (error) {
        console.error('Error sending mercy notification:', error);
      }
    }
    
    setResponding(null);
    setShowConditionInput(false);
    setCondition('');

    if (result.success) {
      await loadRequests();
      if (onUpdate) onUpdate();
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div style={containerStyle}>
      <button 
        onClick={() => setExpanded(!expanded)}
        style={headerStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldIcon size={18} color="#ff4444" />
          <span style={{ color: '#ff6666' }}>MERCY PETITIONS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={badgeStyle}>{requests.length}</span>
          {expanded ? (
            <ChevronUpIcon size={18} color="#666" />
          ) : (
            <ChevronDownIcon size={18} color="#666" />
          )}
        </div>
      </button>

      {expanded && (
        <div style={contentStyle}>
          {requests.map((request) => (
            <div key={request.id} style={requestItemStyle}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
                  {request.requesterName}
                </div>
                <div style={{ 
                  color: '#ff4444', 
                  fontSize: '0.7rem', 
                  marginTop: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  BANKRUPT — Seeking Mercy
                </div>
              </div>

              {request.message && (
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  borderLeft: '3px solid #ff4444'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <MessageIcon size={14} color="#555" />
                    <span style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase' }}>Their Plea</span>
                  </div>
                  <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    "{request.message}"
                  </p>
                </div>
              )}

              {showConditionInput && responding === request.id ? (
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="Set a condition (e.g., Buy me lunch)"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#0a0a0a',
                      border: '1px solid #ffd700',
                      borderRadius: '8px',
                      color: '#fff',
                      marginBottom: '10px',
                      boxSizing: 'border-box',
                      fontSize: '0.9rem'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleCounterSubmit}
                      disabled={responding === 'submitting' || !condition.trim()}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: responding === 'submitting' ? '#333' : 'rgba(255, 215, 0, 0.1)',
                        color: '#ffd700',
                        border: '1px solid #ffd700',
                        borderRadius: '8px',
                        cursor: responding === 'submitting' || !condition.trim() ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      {responding === 'submitting' ? 'Sending...' : 'Send Condition'}
                    </button>
                    <button
                      onClick={() => {
                        setShowConditionInput(false);
                        setResponding(null);
                      }}
                      style={{
                        padding: '10px 16px',
                        background: 'transparent',
                        color: '#666',
                        border: '1px solid #333',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ActionButton
                    onClick={() => handleResponse(request.id, 'granted')}
                    disabled={responding === request.id}
                    label={responding === request.id ? '...' : 'Grant Mercy'}
                    variant="success"
                    icon={<CheckIcon size={16} color="#00e676" />}
                  />
                  <ActionButton
                    onClick={() => handleResponse(request.id, 'countered')}
                    disabled={responding === request.id}
                    label="Counter"
                    variant="warning"
                  />
                  <ActionButton
                    onClick={() => handleResponse(request.id, 'declined')}
                    disabled={responding === request.id}
                    label=""
                    variant="danger"
                    icon={<XIcon size={16} color="#ff4444" />}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ onClick, disabled, label, variant, icon }) => {
  const styles = {
    success: {
      bg: 'rgba(0, 230, 118, 0.1)',
      border: '#00e676',
      color: '#00e676'
    },
    warning: {
      bg: 'rgba(255, 215, 0, 0.1)',
      border: '#ffd700',
      color: '#ffd700'
    },
    danger: {
      bg: 'rgba(255, 68, 68, 0.1)',
      border: '#ff4444',
      color: '#ff4444',
      width: '40px'
    }
  };

  const style = styles[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: variant === 'danger' ? 'none' : 1,
        width: style.width,
        padding: '10px',
        background: disabled ? '#1a1a1a' : style.bg,
        color: disabled ? '#444' : style.color,
        border: `1px solid ${disabled ? '#333' : style.border}`,
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = style.bg.replace('0.1', '0.2');
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = style.bg;
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
};

const containerStyle = {
  margin: '0 20px 20px',
  background: 'rgba(255,68,68,0.03)',
  border: '1px solid rgba(255,68,68,0.15)',
  borderRadius: '12px',
  overflow: 'hidden'
};

const headerStyle = {
  width: '100%',
  padding: '16px 20px',
  background: 'transparent',
  border: 'none',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  letterSpacing: '1px',
  transition: 'color 0.2s'
};

const badgeStyle = {
  background: '#ff4444',
  color: '#fff',
  fontSize: '0.7rem',
  padding: '3px 8px',
  borderRadius: '12px',
  fontWeight: 700
};

const contentStyle = {
  padding: '0 20px 20px'
};

const requestItemStyle = {
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '10px',
  padding: '18px',
  marginBottom: '12px',
  border: '1px solid rgba(255,68,68,0.1)'
};

export default MercyPanel;
