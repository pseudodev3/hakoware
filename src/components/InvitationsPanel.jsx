import { useState, useEffect } from 'react';
import { getPendingInvitations, respondToInvitation } from '../services/friendshipService';
import { useAuth } from '../contexts/AuthContext';
import { MailIcon, CheckIcon, XIcon, ChevronDownIcon, ChevronUpIcon, UserIcon } from './icons/Icons';

const InvitationsPanel = ({ onUpdate }) => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadInvitations();
  }, [user]);

  const loadInvitations = async () => {
    setLoading(true);
    const data = await getPendingInvitations(user.uid);
    setInvitations(data);
    setLoading(false);
  };

  const handleRespond = async (invitationId, response) => {
    const result = await respondToInvitation(invitationId, response, user.uid);
    if (result.success) {
      await loadInvitations();
      if (onUpdate) onUpdate();
    }
  };

  const totalCount = invitations.received.length + invitations.sent.length;

  if (loading) return null;
  if (totalCount === 0) return null;

  return (
    <div style={containerStyle}>
      <button 
        onClick={() => setExpanded(!expanded)}
        style={headerStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MailIcon size={18} color="#888" />
          <span>INVITATIONS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {invitations.received.length > 0 && (
            <span style={badgeStyle}>{invitations.received.length}</span>
          )}
          {expanded ? (
            <ChevronUpIcon size={18} color="#666" />
          ) : (
            <ChevronDownIcon size={18} color="#666" />
          )}
        </div>
      </button>

      {expanded && (
        <div style={contentStyle}>
          {invitations.received.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                color: '#555', 
                fontSize: '0.7rem', 
                marginBottom: '12px', 
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                Received
              </h4>
              {invitations.received.map((invite) => (
                <div key={invite.id} style={inviteItemStyle}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <UserIcon size={18} color="#666" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                      {invite.fromUser?.displayName || 'Unknown'}
                    </div>
                    <div style={{ color: '#555', fontSize: '0.8rem' }}>
                      {invite.fromUser?.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <IconButton 
                      onClick={() => handleRespond(invite.id, 'accepted')}
                      icon={<CheckIcon size={18} color="#00e676" />}
                      hoverColor="rgba(0, 230, 118, 0.1)"
                    />
                    <IconButton 
                      onClick={() => handleRespond(invite.id, 'declined')}
                      icon={<XIcon size={18} color="#ff4444" />}
                      hoverColor="rgba(255, 68, 68, 0.1)"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {invitations.sent.length > 0 && (
            <div>
              <h4 style={{ 
                color: '#555', 
                fontSize: '0.7rem', 
                marginBottom: '12px', 
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                Sent
              </h4>
              {invitations.sent.map((invite) => (
                <div key={invite.id} style={inviteItemStyle}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <UserIcon size={18} color="#666" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                      {invite.toUser?.displayName || invite.toEmail}
                    </div>
                    <div style={{ color: '#555', fontSize: '0.8rem' }}>
                      {invite.toUser?.email || invite.toEmail}
                    </div>
                  </div>
                  <span style={{ 
                    color: '#444', 
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const IconButton = ({ onClick, icon, hoverColor }) => (
  <button
    onClick={onClick}
    style={{
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: '1px solid #333',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = hoverColor;
      e.currentTarget.style.borderColor = hoverColor.includes('118') ? '#00e676' : '#ff4444';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderColor = '#333';
    }}
  >
    {icon}
  </button>
);

const containerStyle = {
  margin: '0 20px 20px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid #1a1a1a',
  borderRadius: '12px',
  overflow: 'hidden'
};

const headerStyle = {
  width: '100%',
  padding: '16px 20px',
  background: 'transparent',
  border: 'none',
  color: '#888',
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

const inviteItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '14px',
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '10px',
  marginBottom: '10px',
  border: '1px solid #1a1a1a'
};

export default InvitationsPanel;
