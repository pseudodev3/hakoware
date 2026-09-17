import React, { useState } from 'react';
import { ShoppingBag, Zap, Shield, Sparkles } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './MarketplaceModal.css';

const CARDS = [
  { id: 'STEAL', name: 'Thief', desc: "Steal 10% of a bankrupt friend's Aura.", cost: 50, icon: Zap, color: '#ff747b' },
  { id: 'REFLECT', name: 'Reflect', desc: 'Redirect a bounty placed on you.', cost: 100, icon: Shield, color: '#7aa7ff' },
  { id: 'PURIFY', name: 'Purify', desc: 'Instantly reset your debt without a voice note.', cost: 200, icon: Sparkles, color: '#62d6a2' }
];

export const MarketplaceModal = ({ isOpen, onClose, friendships, showToast }) => {
  const { user, buyCard } = useAuth();
  const [loading, setLoading] = useState(null);

  const handleBuy = async (card) => {
    const isAnyBankrupt = friendships?.some(friendship => {
      const currentUserId = user.uid || user.id;
      const isUser1 = friendship.user1._id === currentUserId || friendship.user1 === currentUserId;
      const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
      if (!perspective) return false;
      const daysMissed = Math.floor(Math.max(0, new Date() - new Date(perspective.lastInteraction)) / (1000 * 60 * 60 * 24));
      return (perspective.baseDebt || 0) + Math.max(0, daysMissed - (perspective.limit || 7)) >= (perspective.limit || 7) * 2;
    });

    if (isAnyBankrupt) {
      showToast?.('ACCESS DENIED: NEN SEALED', 'ERROR');
      return;
    }

    if (user?.auraBalance < card.cost) {
      showToast?.('INSUFFICIENT AURA', 'ERROR');
      return;
    }

    setLoading(card.id);
    try {
      const result = await buyCard(card);
      if (result.success) showToast?.(`ACQUIRED SPELL CARD: ${card.name}`, 'SUCCESS');
      else showToast?.(result.error || 'PURCHASE FAILED', 'ERROR');
    } catch (err) {
      showToast?.('SYSTEM ERROR', 'ERROR');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Greed Island Market" size="lg">
      <div className="marketplace-container">
        <div className="market-header">
          <div className="market-icon"><ShoppingBag size={20} strokeWidth={1.8} /></div>
          <div className="market-info">
            <h3>Spell card shop</h3>
            <p>Trade Aura for system overrides and one-use advantages.</p>
          </div>
          <div className="current-aura">
            <span>{user?.auraBalance || 0}</span>
            <span className="unit">Aura</span>
          </div>
        </div>

        <div className="cards-grid">
          {CARDS.map(card => {
            const Icon = card.icon;
            return (
              <article key={card.id} className="spell-card" style={{ '--card-color': card.color }}>
                <div className="card-icon-wrapper">
                  <Icon size={27} strokeWidth={1.8} />
                </div>
                <h4>{card.name}</h4>
                <p>{card.desc}</p>
                <Button
                  variant="secondary"
                  className="buy-btn"
                  loading={loading === card.id}
                  onClick={() => handleBuy(card)}
                >
                  Buy · {card.cost} Aura
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
