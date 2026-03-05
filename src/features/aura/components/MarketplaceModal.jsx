import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Zap, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './MarketplaceModal.css';

const CARDS = [
  { id: 'STEAL', name: 'THIEF', desc: "Steal 10% of a bankrupt friend's Aura.", cost: 50, icon: Zap, color: '#ff4444' },
  { id: 'REFLECT', name: 'REFLECT', desc: 'Redirect a bounty placed on you.', cost: 100, icon: Shield, color: '#00e5ff' },
  { id: 'PURIFY', name: 'PURIFY', desc: 'Instantly reset your debt without a voice note.', cost: 200, icon: Sparkles, color: '#00e676' }
];

export const MarketplaceModal = ({ isOpen, onClose, showToast }) => {
  const { user, buyCard } = useAuth();
  const [loading, setLoading] = useState(null);

  const handleBuy = async (card) => {
    if (user?.auraBalance < card.cost) {
      showToast('INSUFFICIENT AURA', 'ERROR');
      return;
    }
    
    setLoading(card.id);
    try {
      const result = await buyCard(card);
      if (result.success) {
        showToast(`ACQUIRED SPELL CARD: ${card.name}`, 'SUCCESS');
      } else {
        showToast(result.error || 'PURCHASE FAILED', 'ERROR');
      }
    } catch (err) {
      showToast('SYSTEM ERROR', 'ERROR');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="GREED ISLAND MARKET"
      size="lg"
    >
      <div className="marketplace-container">
        <div className="market-header glass">
          <ShoppingBag size={24} color="var(--aura-gold)" />
          <div className="market-info">
            <h3>SPELL CARD SHOP</h3>
            <p>Trade your Aura for powerful system overrides.</p>
          </div>
          <div className="current-aura">
             <span>{user?.auraBalance || 0}</span>
             <span className="unit">AURA</span>
          </div>
        </div>

        <div className="cards-grid">
          {CARDS.map(card => (
            <motion.div 
              key={card.id}
              className="spell-card glass"
              style={{ '--card-color': card.color }}
              whileHover={{ y: -5, borderColor: card.color, boxShadow: `0 10px 20px -10px ${card.color}` }}
            >
              <div className="card-icon-wrapper" style={{ color: card.color }}>
                <card.icon size={32} />
              </div>
              <h4 style={{ color: card.color }}>{card.name}</h4>
              <p>{card.desc}</p>
              
              <Button 
                variant="secondary" 
                className="buy-btn"
                loading={loading === card.id}
                onClick={() => handleBuy(card)}
              >
                BUY • {card.cost} AURA
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
