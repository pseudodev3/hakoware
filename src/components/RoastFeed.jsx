import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { FlameIcon, MessageIcon, SendIcon } from './icons/Icons';

/**
 * Roast Feed - Public Roasts on Bankruptcies
 */
const RoastFeed = ({ bankruptcyId, targetUserId, targetUserName }) => {
  const { user } = useAuth();
  const [roasts, setRoasts] = useState([]);
  const [newRoast, setNewRoast] = useState('');
  const [loading, setLoading] = useState(true);

  const roastTemplates = [
    "Couldn't even text back... embarrassing.",
    "Their phone must be a decorative object at this point.",
    "Ghosted so hard they entered the spirit realm.",
    "Friendship? Never heard of her.",
    "Probably too busy... doing nothing.",
    "Should have bought the 'Being a Friend' DLC.",
    "Their read receipts are just for decoration.",
    "Living that Chapter 7 lifestyle.",
    "Even Toritaten is disappointed.",
    "Phone battery: 100%. Effort: 0%.",
    "The only thing they're consistent at is being inconsistent.",
    "Their voicemail is probably full from all the friends they ignore.",
    "Social skills: Loading... Error 404.",
    "They treat friendships like free trials - ignore until expired.",
    "Communication is a two-way street but they're stuck in a one-way alley."
  ];

  useEffect(() => {
    if (!bankruptcyId) return;
    loadRoasts();
  }, [bankruptcyId]);

  const loadRoasts = async () => {
    try {
      const res = await api.get(`/bankruptcy/${bankruptcyId}/roasts`);
      setRoasts(res);
    } catch (error) {
      console.error('Error loading roasts:', error);
    }
    setLoading(false);
  };

  const submitRoast = async () => {
    if (!newRoast.trim() || !user) return;

    try {
      await api.post(`/bankruptcy/${bankruptcyId}/roast`, {
        targetUserId,
        targetUserName,
        message: newRoast.trim()
      });
      setNewRoast('');
      loadRoasts();
    } catch (error) {
      console.error('Error posting roast:', error);
    }
  };

  const useTemplate = () => {
    const randomTemplate = roastTemplates[Math.floor(Math.random() * roastTemplates.length)];
    setNewRoast(randomTemplate);
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now - then;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  if (loading) {
    return (
      <div style={{ padding: '10px', textAlign: 'center', color: '#444' }}>
        Loading roasts...
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <FlameIcon size={16} color="#ff4444" />
        <span style={{ color: '#ff4444', fontSize: '0.8rem', fontWeight: 'bold' }}>COMMUNITY ROASTS</span>
      </div>

      <div style={inputContainerStyle}>
        <textarea
          value={newRoast}
          onChange={(e) => setNewRoast(e.target.value)}
          placeholder="Roast this bankruptcy..."
          style={textareaStyle}
          maxLength={200}
        />
        <div style={inputActionsStyle}>
          <button onClick={useTemplate} style={templateButtonStyle}>🎲 Random</button>
          <button onClick={submitRoast} disabled={!newRoast.trim()} style={{ ...submitButtonStyle, opacity: newRoast.trim() ? 1 : 0.5, cursor: newRoast.trim() ? 'pointer' : 'not-allowed' }}>
            <SendIcon size={14} color="#fff" /> ROAST
          </button>
        </div>
      </div>

      <div style={roastListStyle}>
        {roasts.length === 0 ? (
          <div style={emptyStateStyle}>
            <MessageIcon size={24} color="#333" />
            <p style={{ margin: '10px 0 0 0', color: '#444', fontSize: '0.8rem' }}>No roasts yet. Be the first!</p>
          </div>
        ) : (
          roasts.map((roast) => (
            <div key={roast.id} style={roastItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ color: '#9c27b0', fontSize: '0.75rem', fontWeight: 'bold' }}>{roast.authorName}</span>
                <span style={{ color: '#444', fontSize: '0.65rem' }}>{formatTimeAgo(roast.createdAt)}</span>
              </div>
              <p style={{ margin: 0, color: '#ccc', fontSize: '0.85rem', lineHeight: '1.4', fontStyle: 'italic' }}>"{roast.message}"</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const containerStyle = { marginTop: '15px', padding: '15px', background: 'rgba(255,68,68,0.03)', border: '1px solid #2a1a1a', borderRadius: '12px' };
const headerStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #1a0000' };
const inputContainerStyle = { marginBottom: '15px' };
const textareaStyle = { width: '100%', minHeight: '60px', padding: '10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', resize: 'vertical', outline: 'none', marginBottom: '8px' };
const inputActionsStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const templateButtonStyle = { padding: '6px 12px', background: 'transparent', border: '1px solid #333', borderRadius: '6px', color: '#666', fontSize: '0.75rem', cursor: 'pointer' };
const submitButtonStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#ff4444', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 'bold', fontSize: '0.75rem' };
const roastListStyle = { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' };
const roastItemStyle = { padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '2px solid #ff4444' };
const emptyStateStyle = { textAlign: 'center', padding: '20px', color: '#444' };

export default RoastFeed;
