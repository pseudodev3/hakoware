import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Crown, Eye, EyeOff, History, LogOut, Palette, Share2, SlidersHorizontal, Sparkles, Trophy, UsersRound, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { returnTheFavor } from '../../services/auraService';
import { api } from '../../lib/api';
import { Button } from '../../shared/components/Button';
import { getYouSnapshot, peekYouSnapshot } from '../../services/prefetchService';
import { setPlusInterest } from '../../services/growthService';
import { shareHakoware } from '../../lib/share';
import { buildDuoShareCard } from '../../lib/duoShareCard';
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
const daysLeft = (date) => Math.max(1, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));

const PLUS_FEATURES = [
  { icon: History, title: 'Full season archive', copy: 'Keep the complete story across every season.' },
  { icon: BarChart3, title: 'Deeper Duo stats', copy: 'Patterns, streaks and relationship-level trends.' },
  { icon: SlidersHorizontal, title: 'Advanced custom contracts', copy: 'More control over the rules you make together.' },
  { icon: Palette, title: 'Premium recap styles', copy: 'More ways to turn a season into something worth sharing.' },
  { icon: Crown, title: 'Duo cosmetics', copy: 'Themes, profile treatments and visual identity for your Duo.' }
];

export const YouView = ({ friendships, worldEvent, showToast }) => {
  const { user, refreshUser, buyCard, useCard, logout } = useAuth();
  const cachedYou = peekYouSnapshot();
  const [aura, setAura] = useState(cachedYou?.aura || {
    balance: Number(user.auraBalance) || 0,
    history: [],
    totalEarned: 0,
    totalSpent: 0,
    reputation: { name: 'Spark', lifetimeEarned: 0, nextRankAt: 250, progress: 0 }
  });
  const [cards, setCards] = useState(cachedYou?.cards || []);
  const [grudges, setGrudges] = useState(cachedYou?.grudges || []);
  const [busy, setBusy] = useState(null);
  const [stealTarget, setStealTarget] = useState('');
  const [signalTarget, setSignalTarget] = useState('');
  const [chaosTarget, setChaosTarget] = useState('');
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [plusInterested, setPlusInterestedState] = useState(Boolean(user.plusInterestAt));
  const userId = user.uid || user.id || user._id;

  const refresh = async ({ silent = false, refreshAccount = true, force = true } = {}) => {
    const [snapshotResult, userResult] = await Promise.allSettled([
      getYouSnapshot({ force }),
      refreshAccount ? refreshUser() : Promise.resolve(null)
    ]);
    const refreshedUser = userResult.status === 'fulfilled' && userResult.value?.success ? userResult.value.user : null;

    if (snapshotResult.status === 'fulfilled') {
      setAura(snapshotResult.value.aura);
      setCards(snapshotResult.value.cards || []);
      setGrudges(snapshotResult.value.grudges || []);
    } else {
      const fallbackBalance = Number(refreshedUser?.auraBalance ?? user.auraBalance) || 0;
      setAura((current) => ({ ...current, balance: fallbackBalance }));
      if (!silent) showToast?.(snapshotResult.reason?.message || 'Could not refresh profile data', 'ERROR');
    }
  };

  useEffect(() => {
    const warm = Boolean(peekYouSnapshot());
    void refresh({ silent: warm, refreshAccount: false, force: warm });
  }, []);
  useEffect(() => { setAura((current) => ({ ...current, balance: Number(user.auraBalance) || 0 })); }, [user.auraBalance]);
  useEffect(() => { setPlusInterestedState(Boolean(user.plusInterestAt)); }, [user.plusInterestAt]);

  const bankrupt = useMemo(() => friendships.filter((friendship) => partnerIsBankrupt(friendship, userId)), [friendships, userId]);
  const hasDebt = useMemo(() => friendships.some((friendship) => debtFor(perspectiveFor(friendship, userId, true)) > 0), [friendships, userId]);
  const chaosContracts = useMemo(() => friendships.filter((friendship) => friendship.templateId === 'CHAOS' && friendship.status === 'ACTIVE' && !friendship.chaos?.activeEvent), [friendships]);
  const inventory = user.inventory || [];
  const appearsOnShameBoard = !user.privacySettings?.optOutPublicBankruptcy;
  const strongest = useMemo(
    () => friendships.reduce((best, item) => ((item.duoLevel || 1) > (best?.duoLevel || 0) ? item : best), null),
    [friendships]
  );
  const activeSeasons = friendships.filter((item) => item.season?.status === 'ACTIVE').length;
  const totalDuoXP = friendships.reduce((sum, item) => sum + (item.duoXP || 0), 0);
  const reputation = aura.reputation || { name: 'Spark', lifetimeEarned: aura.totalEarned || 0, nextRankAt: null, progress: 0 };

  const partnerFor = (friendship) => {
    const isUser1 = String(friendship.user1?._id || friendship.user1) === String(userId);
    return isUser1 ? friendship.user2 : friendship.user1;
  };

  const partnerName = (friendship) => partnerFor(friendship)?.displayName || 'Contract partner';
  const selectedStealFriendship = bankrupt.find((friendship) => String(friendship._id) === String(stealTarget));
  const selectedStealPartner = selectedStealFriendship ? partnerFor(selectedStealFriendship) : null;
  const projectedSteal = Math.floor((Number(selectedStealPartner?.auraBalance) || 0) * 0.1);
  const claimNet = projectedSteal - 180;

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
    if (cardId === 'SIGNAL_FLARE' && !signalTarget) return showToast?.('Choose a contract for the Signal Flare', 'ERROR');
    if (cardId === 'CHAOS_TICKET' && !chaosTarget) return showToast?.('Choose a Chaos Contract first', 'ERROR');

    const targetId = cardId === 'STEAL'
      ? stealTarget
      : cardId === 'SIGNAL_FLARE'
        ? signalTarget
        : cardId === 'CHAOS_TICKET'
          ? chaosTarget
          : null;

    setBusy(`use-${cardId}`);
    const result = await useCard(cardId, targetId);
    let successMessage = 'Card used';
    if (cardId === 'STEAL' && result.success) successMessage = `Claimed ${result.effect?.stolen || 0} Aura · Grudge activated 🤣`;
    if (cardId === 'SIGNAL_FLARE' && result.success) successMessage = 'Signal Flare sent · 48h cooldown started';
    showToast?.(result.success ? successMessage : result.error, result.success ? 'SUCCESS' : 'ERROR');
    if (result.success) {
      if (cardId === 'STEAL') setStealTarget('');
      if (cardId === 'SIGNAL_FLARE') setSignalTarget('');
      if (cardId === 'CHAOS_TICKET') setChaosTarget('');
    }
    await refresh();
    setBusy(null);
  };

  const revenge = async (grudge) => {
    setBusy(`revenge-${grudge.friendshipId}`);
    try {
      const result = await returnTheFavor(grudge.friendshipId);
      showToast?.(`Returned the favor · spent ${result.cost} to take ${result.stolen} Aura 🤣`, 'SUCCESS');
      await refresh();
    } catch (error) {
      showToast?.(error.message || 'Could not return the favor', 'ERROR');
    } finally {
      setBusy(null);
    }
  };

  const shareStrongestDuo = async () => {
    if (!strongest) return showToast?.('Start a contract first. Then you have something to brag about', 'ERROR');

    setBusy('share-duo');
    try {
      const partnerUser = partnerFor(strongest);
      const partner = partnerUser?.username ? `@${partnerUser.username}` : partnerName(strongest);
      const userIdentity = user.username ? `@${user.username}` : user.displayName;
      const blob = await buildDuoShareCard({
        userName: userIdentity,
        partnerName: partner,
        duoLevel: strongest.duoLevel || 1,
        duoTitle: strongest.duoTitle || 'New Contract',
        duoXP: strongest.duoXP || 0,
        templateName: typeLabel(strongest.templateId || 'Contract'),
        seasonNumber: strongest.season?.number || 1
      });
      const file = new File([blob], 'hakoware-duo-card.png', { type: 'image/png' });
      const result = await shareHakoware({
        source: 'DUO',
        title: 'Hakoware Duo',
        text: `${userIdentity} × ${partner} · Duo Lv. ${strongest.duoLevel || 1} · ${strongest.duoTitle || 'New Contract'}`,
        url: '',
        files: [file]
      });

      if (result.cancelled) return;
      if (result.success && result.method === 'CLIPBOARD') {
        showToast?.('Duo card text copied - image sharing is not supported here', 'SUCCESS');
      } else if (!result.success) {
        showToast?.(result.error || 'Could not share your Duo', 'ERROR');
      }
    } catch (error) {
      showToast?.(error.message || 'Could not build your Duo card', 'ERROR');
    } finally {
      setBusy(null);
    }
  };

  const joinPlusInterest = async () => {
    if (plusInterested) return;
    setBusy('plus-interest');
    try {
      await setPlusInterest(true);
      setPlusInterestedState(true);
      await refreshUser();
      showToast?.('Hakoware+ interest saved · you are early', 'SUCCESS');
    } catch (error) {
      showToast?.(error.message || 'Could not save Hakoware+ interest', 'ERROR');
    } finally {
      setBusy(null);
    }
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
        <div className="identity-copy"><p className="eyebrow">Player profile</p><h1>{user.displayName}</h1><p>{user.username ? `@${user.username}` : 'Hakoware player'}</p></div>
        <div className="nen-chip"><Sparkles size={14} strokeWidth={1.8} /> {user.nenType ? typeLabel(user.nenType) : 'No affinity'}</div>
      </section>

      <section className="player-summary-grid">
        <div className="player-summary-primary"><UsersRound size={18} /><small>Strongest Duo</small><strong>Lv. {strongest?.duoLevel || 1}</strong><span>{strongest?.duoTitle || 'No contract yet'}</span></div>
        <div><Trophy size={18} /><small>Active seasons</small><strong>{activeSeasons}</strong><span>{friendships.length} total contracts</span></div>
        <div><Sparkles size={18} /><small>Total Duo XP</small><strong>{totalDuoXP}</strong><span>across your circle</span></div>
      </section>

      {worldEvent && <section className="profile-world-event"><span>LIVE · {worldEvent.theme}</span><strong>{worldEvent.name}</strong><p>{worldEvent.description}</p></section>}

      {strongest && (
        <section className="duo-share-strip">
          <div className="duo-share-copy">
            <Share2 size={17} strokeWidth={1.8} />
            <div>
              <span>SHARE A MOMENT</span>
              <strong>{partnerName(strongest)} · Duo Lv. {strongest.duoLevel || 1}</strong>
              <small>{strongest.duoTitle || 'New Contract'} · {strongest.duoXP || 0} XP</small>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={Share2} loading={busy === 'share-duo'} onClick={shareStrongestDuo}>Share Duo</Button>
        </section>
      )}

      <section className="plus-preview">
        <div className="plus-preview-head">
          <div className="plus-preview-mark"><Crown size={18} strokeWidth={1.8} /></div>
          <div>
            <span>EARLY PREVIEW · NO CHARGE</span>
            <h2>Hakoware+</h2>
            <p>The game stays free. Plus is for people who want more history, customization and identity around the relationships they already built here.</p>
          </div>
        </div>

        <div className="plus-feature-grid">
          {PLUS_FEATURES.map(({ icon: Icon, title, copy }) => (
            <div className="plus-feature" key={title}>
              <Icon size={16} strokeWidth={1.7} />
              <div><strong>{title}</strong><span>{copy}</span></div>
            </div>
          ))}
        </div>

        <div className="plus-preview-foot">
          <span>{plusInterested ? 'Interest saved. No payment, no commitment.' : 'Help decide whether we build this.'}</span>
          <Button
            variant={plusInterested ? 'secondary' : 'aura'}
            size="sm"
            loading={busy === 'plus-interest'}
            disabled={plusInterested}
            onClick={joinPlusInterest}
          >
            {plusInterested ? 'You are on the early list' : "I'm interested"}
          </Button>
        </div>
      </section>

      <section className="aura-balance-card">
        <div className="aura-wallet-copy">
          <p className="eyebrow">Aura wallet</p>
          <div className="aura-number">{aura.balance}</div>
          <p>Spendable Aura · earned through play</p>
          <div className="aura-reputation-row">
            <span><strong>{reputation.name}</strong><small>{reputation.lifetimeEarned} lifetime Aura</small></span>
            <span className="aura-rank-progress" aria-label={`${reputation.progress || 0}% to next Aura rank`}><i style={{ width: `${reputation.progress || 0}%` }} /></span>
            <small>{reputation.nextRankAt ? `${reputation.nextRankAt - reputation.lifetimeEarned} to next rank` : 'Top Aura rank'}</small>
          </div>
        </div>
        <Zap size={28} strokeWidth={1.6} />
      </section>

      {grudges.length > 0 && (
        <section className="you-section">
          <div className="you-section-heading"><div><p className="eyebrow">Grudge</p><h2>Somebody made it personal.</h2></div></div>
          <div className="market-grid">
            {grudges.map((grudge) => (
              <article className="market-card" key={grudge.friendshipId}>
                <div className="market-card-top">
                  <strong>{grudge.victimName} vs {grudge.claimantName}</strong>
                  <span>{daysLeft(grudge.expiresAt)}d left</span>
                </div>
                <p>
                  {grudge.role === 'VICTIM'
                    ? grudge.revengeReady
                      ? `${grudge.claimantName} finally went bankrupt. Return the Favor for ${grudge.revengeCost} Aura and take 10% of theirs.`
                      : `${grudge.claimantName} Claimed you. If they go bankrupt before this expires, your revenge window opens.`
                    : `${grudge.victimName} has a public Grudge against you. Stay solvent until the timer dies.`}
                </p>
                {grudge.role === 'VICTIM' && (
                  <Button
                    variant={grudge.revengeReady ? 'danger' : 'secondary'}
                    size="sm"
                    loading={busy === `revenge-${grudge.friendshipId}`}
                    disabled={!grudge.revengeReady || aura.balance < grudge.revengeCost}
                    onClick={() => revenge(grudge)}
                  >
                    {grudge.revengeReady
                      ? aura.balance < grudge.revengeCost
                        ? `Need ${grudge.revengeCost} Aura`
                        : `Return the Favor · ${grudge.revengeCost}`
                      : 'Waiting for them to slip'}
                  </Button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {inventory.length > 0 && (
        <section className="you-section">
          <div className="you-section-heading"><div><p className="eyebrow">Inventory</p><h2>Cards in your pocket</h2></div></div>
          <div className="inventory-list">
            {[...new Set(inventory)].map((cardId) => {
              const card = cards.find((item) => item.id === cardId) || { id: cardId, name: typeLabel(cardId), description: '' };
              const count = inventory.filter((item) => item === cardId).length;
              const disabled = cardId === 'PURIFY'
                ? !hasDebt
                : cardId === 'STEAL'
                  ? bankrupt.length === 0 || !stealTarget
                  : cardId === 'SIGNAL_FLARE'
                    ? friendships.length === 0 || !signalTarget
                    : cardId === 'CHAOS_TICKET'
                      ? chaosContracts.length === 0 || !chaosTarget
                      : false;
              return (
                <article className="inventory-card" key={cardId}>
                  <div className="inventory-copy"><strong>{card.name}</strong><span>{count} owned</span></div>
                  {cardId === 'STEAL' && (
                    <select value={stealTarget} onChange={(event) => setStealTarget(event.target.value)} aria-label="Choose bankrupt contract">
                      <option value="">{bankrupt.length ? 'Choose target' : 'No bankrupt partners'}</option>
                      {bankrupt.map((friendship) => <option key={friendship._id} value={friendship._id}>{partnerName(friendship)}</option>)}
                    </select>
                  )}
                  {cardId === 'STEAL' && stealTarget && (
                    <span className="inventory-hint">Steal {projectedSteal} Aura · original card cost 180 · math {claimNet >= 0 ? '+' : ''}{claimNet} 🤣</span>
                  )}
                  {cardId === 'SIGNAL_FLARE' && (
                    <select value={signalTarget} onChange={(event) => setSignalTarget(event.target.value)} aria-label="Choose contract for Signal Flare">
                      <option value="">{friendships.length ? 'Choose contract' : 'No active contracts'}</option>
                      {friendships.map((friendship) => <option key={friendship._id} value={friendship._id}>{partnerName(friendship)}</option>)}
                    </select>
                  )}
                  {cardId === 'CHAOS_TICKET' && (
                    <select value={chaosTarget} onChange={(event) => setChaosTarget(event.target.value)} aria-label="Choose Chaos Contract">
                      <option value="">{chaosContracts.length ? 'Choose Chaos Contract' : 'No ready Chaos Contract'}</option>
                      {chaosContracts.map((friendship) => <option key={friendship._id} value={friendship._id}>{partnerName(friendship)}</option>)}
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
