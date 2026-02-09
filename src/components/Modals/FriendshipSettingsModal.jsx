import { useState, useEffect } from 'react';
import { updateFriendshipLimit, removeFriendship } from '../../services/friendshipService';
import { notifyLimitChanged } from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDebt } from '../../utils/gameLogic';
import { XIcon, AlertIcon, TrashIcon } from '../icons/Icons';

const FriendshipSettingsModal = ({ isOpen, onClose, friendship, showToast, onUpdate }) => {
  const { user } = useAuth();
  const [limit, setLimit] = useState(7);
  const [originalLimit, setOriginalLimit] = useState(7);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (isOpen && friendship) {
      const isUser1 = friendship.myPerspective === 'user1';
      const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
      const currentLimit = myData.limit || 7;
      setLimit(currentLimit);
      setOriginalLimit(currentLimit);
    }
  }, [isOpen, friendship]);

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  const friend = isUser1 ? friendship.user2 : friendship.user1;
  
  const stats = calculateDebt({
    baseDebt: myData.baseDebt,
    lastInteraction: myData.lastInteraction,
    bankruptcyLimit: myData.limit
  });

  const handleSave = async () => {
    if (limit < 1 || limit > 365) {
      showToast('Limit must be between 1 and 365 days', 'ERROR');
      return;
    }

    // Check if limit actually changed
    if (limit === originalLimit) {
      onClose();
      return;
    }

    setLoading(true);
    const result = await updateFriendshipLimit(friendship.id, user.uid, limit);
    
    // Send notification to friend about the limit change
    if (result.success) {
      try {
        await notifyLimitChanged(friendship, user.uid, originalLimit, limit);
      } catch (error) {
        console.error('Error sending limit change notification:', error);
      }
    }
    
    setLoading(false);

    if (result.success) {
      showToast('Friendship settings updated', 'SUCCESS');
      onUpdate();
      onClose();
    } else {
      showToast(result.error || 'Failed to update settings', 'ERROR');
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const result = await removeFriendship(friendship.id, user.uid);
    setDeleteLoading(false);

    if (result.success) {
      showToast('Friendship removed', 'SUCCESS');
      onUpdate();
      onClose();
    } else {
      showToast(result.error || 'Failed to remove friendship', 'ERROR');
    }
  };

  if (showDeleteConfirm) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <AlertIcon size={48} color="#ff4444" />
          </div>
          
          <h2 style={{ color: '#ff4444', marginTop: 0, textAlign: 'center' }}>
            REMOVE FRIEND?
          </h2>
          
          <p style={{ color: '#888', textAlign: 'center', marginBottom: '20px' }}>
            This will permanently delete your friendship with <strong style={{ color: '#fff' }}>{friend.displayName}</strong>.
            All debt history, check-ins, and streaks will be lost.
          </p>

          <div style={{ 
            background: 'rgba(255,68,68,0.1)', 
            border: '1px solid #ff4444',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ color: '#ff8888', fontSize: '0.8rem', marginBottom: '5px' }}>
              Current Status
            </div>
            <div style={{ color: '#fff', fontWeight: 'bold' }}>
              {stats.totalDebt > 0 ? `${stats.totalDebt} APR owed` : 'Debt free'}
            </div>
            <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '5px' }}>
              Streak: {friendship.streak || 0} days
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              style={{
                flex: 1,
                padding: '14px',
                background: deleteLoading ? '#333' : '#330000',
                color: deleteLoading ? '#666' : '#ff4444',
                border: '1px solid #ff4444',
                borderRadius: '6px',
                cursor: deleteLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              {deleteLoading ? 'Removing...' : 'YES, REMOVE'}
            </button>
            
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteLoading}
              style={{
                flex: 1,
                padding: '14px',
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
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#ffd700', margin: 0 }}>FRIENDSHIP SETTINGS</h2>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}
          >
            <XIcon size={24} color="#666" />
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '15px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #333 0%, #111 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              {friend.displayName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600 }}>{friend.displayName}</div>
              <div style={{ color: '#666', fontSize: '0.8rem' }}>{friend.email}</div>
            </div>
          </div>
        </div>

        {/* Ghosting Limit Setting */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{ 
            display: 'block', 
            color: '#888', 
            fontSize: '0.75rem', 
            marginBottom: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Your Ghosting Limit
          </label>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px',
            marginBottom: '10px'
          }}>
            <input
              type="range"
              min="1"
              max="30"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min="1"
              max="365"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 1)}
              style={{
                width: '70px',
                padding: '10px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                textAlign: 'center',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            />
            <span style={{ color: '#666', fontSize: '0.9rem' }}>days</span>
          </div>

          <p style={{ color: '#666', fontSize: '0.8rem', margin: 0 }}>
            You can ghost {friend.displayName} for {limit} days before debt starts accumulating.
            Bankruptcy occurs at {limit * 2} days of debt.
          </p>
        </div>

        {/* Current Stats */}
        <div style={{ 
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>
            Current Stats
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ color: '#888' }}>Your Debt:</span>
            <span style={{ color: stats.totalDebt > 0 ? '#ff4444' : '#00e676', fontWeight: 'bold' }}>
              {stats.totalDebt} APR
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ color: '#888' }}>Days Since Contact:</span>
            <span style={{ color: '#fff' }}>{stats.daysMissed} days</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Longest Streak:</span>
            <span style={{ color: '#ffd700' }}>{friendship.longestStreak || 0} days</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              background: loading ? '#333' : '#004d40',
              color: loading ? '#666' : '#00e676',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            {loading ? 'Saving...' : 'SAVE CHANGES'}
          </button>
          
          <button
            onClick={onClose}
            style={{
              padding: '14px 20px',
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

        {/* Danger Zone */}
        <div style={{ 
          borderTop: '1px solid #222',
          paddingTop: '15px',
          marginTop: '15px'
        }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              width: '100%',
              padding: '12px',
              background: 'transparent',
              color: '#ff4444',
              border: '1px solid #ff4444',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <TrashIcon size={16} color="#ff4444" />
            REMOVE FRIEND
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
  backgroundColor: 'rgba(0,0,0,0.9)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px'
};

const modalStyle = {
  background: '#0f0f0f',
  border: '1px solid #222',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '450px',
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: '25px',
  boxShadow: '0 40px 80px rgba(0,0,0,0.9)'
};

export default FriendshipSettingsModal;
