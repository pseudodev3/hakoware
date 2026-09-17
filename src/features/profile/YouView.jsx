import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, LogOut, Sparkles, Trophy, UsersRound, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAuraCards, getUserAura } from '../../services/auraService';
import { api } from '../../lib/api';
import { Button } from '../../shared/components/Button';
import './YouView.css';

const perspectiveFor = (friendship, userId, mine = true) => {
  const user1Id = friendship.user1?._id || friendship.user1;
  const isUser1 = String(user1Id) === String(userId);
  if (mine) return isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  return isUser1 ? friendship.user2Perspective : friendship.user1Perspective;
};

const debtFor = (perspective) => {
  const limit = Number(perspective?.limit) || 7;
  const days = Math.floor(Math.max(0, Date.now() - new Date(perspective?.lastInteraction || Date.now())) / 86400000);
  return (perspective?.baseDebt || 0) + Math.max(0, days - limit);
};

const partnerIsBankrupt = (friendship, userId) => {
  const perspective = perspectiveFor(friendship, userId, false);
  const limit = Number(perspective?.limit) || 7;
  return debtFor(perspective) >= limit * 2;
};

const typeLabel = (type) => String(type || '').replaceAll('_', ' ').toLowerCase();

export const YouView = ({ friendships, worldEvent, showToast }) => {
  const { user, refreshUser, buyCard, useCard, logout } = useAuth();
  const [aura, setAura] = useState({ balance: Number(user.auraBalance) || 0, history: [], totalEarned: 0, totalSpent: 0 });
  const [cards, setCards] = useState([]);
  const [busy, setBusy] = useState(null);
  const [stealTarget, setStealTarget] = useState('');
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const userId = user.uid || user.id || user._id;

  const refresh = async ({ silent = false } = {}) => {
    const [auraResult, cardsResult, userResult] = await Promise.allSettled([getUserAura(), getAuraCards(), refreshUser()]);
    const refreshedUser = userResult.status === 'fulfilled' && userResult.value?.success ? userResult.value.user : null;

    if (auraResult.status === 'fulfilled') setAura(auraResult.value);
    else {
      const fallbackBalance = Number(refreshedUser?.auraBalance ?? user.auraBalance) || 0;
      setAura((current) => ({ ...current, balance: fallbackBalance }));
      if (!silent) showToast?.(auraResult.reason?.message || 'Could not refresh Aura activity', 'ERROR');
    }
    if (cardsResult.status === 'fulfilled') setCards(cardsResult.value || []);
  };

  useEffect(() => { refresh({ silent: true }); }, []);
  useEffect(() => { setAura((current) => ({ ...current, balance: Number(user.auraBalance) || 0 })); }, [user.auraBalance]);

  const bankrupt = useMemo(() => friendships.filter((friendship) => partnerIsBankrupt(friendship, userId)), [friendships, userId]);
  const hasDebt = useMemo(() => friendships.some((friendship) => debtFor(perspectiveFor(friendship, userId, true)) > 0), [friendships, userId]);
  const inventory = user.inventory || [];
  const appearsOnShameBoard = !user.privacySettings?.optOutPublicBankruptcy;
  const strongest = useMemo(
    () => friendships.reduce((best, item) => ((item.duoLevel || 1) > (best?.duoLevel || 0) ? item : best), null),
    [friendships]
  );
  const activeSeasons = friendships.filter((item) => item.season?.status === 'ACTIVE').length;
  const totalDuoXP = friendships.reduce((sum, item) => sum + (item.duoXP || 0), 0);

  const purchase = async (card) => {
    setBusy(`buy-${card.id}`);
    const result = await buyCard(card);
    showToast?.(result.success ? `${card.name} added to your inventory` : result.error, result.success ? 'SUCCESS' : 'ERROR');
    await refresh();
    setBusy(null);
  };

  const useOwnedCard = async (cardId) => {
    if (cardId === 'PURIFY' && !hasDebt) return showToast?.('You do not have any debt to clear', 'ERROR');
    if (cardId === 'STEAL' && !stealTarget) return showToast?.('Choose a bankrupt contract first', 'ERROR');
    setBusy(`use-${cardId}`);
    const result = await useCard(cardId, cardId === 'STEAL' ? stealTarget : null);
    showToast?.(result.success ? 'Card used' : result.error, result.success ? 'SUCCESS' : 'ERROR');
    await refresh();
    setBusy(null);
  };

  const toggleShameBoard = async () => {
    setSavingPrivacy(true);
    try {
      await api.patch('/users/preferences', { optOutPublicBankruptcy: appearsOnShameBoard });
      await refreshUser();
      showToast?.(appearsOnShameBoard ? 'Hidden from the public Shame Board' : 'Public Shame Board enabled', 'SUCCESS');
    } catch (error) {
      showToast?.(error.message || 'Could not update privacy', 'ERROR');
    } finally {
      setSavingPrivacy(false);
    }
  };

  return (
    <div className="you-view">
      <section className="identity-card">
        <div className="identity-avatar">{user.displayName?.[0]?.toUpperCase()}</div>
        <div className="identity-copy"><p className="eyebrow">Player profile</p><h1>{user.displayName}</h1><p>{user.email}</p></div>
        <div className="nen-chip"><Sparkles size={14} strokeWidth={1.8} /> {user.nenType ? typeLabel(user.nenType) : 'No affinity'}</div>
      </section>

      <section className="player-summary-grid">
        <div className="player-summary-primary"><UsersRound size={18} /><small>Strongest Duo</small><strong>Lv. {strongest?.duoLevel || 1}</strong><span>{strongest?.duoTitle || 'No contract yet'}</span></div>
        <div><Trophy size={18} /><small>Active seasons</small><strong>{activeSeasons}</strong><span>{friendships.length} total contracts</span></div>
        <div><Sparkles size={18} /><small>Total Duo XP</small><strong>{totalDuoXP}</strong><span>across your circle</span></div>
      </section>

      {worldEvent && <section className="profile-world-event"><span>LIVE · {worldEvent.theme}</span><strong>{worldEvent.name}</strong><p>{worldEvent.description}</p></section>}

      <section className="aura-balance-card">
        <div><p className="eyebrow">Aura wallet</p><div className="aura-number">{aura.balance}</div><p>Earned {aura.totalEarned} · Spent {aura.totalSpent}</p></div>
        <Zap size={28} strokeWidth={1.6} />
      </section>

      {inventory.length > 0 && (
        <section className="you-section">
          <div className="you-section-heading"><div><p className="eyebrow">Inventory</p><h2>Cards in your pocket</h2></div></div>
          <div className="inventory-list">
            {[...new Set(inventory)].map((cardId) => {
              const card = cards.find((item) => item.id === cardId) || { id: cardId, name: typeLabel(cardId), description: '' };
              const count = inventory.filter((item) => item === cardId).length;
              const disabled = cardId === 'PURIFY' ? !hasDebt : cardId === 'STEAL' ? bankrupt.length === 0 || !stealTarget : false;
              return (
                <article className="inventory-card" key={cardId}>
                  <div className="inventory-copy"><strong>{card.name}</strong><span>{count} owned</span></div>
                  {cardId === 'STEAL' && (
                    <select value={stealTarget} onChange={(event) => setStealTarget(event.target.value)} aria-label="Choose bankrupt contract">
                      <option value="">{bankrupt.length ? 'Choose target' : 'No bankrupt partners'}</option>
                      {bankrupt.map((friendship) => {
                        const isUser1 = String(friendship.user1?._id || friendship.user1) === String(userId);
                        const friend = isUser1 ? friendship.user2 : friendship.user1;
                        return <option key={friendship._id} value={friendship._id}>{friend?.displayName || 'Contract partner'}</option>;
                      })}
                    </select>
                  )}
                  {cardId === 'PURIFY' && !hasDebt && <span className="inventory-hint">No debt to clear</span>}
                  <Button variant="secondary" size="sm" loading={busy === `use-${cardId}`} disabled={disabled} onClick={() => useOwnedCard(cardId)}>Use</Button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="you-section">
        <div className="you-section-heading"><div><p className="eyebrow">Aura market</p><h2>Turn participation into leverage.</h2></div></div>
        <div className="market-grid">
          {cards.map((card) => (
            <article className="market-card" key={card.id}>
              <div className="market-card-top"><strong>{card.name}</strong><span>{card.cost} Aura</span></div>
              <p>{card.description}</p>
              <Button variant="secondary" size="sm" loading={busy === `buy-${card.id}`} disabled={aura.balance < card.cost} onClick={() => purchase(card)}>{aura.balance < card.cost ? 'Not enough Aura' : 'Buy card'}</Button>
            </article>
          ))}
        </div>
      </section>

      <section className="you-section">
        <div className="you-section-heading"><div><p className="eyebrow">Privacy</p><h2>Public pressure</h2></div></div>
        <button className="privacy-row" type="button" onClick={toggleShameBoard} disabled={savingPrivacy} aria-pressed={appearsOnShameBoard}>
          <span className="privacy-icon">{appearsOnShameBoard ? <Eye size={18} /> : <EyeOff size={18} />}</span>
          <span className="privacy-copy"><strong>Appear on the Shame Board</strong><small>{appearsOnShameBoard ? 'If you become bankrupt, the Arena can show your public debt total.' : 'Your bankruptcy stays out of the public ranking.'}</small></span>
          <span className={`privacy-switch ${appearsOnShameBoard ? 'on' : ''}`} aria-hidden="true"><i /></span>
        </button>
      </section>

      <section className="you-section">
        <div className="you-section-heading"><div><p className="eyebrow">Aura ledger</p><h2>Recent movement</h2></div></div>
        <div className="transaction-list">
          {aura.history.length === 0 ? <p className="you-empty">No Aura activity yet.</p> : aura.history.slice(0, 8).map((transaction) => (
            <div className="transaction-row" key={transaction._id}>
              <div><strong>{transaction.description}</strong><span>{new Date(transaction.createdAt).toLocaleDateString()}</span></div>
              <b className={transaction.amount >= 0 ? 'positive' : 'negative'}>{transaction.amount >= 0 ? '+' : ''}{transaction.amount}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="you-section account-section">
        <div className="you-section-heading"><div><p className="eyebrow">Account</p><h2>Session</h2></div></div>
        <button className="account-logout-row" type="button" onClick={logout}>
          <span className="account-logout-icon"><LogOut size={18} strokeWidth={1.8} /></span>
          <span className="account-logout-copy"><strong>Sign out of Hakoware</strong><small>Return to the landing page and end this session on this device.</small></span>
          <span className="account-logout-label">Sign out</span>
        </button>
      </section>
    </div>
  );
};
