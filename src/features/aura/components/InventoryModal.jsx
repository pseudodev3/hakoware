import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Zap, Shield, Sparkles, AlertCircle, User, ChevronLeft } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './InventoryModal.css';

const CARD_DATA = {
  'STEAL': { name: 'THIEF', rank: 'A-20', desc: "Steal 10% of a bankrupt friend's Aura.", icon: Zap, color: '#ff4444', targeted: true },
  'REFLECT': { name: 'REFLECT', rank: 'B-30', desc: 'Redirect a bounty placed on you.', cost: 100, icon: Shield, color: '#00e5ff', targeted: false },
  'PURIFY': { name: 'PURIFY', rank: 'S-10', desc: 'Instantly reset your debt without a voice note.', cost: 200, icon: Sparkles, color: '#00e676', targeted: false }
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

  // Greed island binder: group duplicates
  const groupedInventory = inventory.reduce((acc, cardId) => {
    const existing = acc.find(item => item.cardId === cardId);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ cardId, count: 1 });
    }
    return acc;
  }, []);

  const MAX_SLOTS = Math.max(9, Math.ceil(groupedInventory.length / 3) * 3);
  const binderSlots = Array.from({ length: MAX_SLOTS }, (_, i) => groupedInventory[i] || null);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={selectingTargetFor ? "SELECT TARGET" : "GREED ISLAND BINDER"}
      size="lg" // Larger for binder UI
    >
      <div className="inventory-container">
        {selectingTargetFor ? (
          <div className="target-selection-view">
            <button className="back-to-inv" onClick={() => setSelectingTargetFor(null)}>
              <ChevronLeft size={16} /> BACK TO BINDER
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
        ) : (
          <div className="binder-book">
            <div className="binder-page">
              {binderSlots.map((item, idx) => {
                if (!item) {
                  return (
                    <div key={idx} className="binder-slot empty">
                       <span className="slot-number">{String(idx).padStart(3, '0')}</span>
                    </div>
                  )
                }

                const { cardId, count } = item;
                const card = CARD_DATA[cardId];
                if (!card) return null;
                
                return (
                  <motion.div 
                    key={idx} 
                    className="binder-slot filled"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    style={{ '--card-color': card.color }}
                  >
                    <div className="gi-card">
                      {count > 1 && <div className="card-count-badge">x{count}</div>}
                      <div className="gi-card-header">
                        <span className="gi-card-rank">{card.rank}</span>
                        <span className="gi-card-name" style={{ color: card.color }}>{card.name}</span>
                      </div>
                      <div className="gi-card-art" style={{ borderColor: card.color }}>
                        <card.icon size={40} color={card.color} />
                        <div className="gi-card-glow" style={{ backgroundColor: card.color }} />
                      </div>
                      <div className="gi-card-desc">
                        {card.desc}
                      </div>
                      <div className="gi-card-action">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          loading={usingCard === idx}
                          onClick={() => handleUseCard(cardId, idx)}
                          className="gi-use-btn"
                        >
                          MATERIALIZE
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
