import React from 'react';
import { Zap, Shield, Sparkles, ChevronLeft } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './InventoryModal.css';

const CARD_DATA = {
  STEAL: { name: 'Thief', rank: 'A-20', desc: "Steal 10% of a bankrupt friend's Aura.", icon: Zap, color: '#ff747b', targeted: true },
  REFLECT: { name: 'Reflect', rank: 'B-30', desc: 'Redirect a bounty placed on you.', icon: Shield, color: '#7aa7ff', targeted: false },
  PURIFY: { name: 'Purify', rank: 'S-10', desc: 'Instantly reset your debt without a voice note.', icon: Sparkles, color: '#62d6a2', targeted: false }
};

export const InventoryModal = ({ isOpen, onClose, friendships, showToast }) => {
  const { user, useCard } = useAuth();
  const [usingCard, setUsingCard] = React.useState(null);
  const [selectingTargetFor, setSelectingTargetFor] = React.useState(null);
  const inventory = user?.inventory || [];

  const handleUseCard = async (cardId, idx, targetFriendshipId = null) => {
    const isAnyBankrupt = friendships?.some(friendship => {
      const currentUserId = user.uid || user.id;
      const isUser1 = friendship.user1._id === currentUserId || friendship.user1 === currentUserId;
      const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
      if (!perspective) return false;
      const daysMissed = Math.floor(Math.max(0, new Date() - new Date(perspective.lastInteraction)) / (1000 * 60 * 60 * 24));
      return (perspective.baseDebt || 0) + Math.max(0, daysMissed - (perspective.limit || 7)) >= (perspective.limit || 7) * 2;
    });

    if (isAnyBankrupt && cardId !== 'PURIFY') {
      showToast?.('NEN SEALED: RESOLVE BANKRUPTCY FIRST', 'ERROR');
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
        showToast?.(`SPELL ACTIVATED: ${cardInfo.name}`, 'SUCCESS');
        setSelectingTargetFor(null);
        if (cardId === 'PURIFY') window.location.reload();
      } else {
        showToast?.(result.error || 'ACTIVATION FAILED', 'ERROR');
      }
    } catch (err) {
      showToast?.('SYSTEM ERROR', 'ERROR');
    } finally {
      setUsingCard(null);
    }
  };

  const groupedInventory = inventory.reduce((acc, cardId) => {
    const existing = acc.find(item => item.cardId === cardId);
    if (existing) existing.count += 1;
    else acc.push({ cardId, count: 1 });
    return acc;
  }, []);

  const maxSlots = Math.max(9, Math.ceil(groupedInventory.length / 3) * 3);
  const binderSlots = Array.from({ length: maxSlots }, (_, index) => groupedInventory[index] || null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectingTargetFor ? 'Select target' : 'Greed Island Binder'}
      size="lg"
    >
      <div className="inventory-container">
        {selectingTargetFor ? (
          <div className="target-selection-view">
            <button className="back-to-inv" onClick={() => setSelectingTargetFor(null)}>
              <ChevronLeft size={16} strokeWidth={1.8} /> Back to binder
            </button>
            <p className="selection-instruction">Choose a target for {CARD_DATA[selectingTargetFor.cardId].name}.</p>

            <div className="target-grid">
              {friendships.map(friendship => {
                const currentUserId = user.uid || user.id;
                const isUser1 = friendship.user1._id === currentUserId || friendship.user1 === currentUserId;
                const friend = isUser1 ? friendship.user2 : friendship.user1;
                return (
                  <button
                    key={friendship.id || friendship._id}
                    className="target-select-card"
                    onClick={() => handleUseCard(selectingTargetFor.cardId, selectingTargetFor.idx, friendship.id || friendship._id)}
                  >
                    <div className="target-avatar-sm">{friend.displayName?.[0]?.toUpperCase() || '?'}</div>
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
                  );
                }

                const { cardId, count } = item;
                const card = CARD_DATA[cardId];
                if (!card) return null;
                const Icon = card.icon;

                return (
                  <div key={idx} className="binder-slot filled" style={{ '--card-color': card.color }}>
                    <div className="gi-card">
                      {count > 1 && <div className="card-count-badge">×{count}</div>}
                      <div className="gi-card-header">
                        <span className="gi-card-rank">{card.rank}</span>
                        <span className="gi-card-name">{card.name}</span>
                      </div>
                      <div className="gi-card-art">
                        <Icon size={36} strokeWidth={1.7} />
                        <div className="gi-card-glow" aria-hidden="true" />
                      </div>
                      <div className="gi-card-desc">{card.desc}</div>
                      <div className="gi-card-action">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={usingCard === idx}
                          onClick={() => handleUseCard(cardId, idx)}
                          className="gi-use-btn"
                        >
                          Materialize
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
