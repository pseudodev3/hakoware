import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Zap, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './InventoryModal.css';

const CARD_DATA = {
  'STEAL': { name: 'THIEF', desc: "Steal 10% of a bankrupt friend's Aura.", icon: Zap, color: '#ff4444' },
  'REFLECT': { name: 'REFLECT', desc: 'Redirect a bounty placed on you.', cost: 100, icon: Shield, color: '#00e5ff' },
  'PURIFY': { name: 'PURIFY', desc: 'Instantly reset your debt without a voice note.', cost: 200, icon: Sparkles, color: '#00e676' }
};

export const InventoryModal = ({ isOpen, onClose, showToast }) => {
  const { user, useCard } = useAuth();
  const [usingCard, setUsingCard] = React.useState(null);
  const inventory = user?.inventory || [];

  const handleUseCard = async (cardId, idx) => {
    setUsingCard(idx);
    try {
      const result = await useCard(cardId);
      if (result.success) {
        showToast(`SPELL ACTIVATED: ${CARD_DATA[cardId].name}`, 'SUCCESS');
        if (cardId === 'PURIFY') {
          // Debt reset needs a refresh of the main data
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
      title="HUNTER COLLECTION"
      size="md"
    >
      <div className="inventory-container">
        {inventory.length === 0 ? (
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
