import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { sendSystemEmail } from '../../services/emailService';
import { calculateDebt } from '../../utils/gameLogic';
import { useAuth } from '../../contexts/AuthContext';

const SettleModal = ({ isOpen, onClose, contract, friendship, onRefresh, showToast }) => {
  const { user } = useAuth();
  
  if (!isOpen) return null;
  if (!contract && !friendship) return null;

  const isAdmin = true;

  // Support both old contract format and new friendship format
  let displayName, friendId, friendEmail, myData, perspective, friendshipId;
  
  if (friendship && user) {
    // New friendship format
    const isUser1 = friendship.myPerspective === 'user1';
    myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    const friend = isUser1 ? friendship.user2 : friendship.user1;
    
    displayName = friend.displayName;
    friendId = friend.userId;
    friendEmail = friend.email;
    friendshipId = friendship.id;
    perspective = isUser1 ? 'user1Perspective' : 'user2Perspective';
  } else {
    // Old contract format (fallback)
    displayName = contract.name;
    friendId = contract.id;
    friendEmail = contract.email;
    friendshipId = contract.id;
    myData = contract;
  }

  const stats = calculateDebt(myData);

  const handleReset = async () => {
    const confirmMsg = friendship 
      ? `Reset timer for ${displayName}? (Debt will stay at ${stats.totalDebt})`
      : `Reset timer for ${displayName}? (Debt will stay at ${stats.totalDebt})`;
      
    if(confirm(confirmMsg)) {
      try {
        if (friendship) {
          // Update friendship
          const friendshipRef = doc(db, 'friendships', friendshipId);
          await updateDoc(friendshipRef, {
            [`${perspective}.baseDebt`]: stats.totalDebt,
            [`${perspective}.lastInteraction`]: serverTimestamp(),
            lastCheckinAt: serverTimestamp()
          });
        } else {
          // Fallback to old contract update
          const contractRef = doc(db, 'friends', friendId);
          await updateDoc(contractRef, {
            baseDebt: stats.totalDebt,
            lastInteraction: serverTimestamp(),
            lastSpoke: new Date().toISOString()
          });
        }
        
        // Send Email
        sendSystemEmail('RESET', { 
          name: displayName, 
          email: friendEmail,
          totalDebt: stats.totalDebt, 
          daysMissed: stats.daysMissed 
        }, showToast, true);

        showToast("Timer Reset (Interest Baked In)", "SUCCESS");
        onClose();
        onRefresh(`UPDATE: ${displayName.toUpperCase()} TIMER RESET`); 
      } catch (error) {
        console.error('Error resetting timer:', error);
        showToast("Error resetting timer", "ERROR");
      }
    }
  };

  const handlePaid = async () => {
    if(confirm(`Clear all debt for ${displayName}?`)) {
      try {
        if (friendship) {
          // Update friendship - clear debt
          const friendshipRef = doc(db, 'friendships', friendshipId);
          await updateDoc(friendshipRef, {
            [`${perspective}.baseDebt`]: 0,
            [`${perspective}.lastInteraction`]: serverTimestamp(),
            [`${perspective}.status`]: 'active',
            lastCheckinAt: serverTimestamp()
          });
        } else {
          // Fallback to old contract update
          const contractRef = doc(db, 'friends', friendId);
          await updateDoc(contractRef, {
            baseDebt: 0,
            lastInteraction: serverTimestamp(),
            lastSpoke: new Date().toISOString()
          });
        }
        
        sendSystemEmail('PAID', { 
          name: displayName, 
          email: friendEmail,
          totalDebt: 0, 
          daysMissed: 0 
        }, showToast, true);

        showToast("Debt Cleared!", "SUCCESS");
        onClose();
        onRefresh(`BREAKING: ${displayName.toUpperCase()} IS DEBT FREE`);
      } catch (error) {
        console.error('Error clearing debt:', error);
        showToast("Error clearing debt", "ERROR");
      }
    }
  };

  const handleDelete = async () => {
    if(confirm(`DELETE ${displayName} FOREVER?`)) {
      try {
        if (friendship) {
          // Delete friendship
          const friendshipRef = doc(db, 'friendships', friendshipId);
          await deleteDoc(friendshipRef);
        } else {
          // Fallback to old contract delete
          const contractRef = doc(db, 'friends', friendId);
          await deleteDoc(contractRef);
        }
        
        showToast("Contract Deleted", "ERROR");
        onClose();
        onRefresh(`SYSTEM: CONTRACT FOR ${displayName.toUpperCase()} TERMINATED`);
      } catch (error) {
        console.error('Error deleting:', error);
        showToast("Error deleting", "ERROR");
      }
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{color: '#ffd700', marginTop: 0}}>{displayName}</h2>
        <p style={{color: '#888'}}>Choose an action:</p>
        
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '15px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666' }}>Current Debt:</span>
            <span style={{ color: stats.totalDebt > 0 ? '#ff4444' : '#00e676', fontWeight: 'bold' }}>
              {stats.totalDebt} APR
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Days Ghosted:</span>
            <span style={{ color: '#fff' }}>{stats.daysMissed} days</span>
          </div>
        </div>
        
        <button onClick={handleReset} className="action-btn" style={{marginBottom: '10px', background: '#333'}}>
           ⏳ RESET TIMER (Save Interest)
        </button>
        
        <button onClick={handlePaid} className="action-btn" style={{marginBottom: '10px', background: '#004d40', color: '#00e676'}}>
           PAID IN FULL
        </button>
        
        <div style={{margin: '20px 0', borderTop: '1px solid #333'}}></div>
        
        <button onClick={handleDelete} style={{background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', marginBottom:'10px'}}>
           DELETE CONTRACT
        </button>
        
        <button onClick={onClose} style={{background: '#222', color: '#fff'}}>CANCEL</button>
      </div>
    </div>
  );
};

// Simple Styles for the Modal
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const modalStyle = {
  background: '#111', padding: '25px', borderRadius: '12px',
  width: '90%', maxWidth: '400px', border: '1px solid #333', textAlign: 'center'
};

export default SettleModal;
