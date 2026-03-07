import React, { useState } from 'react';
import { Target, Zap, AlertTriangle, Dice5, User, Check } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { createBounty } from '../../../services/bountyService';
import { useAuth } from '../../../contexts/AuthContext';
import './CreateBountyModal.css';

/**
 * High-fidelity Create Bounty Modal.
 * Allows users to place a price on a ghosting friend's head.
 */
export const CreateBountyModal = ({ isOpen, onClose, friendships, onRefresh, showToast }) => {
  const { user } = useAuth();
  const [selectedFriendship, setSelectedFriendship] = useState(null);
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFriendship) {
      showToast('SELECT A TARGET FOR THE ASSOCIATION', 'ERROR');
      return;
    }
    if (amount < 5) {
      showToast('MINIMUM BOUNTY: 5 AURA', 'ERROR');
      return;
    }

    setLoading(true);
    try {
      const isUser1 = selectedFriendship.user1._id === (user.uid || user.id) || selectedFriendship.user1 === (user.uid || user.id);
      const target = isUser1 ? selectedFriendship.user2 : selectedFriendship.user1;

      const result = await createBounty({
        senderId: user.uid || user.id,
        senderName: user.displayName,
        targetId: target._id || target.id,
        targetName: target.displayName,
        friendshipId: selectedFriendship.id || selectedFriendship._id,
        amount,
        message
      });

      if (result.success || !result.msg) {
        showToast('BOUNTY PLACED ON BLACKLIST', 'SUCCESS');
        onRefresh();
        onClose();
      } else {
        showToast(result.msg || 'FAILED TO PLACE BOUNTY', 'ERROR');
      }
    } catch (err) {
      showToast('SYSTEM ERROR: BOUNTY PROTOCOL FAILED', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomMessage = () => {
    const targetName = selectedFriendship ? 
      (selectedFriendship.user1._id === (user.uid || user.id) ? selectedFriendship.user2.displayName : selectedFriendship.user1.displayName) 
      : 'TARGET';
    const presets = [
      `${targetName} HAS ENTERED THE SPIRIT REALM.`,
      `I HAVEN'T HEARD FROM ${targetName} IN FOREVER!`,
      `REWARD FOR SUCCESSFUL CONTACT WITH ${targetName}.`,
      `LAST SEEN TEXTING "LOL" 3 WEEKS AGO.`
    ];
    setMessage(presets[Math.floor(Math.random() * presets.length)]);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="BLACKLIST AUTHORIZATION"
      size="md"
    >
      <form className="bounty-modal-form" onSubmit={handleSubmit}>
        <div className="association-warning glass">
           <AlertTriangle size={20} color="var(--aura-gold)" />
           <p>Bounties are publicly visible in the Arena. Aura will be deducted upon placement.</p>
        </div>

        <div className="form-section">
           <label className="input-label">SELECT TARGET</label>
           <div className="friend-selector-grid">
              {friendships.map(f => {
                const isUser1 = f.user1._id === (user.uid || user.id) || f.user1 === (user.uid || user.id);
                const friend = isUser1 ? f.user2 : f.user1;
                const isSelected = selectedFriendship?.id === f.id || selectedFriendship?._id === f._id;
                
                return (
                  <button 
                    key={f.id || f._id}
                    type="button"
                    className={`friend-select-card glass ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedFriendship(f)}
                  >
                     <div className="friend-avatar-small">
                        {isSelected ? <Check size={16} /> : friend.displayName[0]}
                     </div>
                     <span className="friend-name-small">{friend.displayName}</span>
                     {isSelected && (
                       <motion.div 
                         initial={{ scale: 0 }}
                         animate={{ scale: 1 }}
                         className="selection-badge"
                       >
                         <Check size={10} />
                       </motion.div>
                     )}
                  </button>
                );
              })}
           </div>
        </div>

        <div className="form-section">
           <label className="input-label">AURA REWARD</label>
           <div className="aura-input-wrapper">
              <Zap size={24} color="var(--aura-gold)" />
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(Math.max(5, parseInt(e.target.value) || 0))}
                className="aura-amount-input"
              />
              <span className="unit">AURA</span>
           </div>
           <div className="preset-amounts">
              {[10, 25, 50, 100].map(p => (
                <button 
                  key={p} 
                  type="button" 
                  className={`preset-btn ${amount === p ? 'active' : ''}`}
                  onClick={() => setAmount(p)}
                >
                  {p}
                </button>
              ))}
           </div>
        </div>

        <div className="form-section">
           <div className="label-with-action">
              <label className="input-label">MESSAGE</label>
              <button type="button" className="action-link-small" onClick={generateRandomMessage}>
                <Dice5 size={12} /> RANDOMIZE
              </button>
           </div>
           <textarea 
             className="bounty-textarea glass"
             placeholder="Why is this hunter wanted?"
             value={message}
             onChange={(e) => setMessage(e.target.value)}
           />
        </div>

        <div className="modal-actions-bounty">
           <Button variant="secondary" className="flex-1" onClick={onClose}>ABORT</Button>
           <Button 
            variant="danger" 
            className="flex-1" 
            icon={Target} 
            loading={loading}
            type="submit"
           >
             PLACE BOUNTY
           </Button>
        </div>
      </form>
    </Modal>
  );
};
