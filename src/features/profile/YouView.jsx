import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Clock3, Eye, EyeOff, Flame, LogOut, Zap, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { returnTheFavor } from '../../services/auraService';
import { api } from '../../lib/api';
import { Button } from '../../shared/components/Button';
import { getYouSnapshot, peekYouSnapshot } from '../../services/prefetchService';
import { prepareAvatarImage } from '../../lib/avatarImage';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { PageHeading } from '../../shared/components/PageHeading';
import { AuraBank } from './AuraBank';
import { ProfileShowcase } from './ProfileShowcase';
import { GameSoundSettings } from './GameSoundSettings';
import './YouView.css';

const daysLeft = (date) => Math.max(1, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));

export const YouView = ({ friendships, showToast, onNavigate }) => {
  const { user, refreshUser, refreshBootstrap, logout } = useAuth();
  const cachedYou = peekYouSnapshot();
  const [aura, setAura] = useState(cachedYou?.aura || {
    balance: Number(user.auraBalance) || 0,
    history: [],
    totalEarned: 0,
    totalSpent: 0,
    reputation: { name: 'Spark', lifetimeEarned: 0, nextRankAt: 250, progress: 0 }
  });
  const [grudges, setGrudges] = useState(cachedYou?.grudges || []);
  const [busy, setBusy] = useState(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const avatarInputRef = useRef(null);
  const userId = user.uid || user.id || user._id;

  const refresh = async ({ silent = false, refreshAccount = true, force = true } = {}) => {
    const [snapshotResult, userResult] = await Promise.allSettled([
      getYouSnapshot({ force }),
      refreshAccount ? refreshUser() : Promise.resolve(null)
    ]);
    const refreshedUser = userResult.status === 'fulfilled' && userResult.value?.success ? userResult.value.user : null;

    if (snapshotResult.status === 'fulfilled') {
      setAura(snapshotResult.value.aura);
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

  const appearsOnShameBoard = !user.privacySettings?.optOutPublicBankruptcy;
  const strongest = useMemo(
    () => friendships.reduce((best, item) => ((item.duoLevel || 1) > (best?.duoLevel || 0) ? item : best), null),
    [friendships]
  );
  const activeSeasons = friendships.filter((item) => item.season?.status === 'ACTIVE').length;
  const totalDuoXP = friendships.reduce((sum, item) => sum + (item.duoXP || 0), 0);
  const reputation = aura.reputation || { name: 'Spark', lifetimeEarned: aura.totalEarned || 0, nextRankAt: null, progress: 0 };

  const changeAvatar = async (event) => {
    const sourceFile = event.target.files?.[0];
    event.target.value = '';
    if (!sourceFile || busy) return;

    setBusy('avatar');
    try {
      const avatarFile = await prepareAvatarImage(sourceFile);
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      await api.upload('/users/avatar', formData);
      await refreshUser();
      showToast?.('Avatar updated.', 'SUCCESS');
    } catch (error) {
      showToast?.(error.message || 'Could not update avatar', 'ERROR');
    } finally {
      setBusy(null);
    }
  };

  const removeAvatar = async () => {
    if (!user.avatar || busy) return;
    setBusy('avatar-remove');
    try {
      await api.delete('/users/avatar');
      await refreshUser();
      showToast?.('Avatar removed.', 'SUCCESS');
    } catch (error) {
      showToast?.(error.message || 'Could not remove avatar', 'ERROR');
    } finally {
      setBusy(null);
    }
  };

  const revenge = async (grudge) => {
    setBusy(`revenge-${grudge.friendshipId}`);
    try {
      const result = await returnTheFavor(grudge.friendshipId);
      showToast?.(`Favor returned · ${result.stolen} Aura taken · ${result.cost} spent`, 'SUCCESS');
      await refresh();
    } catch (error) {
      showToast?.(error.message || 'Could not return the favor', 'ERROR');
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
      <PageHeading eyebrow="You" title={<>Your corner.<br /><span>Make it yours.</span></>} description="Your Duos, your Aura, your way to play." />
      <section className="profile-section" aria-label="Your profile">
        <p className="eyebrow">Profile</p>
        <div className="profile-identity" data-profile-decoration={user.profileDecoration || 'none'}>
          <div className="profile-avatar-control">
            <button
              type="button"
              className="profile-avatar-button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={busy === 'avatar' || busy === 'avatar-remove'}
              aria-label={user.avatar ? 'Change avatar' : 'Add avatar'}
            >
              <UserAvatar person={user} size="lg" className="identity-avatar" decorative />
              <span className="profile-avatar-camera" aria-hidden="true"><Camera size={13} strokeWidth={2} /></span>
            </button>
            <input
              ref={avatarInputRef}
              className="profile-avatar-input"
              type="file"
              accept="image/*"
              onChange={changeAvatar}
              tabIndex={-1}
            />
          </div>
          <div className="identity-copy">
            <h2>{user.displayName}</h2>
            <p>{user.username ? '@' + user.username : 'Hakoware player'}</p>
            <div className="identity-photo-actions">
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={busy === 'avatar' || busy === 'avatar-remove'}>
                {busy === 'avatar' ? 'Preparing…' : user.avatar ? 'Change photo' : 'Add photo'}
              </button>
              {user.avatar && (
                <button type="button" className="remove" onClick={removeAvatar} disabled={busy === 'avatar' || busy === 'avatar-remove'}>
                  {busy === 'avatar-remove' ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        </div>

        <ProfileShowcase user={user} onChanged={async () => { await refreshBootstrap(); await refresh({ silent: true }); }} onNavigate={onNavigate} />
      </section>
      <section className="profile-aura-area" aria-label="Your Aura">
        <div className="profile-aura-row">
          <div className="aura-balance-copy">
            <p className="eyebrow">Aura</p>
            <div className="aura-balance-line"><strong>{aura.balance}</strong><span>spendable</span></div>
            <small>Earned through play · {reputation.lifetimeEarned} lifetime</small>
          </div>
          <div className="aura-rank">
            <div><strong>{reputation.name}</strong><small>{reputation.nextRankAt ? reputation.nextRankAt - reputation.lifetimeEarned + ' to next rank' : 'Top Aura rank'}</small></div>
            <span className="aura-rank-progress" aria-label={(reputation.progress || 0) + '% to next Aura rank'}><i style={{ width: (reputation.progress || 0) + '%' }} /></span>
            <Zap size={18} strokeWidth={1.6} />
          </div>
        </div>

        <div className="profile-meta" aria-label="Profile summary">
          <span><b>Strongest Duo</b> {strongest ? `Lv. ${strongest.duoLevel || 1}` : 'Start your first Duo'}</span>
          <span><b>Active</b> {activeSeasons} season{activeSeasons === 1 ? '' : 's'}</span>
          <span><b>Duo XP</b> {totalDuoXP}</span>
        </div>
      </section>

      <AuraBank userId={userId} walletBalance={aura.balance} onChanged={() => void refresh()} onExploreDuo={() => onNavigate?.('circle')} />
      <button className="you-collection-link" onClick={() => onNavigate?.('arena', { section: 'cards' })}>
        <Layers size={24} strokeWidth={1.5} /><span><strong>Your card collection</strong><small>Collect tools and trade spare cards with friends.</small></span>
      </button>

      {grudges.length > 0 && (
        <section className="you-section you-secondary-section">
          <div className="you-section-heading"><div><p className="eyebrow">Grudge</p><h2>Somebody made it personal.</h2></div></div>
          <div className="grudge-list">
            {grudges.map((grudge) => {
              const isVictim = grudge.role === 'VICTIM';
              const otherPerson = isVictim
                ? { displayName: grudge.claimantName, avatar: grudge.claimantAvatar }
                : { displayName: grudge.victimName, avatar: grudge.victimAvatar };
              const otherName = otherPerson.displayName || 'Contract partner';
              const revengeAffordable = aura.balance >= grudge.revengeCost;
              const stateLabel = isVictim
                ? grudge.revengeReady ? 'REVENGE OPEN' : 'GRUDGE'
                : 'YOU CLAIMED';

              return (
                <article className={`grudge-card ${grudge.revengeReady ? 'revenge-ready' : ''}`} key={grudge.friendshipId}>
                  <UserAvatar person={otherPerson} size="lg" className="grudge-person-avatar" decorative />

                  <div className="grudge-card-main">
                    <div className="grudge-card-top">
                      <strong>{otherName}</strong>
                      <span className={grudge.revengeReady ? 'ready' : ''}>{stateLabel}</span>
                    </div>

                    <p>
                      {isVictim
                        ? grudge.revengeReady
                          ? `${otherName} went bankrupt. Your window is open.`
                          : `${otherName} claimed ${grudge.originalClaimAmount} Aura from you.`
                        : `You claimed ${grudge.originalClaimAmount} Aura from ${otherName}.`}
                    </p>

                    <div className="grudge-card-meta">
                      <span><Clock3 size={12} /> {daysLeft(grudge.expiresAt)}d left</span>
                      {isVictim && !grudge.revengeReady && <span>Opens if they go bankrupt</span>}
                      {!isVictim && <span>Stay solvent</span>}
                    </div>
                  </div>

                  <div className="grudge-card-side">
                    <div className="grudge-card-amount">
                      <Flame size={14} strokeWidth={1.8} />
                      <strong>{grudge.originalClaimAmount}</strong>
                      <small>Aura</small>
                    </div>

                    {isVictim && grudge.revengeReady ? (
                      revengeAffordable ? (
                        <Button
                          variant="danger"
                          size="sm"
                          loading={busy === 'revenge-' + grudge.friendshipId}
                          onClick={() => revenge(grudge)}
                        >
                          Return the Favor · {grudge.revengeCost}
                        </Button>
                      ) : (
                        <span className="grudge-action-state">Need {grudge.revengeCost} Aura</span>
                      )
                    ) : (
                      <span className="grudge-action-state">
                        {isVictim ? 'Waiting on them' : 'Window active'}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="you-section you-secondary-section">
        <div className="you-section-heading"><div><p className="eyebrow">Privacy</p><h2>Public pressure</h2></div></div>
        <button className="privacy-row" type="button" onClick={toggleShameBoard} disabled={savingPrivacy} aria-pressed={appearsOnShameBoard}>
          <span className="privacy-icon">{appearsOnShameBoard ? <Eye size={18} strokeWidth={1.6} /> : <EyeOff size={18} strokeWidth={1.6} />}</span>
          <span className="privacy-copy"><strong>Appear on the Shame Board</strong><small>{appearsOnShameBoard ? 'If you become bankrupt, the Arena can show your public debt total.' : 'Your bankruptcy stays out of the public ranking.'}</small></span>
          <span className={'privacy-switch ' + (appearsOnShameBoard ? 'on' : '')} aria-hidden="true"><i /></span>
        </button>
      </section>

      <section className="you-section you-secondary-section">
        <div className="you-section-heading"><div><p className="eyebrow">Aura ledger</p><h2>Your Aura, accounted for.</h2></div></div>
        <div className="transaction-list">
          {aura.history.length === 0 ? <p className="you-empty">No Aura activity yet.</p> : aura.history.slice(0, 8).map((transaction) => (
            <div className="transaction-row" key={transaction._id}>
              <div><strong>{transaction.description}</strong><span>{new Date(transaction.createdAt).toLocaleDateString()}</span></div>
              <b className={transaction.amount >= 0 ? 'positive' : 'negative'}>{transaction.amount >= 0 ? '+' : ''}{transaction.amount}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="you-section you-secondary-section account-section">
        <div className="you-section-heading"><div><p className="eyebrow">Account</p><h2>Your settings.</h2></div></div>
        <GameSoundSettings userId={String(userId)} />
        <button className="account-logout-row" type="button" onClick={logout}>
          <span className="account-logout-icon"><LogOut size={18} strokeWidth={1.6} /></span>
          <span className="account-logout-copy"><strong>Sign out</strong><small>End this session on this device.</small></span>
          <span className="account-logout-label">Sign out</span>
        </button>
      </section>
    </div>
  );
};
