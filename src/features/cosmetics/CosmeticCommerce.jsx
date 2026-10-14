import { useEffect, useRef, useState } from 'react';
import { Check, Gift, LockKeyhole, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { COSMETIC_PACKS, collectionFor } from '../../lib/cosmetics';
import { checkoutRetryKey, clearCheckoutRetryKey, formatCosmeticPrice, goToHostedCheckout } from '../../lib/cosmeticCheckout';
import { acknowledgeCosmeticReceipt, cancelCosmeticCheckout, getCosmeticPurchases, getGiftOptions, resumeCosmeticCheckout, startCosmeticCheckout, verifyCosmeticPurchase } from '../../services/cosmeticService';
import { saveProfilePresentation } from '../../services/presentationService';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { Button } from '../../shared/components/Button';
import { CardArtwork } from '../cards/CardArtwork';
import './CosmeticCommerce.css';

const providerName = provider => provider === 'nowpayments' ? 'NOWPayments' : 'Stripe';
const paymentCopy = order => {
  if (order.needsSupport) return 'The payment link could not be confirmed. Contact support with your purchase reference before starting another purchase.';
  if (order.status === 'EXPIRED') return 'This checkout expired. You can start a new purchase from the collection.';
  if (order.status === 'FAILED') return 'This purchase did not open. Check your purchases for another unfinished checkout.';
  if (order.provider === 'nowpayments') {
    if (order.paymentStatus === 'partially_paid') return 'A partial payment was received. Open the same checkout to review the remaining amount. Your edition unlocks after full payment is confirmed.';
    if (['confirming', 'confirmed', 'sending'].includes(order.paymentStatus)) return 'Your payment is being confirmed. Your edition will appear here when it is complete.';
    if (order.paymentStatus === 'refunded') return 'NOWPayments reports that this payment was refunded. Your edition has not been delivered. Review the payment in checkout or contact support.';
    if (['failed', 'expired'].includes(order.paymentStatus)) return 'That payment attempt did not complete. Resume this checkout to review the current payment options.';
    if (order.status === 'PREPARING' && order.canResume === false) return 'Your payment link is being confirmed. Check your saved purchase again in a moment.';
  }
  return 'Your edition arrives after payment is confirmed. You can check again or continue the same checkout.';
};

export const CosmeticCheckout = ({ pack, available, checkoutProvider = 'stripe', onBusyChange, onChanged, onOpenPurchases }) => {
  const { user } = useAuth(), userId = String(user.uid || user._id);
  const [delivery, setDelivery] = useState(pack.owned ? 'gift' : 'self'), [friends, setFriends] = useState(null), [recipient, setRecipient] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false), running = useRef(false);
  useEffect(() => {
    alive.current = true;
    getGiftOptions(pack.id).then(result => { if (alive.current) setFriends(result.friends); }).catch(failure => { if (alive.current) setError(failure.message); });
    return () => { alive.current = false; onBusyChange(false); };
  }, [pack.id, userId, onBusyChange]);
  const selectedFriend = friends?.find(friend => friend.friendshipId === recipient);
  const checkout = async () => {
    if (running.current || !available || delivery === 'gift' && !selectedFriend) return;
    const friendshipId = delivery === 'gift' ? recipient : null;
    running.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      const result = await startCosmeticCheckout({ packId: pack.id, clientId: checkoutRetryKey(userId, pack.id, friendshipId), ...(friendshipId ? { friendshipId } : {}) });
      if (!alive.current) return;
      if (result.checkoutUrl) goToHostedCheckout(result.checkoutUrl, result.order?.provider || checkoutProvider);
      else { clearCheckoutRetryKey(userId, pack.id, friendshipId); await onChanged?.(); }
    } catch (failure) { if (alive.current) { if (failure.payload?.code === 'COSMETIC_CHECKOUT_CLOSED') clearCheckoutRetryKey(userId, pack.id, friendshipId); setError(failure.message || 'Could not confirm checkout. Your saved purchase can be resumed.'); } }
    finally { running.current = false; if (alive.current) { setBusy(false); onBusyChange(false); } }
  };
  return <section className="cosmetic-checkout" aria-label="Choose who receives this edition">
    <div className="checkout-delivery" role="group" aria-label="Edition recipient"><button type="button" aria-pressed={delivery === 'self'} disabled={busy || pack.owned} onClick={() => { setDelivery('self'); setError(''); }}>For me{pack.owned && <Check size={13} />}</button><button type="button" aria-pressed={delivery === 'gift'} disabled={busy} onClick={() => { setDelivery('gift'); setError(''); }}><Gift size={16} />For a friend</button></div>
    {delivery === 'gift' && <div className="checkout-gift"><h3>A little personality. From you.</h3><p>Send the collection to an accepted friend. They choose when to wear it.</p>
      {friends === null ? <p role="status">Opening your friends…</p> : friends.length ? <label>Choose your friend<select value={recipient} disabled={busy} onChange={event => { setRecipient(event.target.value); setError(''); }}><option value="">Select an accepted friend</option>{friends.map(friend => <option key={friend.friendshipId} value={friend.friendshipId} disabled={friend.alreadyOwned}>{friend.person.displayName}{friend.person.username ? ` · @${friend.person.username}` : ''}{friend.alreadyOwned ? ' · Already owns this edition' : ''}</option>)}</select></label> : <p>Accept a Duo to send your first gift.</p>}
      {selectedFriend && <div className="checkout-recipient"><UserAvatar person={selectedFriend.person} size="sm" decorative /><span><strong>For {selectedFriend.person.displayName}</strong><small>{pack.name} · Permanent collection</small></span></div>}
    </div>}
    {delivery === 'self' && pack.unlockedStyles > 0 && !pack.owned && <p className="checkout-existing">You already have {pack.unlockedStyles} of these {pack.grants.length} styles. This purchase adds the remaining styles at the displayed bundle price.</p>}
    <div className="checkout-price"><strong>{formatCosmeticPrice(pack.price)}</strong><span>One-time collection</span></div>
    {available ? <Button variant="aura" loading={busy} disabled={delivery === 'gift' && (!selectedFriend || selectedFriend.alreadyOwned) || delivery === 'self' && pack.owned} onClick={() => void checkout()}>{delivery === 'gift' ? 'Continue with gift' : 'Continue to checkout'}</Button> : <p className="checkout-preview-note">Gifting and purchases open when checkout launches.</p>}
    {available && <p className="checkout-security"><LockKeyhole size={12} />Pay securely on {providerName(checkoutProvider)}.{checkoutProvider === 'nowpayments' ? ' Choose a supported coin and network in checkout.' : ''} Your edition arrives after payment is confirmed.</p>}
    {error && <p className="shop-error" role="alert">{error}</p>}
    {error && onOpenPurchases && <button type="button" className="checkout-recovery" disabled={busy} onClick={onOpenPurchases}>View saved purchases</button>}
  </section>;
};

export const CosmeticPurchases = ({ newEditions = [], returnOrderId, onBusyChange, onChanged, onClearReturn }) => {
  const { user, refreshUser } = useAuth(), userId = String(user.uid || user._id);
  const [orders, setOrders] = useState(null), [active, setActive] = useState(null), [editionId, setEditionId] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false), running = useRef(false), generation = useRef(0), revealHeading = useRef(null);
  const activeOrderId = active?.id, activeStatus = active?.status;
  const clearClosedIntent = order => { if (['FAILED', 'EXPIRED', 'DELIVERED'].includes(order.status) && order.checkoutFriendshipId !== undefined) clearCheckoutRetryKey(userId, order.packId, order.checkoutFriendshipId); };
  useEffect(() => {
    if (!activeOrderId || !activeStatus) return;
    const frame = requestAnimationFrame(() => { revealHeading.current?.focus({ preventScroll: true }); revealHeading.current?.closest('.purchase-reveal')?.scrollIntoView({ block: 'start' }); });
    return () => cancelAnimationFrame(frame);
  }, [activeOrderId, activeStatus]);
  const load = async () => {
    const version = ++generation.current;
    try {
      const data = await getCosmeticPurchases();
      if (!alive.current || version !== generation.current) return;
      data.orders.forEach(clearClosedIntent);
      setOrders(data.orders); setError('');
      const fresh = data.orders.find(order => order.id === returnOrderId) || data.orders.find(order => newEditions.some(receipt => receipt.orderId === order.id));
      if (fresh) { setActive(fresh); setEditionId(collectionFor(COSMETIC_PACKS.find(pack => pack.id === fresh.packId))[0].id); }
    } catch (failure) { if (alive.current && version === generation.current) setError(failure.message); }
  };
  const pollingCallbacks = useRef({});
  pollingCallbacks.current = { load, refreshUser, onChanged };
  const activeProvider = active?.provider, needsSupport = active?.needsSupport;
  useEffect(() => {
    if (!activeOrderId || activeProvider !== 'nowpayments' || needsSupport || !['PREPARING', 'OPEN'].includes(activeStatus)) return undefined;
    let cancelled = false, pending = false;
    const poll = async () => {
      if (pending || running.current || document.visibilityState === 'hidden') return;
      pending = true; const version = generation.current;
      try {
        const result = await verifyCosmeticPurchase(activeOrderId);
        if (cancelled || !alive.current || running.current || version !== generation.current) return;
        if (['PAID', 'DELIVERED'].includes(result.order.status)) {
          await pollingCallbacks.current.refreshUser();
          if (cancelled || !alive.current) return;
          await pollingCallbacks.current.onChanged?.();
          if (!cancelled && alive.current) await pollingCallbacks.current.load();
        }
        if (!cancelled && alive.current) setActive(current => current?.id !== activeOrderId || ['PAID', 'DELIVERED'].includes(current.status) ? current : result.order);
      } catch { /* Manual Check payment reports errors; background confirmation stays quiet. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(poll, 15000);
    document.addEventListener('visibilitychange', poll);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [activeOrderId, activeStatus, activeProvider, needsSupport, userId]);
  useEffect(() => {
    alive.current = true; setOrders(null); setActive(null);
    void (async () => {
      if (returnOrderId) {
        try {
          const result = await verifyCosmeticPurchase(returnOrderId);
          if (!alive.current) return;
          setActive(result.order);
          if (['PAID', 'DELIVERED'].includes(result.order.status)) { await refreshUser(); if (!alive.current) return; await onChanged?.(); }
        } catch (failure) { if (alive.current) setError(failure.message); }
      }
      if (alive.current) await load();
    })();
    return () => { alive.current = false; generation.current += 1; onBusyChange(false); };
    // A changed account or checkout return starts a new receipt lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, returnOrderId]);
  const operate = async (operation, after) => {
    if (running.current) return;
    running.current = true; setBusy(true); onBusyChange(true); setError('');
    try { const result = await operation(); if (!alive.current) return; await after?.(result); }
    catch (failure) { if (alive.current) setError(failure.message || 'Could not confirm your purchase.'); }
    finally { running.current = false; if (alive.current) { setBusy(false); onBusyChange(false); } }
  };
  const check = order => operate(() => verifyCosmeticPurchase(order.id), async result => { clearClosedIntent(result.order); setActive(result.order); await refreshUser(); await onChanged?.(); await load(); });
  const resume = order => operate(() => resumeCosmeticCheckout(order.id), async result => { if (result.checkoutUrl) goToHostedCheckout(result.checkoutUrl, result.order?.provider || order.provider); else { setActive(result.order); await refreshUser(); await onChanged?.(); await load(); } });
  const closeCheckout = order => operate(() => cancelCosmeticCheckout(order.id), async result => { clearClosedIntent(result.order); setActive(result.order); await onChanged?.(); await load(); });
  const dismiss = () => operate(async () => { if (active?.forMe && ['PAID', 'DELIVERED'].includes(active.status)) await acknowledgeCosmeticReceipt(active.id); }, async () => { setActive(null); onClearReturn?.(); });
  const pack = COSMETIC_PACKS.find(pack => pack.id === active?.packId), editions = collectionFor(pack), edition = editions.find(edition => edition.id === editionId) || editions[0];
  const wear = () => operate(async () => {
    await saveProfilePresentation({ avatarFrame: edition.frameId, cardFinish: edition.finishId, profileDecoration: edition.decorationId });
    const result = await refreshUser(); if (!result.success) throw new Error('Your style is saved. Refresh your profile to see it.');
    await acknowledgeCosmeticReceipt(active.id);
  }, async () => { setActive(null); onClearReturn?.(); await onChanged?.(); });
  const paid = active && ['PAID', 'DELIVERED'].includes(active.status);
  return <section className="cosmetic-purchases" aria-label="Your cosmetic purchases">
    {active && <div className={`purchase-reveal ${paid ? 'is-paid' : ''}`}>
      {paid ? <><p className="eyebrow">{active.forMe ? active.isGift ? `A GIFT FROM ${active.buyer.displayName}` : 'YOURS TO KEEP' : 'GIFT DELIVERED'}</p><div className="purchase-reveal-art" aria-hidden="true">{editions.map(edition => <CardArtwork key={edition.id} cardId="SIGNAL_FLARE" finishId={edition.finishId} size={108} />)}</div><h2 ref={revealHeading} tabIndex={-1}>{active.forMe ? `${pack.name}. All yours.` : `${pack.name}, for ${active.recipient.displayName}.`}</h2><p>{active.forMe ? 'Your cards, your frame, your backdrop. A new signature, whenever you feel like it.' : 'The collection is in their editions. They can make it theirs when they’re ready.'}</p>
        {active.forMe && editions.length > 1 && <div className="shop-edition-switch" role="group" aria-label="Choose an edition to wear">{editions.map(edition => <button type="button" key={edition.id} disabled={busy} aria-pressed={editionId === edition.id} onClick={() => setEditionId(edition.id)}>{edition.name}</button>)}</div>}
        <div className="purchase-reveal-actions">{active.forMe && <Button variant="aura" loading={busy} onClick={() => void wear()}><Sparkles size={16} />Wear it now</Button>}<button type="button" disabled={busy} onClick={() => void dismiss()}>{active.forMe ? 'Keep it for later' : 'Back to collections'}</button></div><small>{formatCosmeticPrice({ amount: active.paidTotal ?? active.amount, currency: active.currency, exponent: active.exponent })} · {active.isGift ? 'Gift receipt' : 'Purchase receipt'}</small>
      </> : <><p className="eyebrow">YOUR CHECKOUT</p><h2 ref={revealHeading} tabIndex={-1}>{pack?.name || 'Your edition'} is {active.status === 'EXPIRED' ? 'still waiting for you.' : 'almost yours.'}</h2><p>{paymentCopy(active)}</p>{active.needsSupport && <p className="purchase-support"><code>{active.id}</code><a href="/contact">Contact support</a></p>}<div className="purchase-reveal-actions">{['PREPARING', 'OPEN'].includes(active.status) && active.canResume !== false && <Button variant="aura" disabled={busy} onClick={() => void resume(active)}>Resume checkout</Button>}<button type="button" disabled={busy} onClick={() => void check(active)}><RefreshCw size={15} />Check payment</button><button type="button" disabled={busy} onClick={() => { setActive(null); onClearReturn?.(); }}>Back to collections</button></div></>}
    </div>}
    <header><h3>Your purchases</h3><button type="button" disabled={busy} onClick={() => void load()}><RefreshCw size={14} />Refresh</button></header>
    {orders === null && !error ? <p className="shop-status" role="status">Opening your purchases…</p> : !orders?.length ? <p className="purchase-empty">Your receipts and received gifts will live here.</p> : <div className="purchase-history">{orders.map(order => <article key={order.id}><span><strong>{COSMETIC_PACKS.find(pack => pack.id === order.packId)?.name}</strong><small>{order.isGift ? order.forMe ? `From ${order.buyer.displayName}` : `For ${order.recipient.displayName}` : 'For you'} · {formatCosmeticPrice({ amount: order.paidTotal ?? order.amount, currency: order.currency, exponent: order.exponent })}</small></span><span className="purchase-history-actions">{['PAID', 'DELIVERED'].includes(order.status) ? <button type="button" disabled={busy} onClick={() => { setActive(order); setEditionId(collectionFor(COSMETIC_PACKS.find(pack => pack.id === order.packId))[0].id); }}><Check size={14} />{order.forMe ? 'Open edition' : 'Gift delivered'}</button> : ['OPEN', 'PREPARING'].includes(order.status) ? <>{order.canResume !== false && <button type="button" disabled={busy} onClick={() => void resume(order)}>Resume</button>}<button type="button" disabled={busy} onClick={() => void check(order)}>Check</button>{order.status === 'OPEN' && order.canCancel !== false && <button type="button" disabled={busy} onClick={() => void closeCheckout(order)}>Close checkout</button>}</> : <small>{order.status === 'EXPIRED' ? 'Expired' : 'Did not open'}</small>}</span></article>)}</div>}
    {error && <p className="shop-error" role="alert">{error}</p>}
  </section>;
};
