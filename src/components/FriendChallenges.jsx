import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { calculateDebt } from '../utils/gameLogic';
import { TargetIcon, TrophyIcon, ClockIcon, AlertIcon } from './icons/Icons';

/**
 * Friend Challenges - Competitive Accountability
 * 
 * Challenge a friend to:
 * - Maintain the longest clean streak
 * - Avoid bankruptcy the longest
 * - Most check-ins in a week
 * 
 * Winner gets Aura Points / Bragging rights
 */
const FriendChallenges = ({ friendships = [], showToast }) => {
  const { user } = useAuth();
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [pendingChallenges, setPendingChallenges] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [challengeType, setChallengeType] = useState('clean_streak');
  const [duration, setDuration] = useState(7);
  const [loading, setLoading] = useState(true);

  const CHALLENGE_TYPES = {
    clean_streak: {
      label: 'Clean Streak Battle',
      description: 'Who can maintain a debt-free streak the longest?',
      icon: '✨',
      metric: 'days without debt'
    },
    checkins: {
      label: 'Check-in Marathon',
      description: 'Most check-ins in the time period wins',
      icon: '📅',
      metric: 'total check-ins'
    },
    no_bankruptcy: {
      label: 'Bankruptcy Avoidance',
      description: 'Stay out of bankruptcy the longest',
      icon: '🛡️',
      metric: 'days survived'
    }
  };

  useEffect(() => {
    if (user) {
      loadChallenges();
    }
  }, [user]);

  const loadChallenges = async () => {
    setLoading(true);
    try {
      // Get active challenges where user is participant
      const challengesQuery = query(
        collection(db, 'friendChallenges'),
        where('status', 'in', ['active', 'pending'])
      );

      const snapshot = await getDocs(challengesQuery);
      const active = [];
      const pending = [];

      snapshot.docs.forEach(docSnap => {
        const data = { id: docSnap.id, ...docSnap.data() };
        
        // Check if user is involved
        if (data.challengerId === user.uid || data.targetId === user.uid) {
          if (data.status === 'pending' && data.targetId === user.uid) {
            pending.push(data);
          } else if (data.status === 'active') {
            active.push(data);
          }
        }
      });

      setActiveChallenges(active);
      setPendingChallenges(pending);
    } catch (error) {
      console.error('Error loading challenges:', error);
    }
    setLoading(false);
  };

  const createChallenge = async () => {
    if (!selectedFriend) return;

    try {
      const challengeData = {
        challengerId: user.uid,
        challengerName: user.displayName || 'Anonymous',
        targetId: selectedFriend.id,
        targetName: selectedFriend.name,
        type: challengeType,
        duration: duration,
        status: 'pending',
        createdAt: serverTimestamp(),
        startedAt: null,
        endsAt: null,
        challengerScore: 0,
        targetScore: 0,
        winner: null
      };

      await addDoc(collection(db, 'friendChallenges'), challengeData);
      showToast('Challenge sent!', 'SUCCESS');
      setShowCreateModal(false);
      loadChallenges();
    } catch (error) {
      console.error('Error creating challenge:', error);
      showToast('Failed to create challenge', 'ERROR');
    }
  };

  const respondToChallenge = async (challengeId, accept) => {
    try {
      const challengeRef = doc(db, 'friendChallenges', challengeId);
      
      if (accept) {
        const now = new Date();
        const endsAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
        
        await updateDoc(challengeRef, {
          status: 'active',
          startedAt: serverTimestamp(),
          endsAt: endsAt
        });
        showToast('Challenge accepted! Game on!', 'SUCCESS');
      } else {
        await deleteDoc(challengeRef);
        showToast('Challenge declined', 'INFO');
      }
      
      loadChallenges();
    } catch (error) {
      console.error('Error responding to challenge:', error);
    }
  };

  const getTimeRemaining = (endsAt) => {
    const end = endsAt?.toDate ? endsAt.toDate() : new Date(endsAt);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Loading Challenges...
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TargetIcon size={28} color="#9c27b0" />
          <div>
            <h2 style={{ margin: 0, color: '#9c27b0', fontSize: '1.2rem' }}>FRIEND CHALLENGES</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              Compete with friends • Winner takes all
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)}
          style={createButtonStyle}
        >
          + NEW CHALLENGE
        </button>
      </div>

      {/* Pending Challenges */}
      {pendingChallenges.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 15px 0', color: '#ff8800', fontSize: '0.9rem' }}>
            ⚔️ Pending Challenges
          </h3>
          {pendingChallenges.map(challenge => (
            <div key={challenge.id} style={pendingCardStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
                  {CHALLENGE_TYPES[challenge.type]?.label}
                </div>
                <div style={{ color: '#888', fontSize: '0.8rem' }}>
                  Challenged by <strong style={{ color: '#9c27b0' }}>{challenge.challengerName}</strong>
                </div>
                <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '5px' }}>
                  {CHALLENGE_TYPES[challenge.type]?.description}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => respondToChallenge(challenge.id, true)}
                  style={{ ...actionButtonStyle, background: '#00e676', color: '#000' }}
                >
                  ACCEPT
                </button>
                <button 
                  onClick={() => respondToChallenge(challenge.id, false)}
                  style={{ ...actionButtonStyle, background: '#333', color: '#888' }}
                >
                  DECLINE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Challenges */}
      {activeChallenges.length > 0 ? (
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 15px 0', color: '#9c27b0', fontSize: '0.9rem' }}>
            🔥 Active Battles
          </h3>
          {activeChallenges.map(challenge => (
            <div key={challenge.id} style={activeCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.5rem' }}>{CHALLENGE_TYPES[challenge.type]?.icon}</span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 'bold' }}>
                      {CHALLENGE_TYPES[challenge.type]?.label}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.75rem' }}>
                      {CHALLENGE_TYPES[challenge.type]?.metric}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ff8800', fontSize: '0.8rem' }}>
                  <ClockIcon size={14} color="#ff8800" />
                  {getTimeRemaining(challenge.endsAt)}
                </div>
              </div>

              {/* VS Display */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                {/* Challenger */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ 
                    width: '50px', 
                    height: '50px', 
                    borderRadius: '50%', 
                    background: '#1a1a1a',
                    border: `2px solid ${challenge.challengerId === user.uid ? '#9c27b0' : '#333'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                    fontSize: '1.2rem'
                  }}>
                    {challenge.challengerName.charAt(0)}
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {challenge.challengerName}
                  </div>
                  <div style={{ color: '#9c27b0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {challenge.challengerScore}
                  </div>
                </div>

                {/* VS */}
                <div style={{ 
                  padding: '10px 20px', 
                  background: 'rgba(156,39,176,0.2)', 
                  borderRadius: '8px',
                  color: '#9c27b0',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  VS
                </div>

                {/* Target */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ 
                    width: '50px', 
                    height: '50px', 
                    borderRadius: '50%', 
                    background: '#1a1a1a',
                    border: `2px solid ${challenge.targetId === user.uid ? '#9c27b0' : '#333'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                    fontSize: '1.2rem'
                  }}>
                    {challenge.targetName.charAt(0)}
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {challenge.targetName}
                  </div>
                  <div style={{ color: '#9c27b0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {challenge.targetScore}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚔️</div>
          <p style={{ color: '#666', margin: 0 }}>No active challenges</p>
          <p style={{ color: '#444', fontSize: '0.8rem', margin: '5px 0 15px 0' }}>
            Challenge a friend to a friendly competition!
          </p>
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px 0', color: '#9c27b0' }}>⚔️ Issue Challenge</h3>
            
            {/* Select Friend */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>
                Select Opponent
              </label>
              <select
                value={selectedFriend?.id || ''}
                onChange={(e) => {
                  const friend = friendships.find(f => {
                    const id = f.myPerspective === 'user1' ? f.user2Id : f.user1Id;
                    return id === e.target.value;
                  });
                  if (friend) {
                    const friendData = friend.myPerspective === 'user1' ? friend.user2 : friend.user1;
                    setSelectedFriend({ id: friendData.userId, name: friendData.displayName });
                  }
                }}
                style={selectStyle}
              >
                <option value="">Choose a friend...</option>
                {friendships.map(f => {
                  const friendData = f.myPerspective === 'user1' ? f.user2 : f.user1;
                  return (
                    <option key={f.id} value={friendData.userId}>
                      {friendData.displayName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Select Challenge Type */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>
                Challenge Type
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(CHALLENGE_TYPES).map(([key, type]) => (
                  <button
                    key={key}
                    onClick={() => setChallengeType(key)}
                    style={{
                      ...typeButtonStyle,
                      borderColor: challengeType === key ? '#9c27b0' : '#333',
                      background: challengeType === key ? 'rgba(156,39,176,0.1)' : 'transparent'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{type.icon}</span>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {type.label}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.75rem' }}>
                        {type.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>
                Duration: {duration} days
              </label>
              <input
                type="range"
                min="3"
                max="30"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#444', fontSize: '0.7rem', marginTop: '5px' }}>
                <span>3 days</span>
                <span>30 days</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ ...modalActionButtonStyle, background: '#333', color: '#888' }}
              >
                CANCEL
              </button>
              <button 
                onClick={createChallenge}
                disabled={!selectedFriend}
                style={{ 
                  ...modalActionButtonStyle, 
                  background: '#9c27b0', 
                  color: '#fff',
                  opacity: selectedFriend ? 1 : 0.5,
                  cursor: selectedFriend ? 'pointer' : 'not-allowed'
                }}
              >
                ISSUE CHALLENGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 25px',
  borderBottom: '1px solid #222',
  background: 'linear-gradient(90deg, rgba(156,39,176,0.05) 0%, transparent 100%)'
};

const createButtonStyle = {
  padding: '10px 20px',
  background: '#9c27b0',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '0.8rem',
  letterSpacing: '0.5px'
};

const sectionStyle = {
  padding: '20px',
  borderBottom: '1px solid #1a1a1a'
};

const pendingCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '15px',
  background: 'rgba(255,136,0,0.05)',
  border: '1px solid #332200',
  borderRadius: '12px',
  marginBottom: '10px'
};

const activeCardStyle = {
  padding: '20px',
  background: 'rgba(156,39,176,0.05)',
  border: '1px solid #2a1a30',
  borderRadius: '12px',
  marginBottom: '10px'
};

const actionButtonStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  fontSize: '0.75rem',
  cursor: 'pointer'
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '40px 20px'
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px'
};

const modalContentStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #333',
  borderRadius: '16px',
  padding: '25px',
  maxWidth: '400px',
  width: '100%',
  maxHeight: '80vh',
  overflowY: 'auto'
};

const selectStyle = {
  width: '100%',
  padding: '12px',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9rem',
  outline: 'none'
};

const typeButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  border: '1px solid',
  borderRadius: '8px',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left'
};

const modalActionButtonStyle = {
  flex: 1,
  padding: '12px',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  cursor: 'pointer'
};

export default FriendChallenges;
