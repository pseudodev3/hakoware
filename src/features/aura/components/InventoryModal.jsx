import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Zap, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { User, ChevronLeft } from 'lucide-react';
import './InventoryModal.css';

const CARD_DATA = {
  'STEAL': { name: 'THIEF', desc: "Steal 10% of a bankrupt friend's Aura.", icon: Zap, color: '#ff4444', targeted: true },
  'REFLECT': { name: 'REFLECT', desc: 'Redirect a bounty placed on you.', cost: 100, icon: Shield, color: '#00e5ff', targeted: false },
  'PURIFY': { name: 'PURIFY', desc: 'Instantly reset your debt without a voice note.', cost: 200, icon: Sparkles, color: '#00e676', targeted: false }
};

export const InventoryModal = ({ isOpen, onClose, friendships, showToast }) => {
  const { user, useCard } = useAuth();
  const [usingCard, setUsingCard] = React.useState(null);
  const [selectingTargetFor, setSelectingTargetFor] = React.useState(null);
  const inventory = user?.inventory || [];

  const handleUseCard = async (cardId, idx, targetFriendshipId = null) => {
    // Check if any friendship is bankrupt (Zetsu mode)
    const isAnyBankrupt = friendships?.some(f => {
      const isU1 = f.user1._id === (user.uid || user.id) || f.user1 === (user.uid || user.id);
      const p = isU1 ? f.user1Perspective : f.user2Perspective;
      if (!p) return false;
      const daysMissed = Math.floor(Math.max(0, new Date() - new Date(p.lastInteraction)) / (1000 * 60 * 60 * 24));
      return (p.baseDebt || 0) + Math.max(0, daysMissed - (p.limit || 7)) >= (p.limit || 7) * 2;
    });

    if (isAnyBankrupt && cardId !== 'PURIFY') {
      showToast('NEN SEALED: RESOLVE BANKRUPTCY FIRST', 'ERROR');
      return;
    }

    const cardInfo = CARD_DATA[cardId];
    
    if (cardInfo.targeted && !targetFriendshipId) {
      setSelectingTargetFor({ cardId, idx });
      return;
    }

    setUsingCard(idx);
    try {
      const result = await useCard(cardId, targetFriendshipId);
      if (result.success) {
        showToast(`SPELL ACTIVATED: ${cardInfo.name}`, 'SUCCESS');
        setSelectingTargetFor(null);
        if (cardId === 'PURIFY') {
          window.location.reload();
        }
      } else {
        showToast(result.error || 'ACTIVATION FAILED', 'ERROR');
      }
    } catch (err) {
      showToast('SYSTEM ERROR', 'ERROR');
    } finally {
      setUsingCard(null);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={selectingTargetFor ? "SELECT TARGET" : "HUNTER COLLECTION"}
      size="md"
    >
      <div className="inventory-container">
        {selectingTargetFor ? (
          <div className="target-selection-view">
            <button className="back-to-inv" onClick={() => setSelectingTargetFor(null)}>
              <ChevronLeft size={16} /> BACK TO COLLECTION
            </button>
            <p className="selection-instruction">CHOOSE A TARGET FOR {CARD_DATA[selectingTargetFor.cardId].name}</p>
            
            <div className="target-grid">
              {friendships.map(f => {
                const isUser1 = f.user1._id === (user.uid || user.id) || f.user1 === (user.uid || user.id);
                const friend = isUser1 ? f.user2 : f.user1;
                return (
                  <button 
                    key={f.id || f._id} 
                    className="target-select-card glass"
                    onClick={() => handleUseCard(selectingTargetFor.cardId, selectingTargetFor.idx, f.id || f._id)}
                  >
                    <div className="target-avatar-sm">{friend.displayName[0]}</div>
                    <span>{friend.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : inventory.length === 0 ? (
          <div className="inventory-empty">
            <Package size={48} opacity={0.2} />
            <p>YOUR COLLECTION IS EMPTY</p>
            <span>PURCHASE SPELL CARDS IN THE MARKET</span>
          </div>
        ) : (
          <div className="inventory-grid">
            {inventory.map((cardId, idx) => {
              const card = CARD_DATA[cardId];
              if (!card) return null;
              return (
                <motion.div 
                  key={idx} 
                  className="inventory-card glass"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="inv-icon" style={{ color: card.color }}>
                    <card.icon size={24} />
                  </div>
                  <div className="inv-info">
                    <span className="inv-name" style={{ color: card.color }}>{card.name}</span>
                    <p className="inv-desc">{card.desc}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    loading={usingCard === idx}
                    onClick={() => handleUseCard(cardId, idx)}
                  >
                    USE CARD
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
