import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAuraCards, getUserAura } from '../../services/auraService';
import { Button } from '../../shared/components/Button';
import './YouView.css';

const bankruptFriendship = (friendship, userId) => {
  const user1Id = friendship.user1?._id || friendship.user1;
  const isUser1 = String(user1Id) === String(userId);
  const perspective = isUser1 ? friendship.user2Perspective : friendship.user1Perspective;
  const limit = Number(perspective?.limit) || 7;
  const days = Math.floor(Math.max(0, Date.now() - new Date(perspective?.lastInteraction || Date.now())) / 86400000);
  const debt = (perspective?.baseDebt || 0) + Math.max(0, days - limit);
  return debt >= limit * 2;
};

const typeLabel = (type) => String(type || '').replaceAll('_', ' ').toLowerCase();

export const YouView = ({ friendships, showToast }) => {
  const { user, refreshUser, buyCard, useCard } = useAuth();
  const [aura, setAura] = useState({ balance: user.auraBalance || 0, history: [], totalEarned: 0, totalSpent: 0 });
  const [cards, setCards] = useState([]);
  const [busy, setBusy] = useState(null);
  const [stealTarget, setStealTarget] = useState('');
  const userId = user.uid || user.id || user._id;

  const refresh = async () => {
    const [nextAura, nextCards] = await Promise.all([getUserAura(), getAuraCards()]);
    setAura(nextAura);
    setCards(nextCards);
    await refreshUser();
  };

  useEffect(() => { refresh(); }, []);

  const bankrupt = useMemo(() => friendships.filter((f) => bankruptFriendship(f, userId)), [friendships, userId]);
  const inventory = user.inventory || [];

  const purchase = async (card) => {
    setBusy(`buy-${card.id}`);
    const result = await buyCard(card);
    showToast?.(result.success ? `${card.name} added to your inventory` : result.error, result.success ? 'SUCCESS' : 'ERROR');
    await refresh();
    setBusy(null);
  };

  const useOwnedCard = async (cardId) => {
    if (cardId === 'STEAL' && !stealTarget) {
      showToast?.('Choose a bankrupt contract first', 'ERROR');
      return;
    }
    setBusy(`use-${cardId}`);
    const result = await useCard(cardId, cardId === 'STEAL' ? stealTarget : null);
    showToast?.(result.success ? 'Card used' : result.error, result.success ? 'SUCCESS' : 'ERROR');
    await refresh();
    setBusy(null);
  };

  return (
    <div className="you-view">
      <section className="identity-card">
        <div className="identity-avatar">{user.displayName?.[0]?.toUpperCase()}</div>
        <div className="identity-copy">
          <p className="eyebrow">You</p>
          <h1>{user.displayName}</h1>
          <p>{user.email}</p>
        </div>
        <div className="nen-chip"><Sparkles size={14} strokeWidth={1.8} /> {user.nenType ? typeLabel(user.nenType) : 'No affinity'}</div>
      </section>

      <section className="aura-balance-card">
        <div>
          <p className="eyebrow">Aura</p>
          <div className="aura-number">{aura.balance}</div>
          <p>Earned {aura.totalEarned} · Spent {aura.totalSpent}</p>
        </div>
        <Zap size={26} strokeWidth={1.6} />
      </section>

      {inventory.length > 0 && (
        <section className="you-section">
          <div className="you-section-heading">
            <div><p className="eyebrow">Inventory</p><h2>Cards you can use</h2></div>
          </div>
          <div className="inventory-list">
            {[...new Set(inventory)].map((cardId) => {
              const card = cards.find((item) => item.id === cardId) || { id: cardId, name: typeLabel(cardId), description: '' };
              const count = inventory.filter((item) => item === cardId).length;
              return (
                <article className="inventory-card" key={cardId}>
                  <div><strong>{card.name}</strong><span>{count} owned</span></div>
                  {cardId === 'STEAL' && (
                    <select value={stealTarget} onChange={(e) => setStealTarget(e.target.value)} aria-label="Choose bankrupt contract">
                      <option value="">Choose target</option>
                      {bankrupt.map((friendship) => {
                        const isUser1 = String(friendship.user1?._id || friendship.user1) === String(userId);
                        const friend = isUser1 ? friendship.user2 : friendship.user1;
                        return <option key={friendship._id} value={friendship._id}>{friend?.displayName || 'Contract partner'}</option>;
                      })}
                    </select>
                  )}
                  <Button variant="secondary" size="sm" loading={busy === `use-${cardId}`} onClick={() => useOwnedCard(cardId)}>Use</Button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="you-section">
        <div className="you-section-heading">
          <div><p className="eyebrow">Aura market</p><h2>Spend Aura, not money.</h2></div>
        </div>
        <div className="market-grid">
          {cards.map((card) => (
            <article className="market-card" key={card.id}>
              <div className="market-card-top"><strong>{card.name}</strong><span>{card.cost} Aura</span></div>
              <p>{card.description}</p>
              <Button variant="secondary" size="sm" loading={busy === `buy-${card.id}`} disabled={aura.balance < card.cost} onClick={() => purchase(card)}>Buy</Button>
            </article>
          ))}
        </div>
      </section>

      <section className="you-section">
        <div className="you-section-heading">
          <div><p className="eyebrow">Recent Aura</p><h2>What changed</h2></div>
        </div>
        <div className="transaction-list">
          {aura.history.length === 0 ? <p className="you-empty">No Aura activity yet.</p> : aura.history.slice(0, 8).map((tx) => (
            <div className="transaction-row" key={tx._id}>
              <div><strong>{tx.description}</strong><span>{new Date(tx.createdAt).toLocaleDateString()}</span></div>
              <b className={tx.amount >= 0 ? 'positive' : 'negative'}>{tx.amount >= 0 ? '+' : ''}{tx.amount}</b>
              <ChevronRight size={14} aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
