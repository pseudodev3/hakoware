import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ArrowUpRight, Check, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { getContractSides } from '../friendship/contractState';
import {
  activateCollectionCard,
  createCardOffer,
  getCardCollection,
  purchaseCollectionCard,
  respondToCardOffer,
} from '../../services/cardService';
import { CardArtwork } from './CardArtwork';
import './CardCollection.css';

export const CardCollection = ({
  friendships,
  onNavigate,
  showToast,
  focusTradeId,
}) => {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(focusTradeId ? 'offers' : 'collection');
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [friend, setFriend] = useState('');
  const [give, setGive] = useState('');
  const [want, setWant] = useState('');
  const [target, setTarget] = useState('');
  const alive = useRef(true);
  const request = useRef(0);
  const busyRef = useRef(false);
  const buyKeys = useRef({});
  const offerKey = useRef(null);
  const focusDone = useRef(null);
  const load = useCallback(async () => {
    const generation = ++request.current;
    try {
      const next = await getCardCollection();
      if (alive.current && generation === request.current) {
        setData(next);
        setError('');
      }
    } catch (err) {
      if (alive.current && generation === request.current)
        setError(err.message || 'Could not load your cards');
    } finally {
      if (alive.current && generation === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible' && !busyRef.current)
        void load();
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive.current = false;
      request.current += 1;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);
  useEffect(() => {
    if (focusTradeId) setTab('offers');
  }, [focusTradeId]);
  useEffect(() => {
    if (
      tab !== 'offers' ||
      !data ||
      !focusTradeId ||
      focusDone.current === focusTradeId
    )
      return;
    const element = document.getElementById('card-offer-' + focusTradeId);
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      element.focus({ preventScroll: true });
      focusDone.current = focusTradeId;
    }
  }, [tab, data, focusTradeId]);
  const run = async (operation, message) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFormError('');
    request.current += 1;
    try {
      await operation();
      if (!alive.current) return;
      setSheet(null);
      showToast?.(message, 'SUCCESS');
      await Promise.allSettled([load(), refreshUser()]);
    } catch (err) {
      if (alive.current) {
        setFormError(err.message || 'Could not complete this action');
        if (!sheet)
          showToast?.(err.message || 'Could not answer this offer', 'ERROR');
        void load();
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const close = () => {
    if (!busyRef.current) {
      setSheet(null);
      setFormError('');
    }
  };
  const cards = data?.cards || [];
  const byId = Object.fromEntries(cards.map((card) => [card.id, card]));
  const pending = (data?.trades || []).filter(
    (trade) => trade.status === 'PENDING',
  );
  const selected = sheet?.cardId ? byId[sheet.cardId] : null;
  const openOffer = (cardId = '', counter = null) => {
    setGive(
      counter
        ? byId[counter.requestedCardId]?.owned
          ? counter.requestedCardId
          : ''
        : cardId,
    );
    setWant(counter ? counter.offeredCardId : '');
    setFriend(counter?.friendshipId || data?.partners[0]?.friendshipId || '');
    setSheet({ mode: 'offer', counter });
    setFormError('');
    offerKey.current = null;
  };
  const submitOffer = (event) => {
    event.preventDefault();
    const payload = {
      friendshipId: friend,
      offeredCardId: give,
      requestedCardId: want,
      ...(sheet.counter ? { counterOf: sheet.counter.id } : {}),
    };
    const signature = JSON.stringify(payload);
    if (offerKey.current?.signature !== signature)
      offerKey.current = { signature, clientId: crypto.randomUUID() };
    void run(
      () =>
        createCardOffer({ ...payload, clientId: offerKey.current.clientId }),
      sheet.counter
        ? 'Counter-offer sent. Your card is reserved.'
        : 'Offer sent. Your card is reserved.',
    );
  };
  const buy = (card) => {
    buyKeys.current[card.id] ||= crypto.randomUUID();
    void run(async () => {
      await purchaseCollectionCard(card.id, buyKeys.current[card.id]);
      delete buyKeys.current[card.id];
    }, card.name + ' added to your collection.');
  };
  const userId = user._id || user.id || user.uid;
  const usable = (card) =>
    friendships.filter((friendship) => {
      const sides = getContractSides(friendship, userId);
      if (card.id === 'STEAL')
        return (
          friendship.season?.status === 'ACTIVE' &&
          sides.partnerDebt?.isBankrupt &&
          !friendship.grudge?.active
        );
      if (card.id === 'CHAOS_TICKET')
        return (
          friendship.templateId === 'CHAOS' &&
          friendship.season?.status === 'ACTIVE' &&
          !friendship.chaos?.activeEvent &&
          !friendship.chaos?.wantedUserId
        );
      return friendship.status === 'ACTIVE';
    });
  const canPurify = friendships.some(
    (friendship) => getContractSides(friendship, userId).ownDebt?.totalDebt > 0,
  );
  const ownerName = (friendship) =>
    getContractSides(friendship, userId).partner?.displayName || 'Your friend';
  const activate = (event) => {
    event.preventDefault();
    void run(
      () => activateCollectionCard(selected.id, target || null),
      selected.name + ' used.',
    );
  };
  if (loading && !data)
    return (
      <p className="cards-loading" role="status">
        Opening your collection…
      </p>
    );
  if (!data)
    return (
      <div className="cards-error" role="status">
        <p>{error}</p>
        <button onClick={() => void load()}>Retry</button>
      </div>
    );
  return (
    <section className="card-collection" aria-label="Cards and trades">
      <header className="collection-heading">
        <div>
          <p className="eyebrow">Your collection</p>
          <h2>Keep a few tricks.</h2>
          <p>
            {cards.filter((card) => card.discovered).length} of {cards.length}{' '}
            discovered · {data.balance} Aura
          </p>
        </div>
        <button
          className="collection-new-offer"
          onClick={() => openOffer()}
          disabled={
            !cards.some((card) => card.owned > 0) || !data.partners.length
          }
        >
          <Plus size={17} /> Offer
        </button>
      </header>
      <div className="collection-tabs" role="tablist" aria-label="Cards views">
        <button
          role="tab"
          aria-selected={tab === 'collection'}
          onClick={() => setTab('collection')}
        >
          Collection
        </button>
        <button
          role="tab"
          aria-selected={tab === 'offers'}
          onClick={() => setTab('offers')}
        >
          Offers {pending.length > 0 && <span>{pending.length}</span>}
        </button>
      </div>
      {error && (
        <div className="cards-error" role="status">
          <p>{error}</p>
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {tab === 'collection' ? (
        <>
          <div className="collection-filters" aria-label="Filter cards">
            {[
              ['all', 'All'],
              ['SPELL', 'Tools'],
              ['STICKER', 'Wall marks'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="collection-grid">
            {cards
              .filter((card) => filter === 'all' || card.kind === filter)
              .map((card) => (
                <button
                  key={card.id}
                  className={`collection-card ${card.discovered ? 'is-discovered' : ''}`}
                  onClick={() => {
                    setSheet({ mode: 'card', cardId: card.id });
                    setFormError('');
                  }}
                  aria-label={`${card.name}, ${card.owned} available${card.reserved ? ', ' + card.reserved + ' reserved' : ''}`}
                >
                  <span className="collection-card-number">
                    {String(card.number).padStart(2, '0')} / {card.series}
                  </span>
                  <CardArtwork cardId={card.id} />
                  <strong>{card.name}</strong>
                  <span className="collection-card-kind">
                    {card.kind === 'STICKER'
                      ? 'Reusable wall mark'
                      : 'Single-use tool'}
                  </span>
                  <span className="collection-card-owned">
                    {card.owned > 0 ? (
                      <>
                        <Check size={12} /> {card.owned} ready
                      </>
                    ) : card.discovered ? (
                      'Collected before'
                    ) : (
                      card.cost + ' Aura'
                    )}
                    {card.reserved > 0 && (
                      <small>{card.reserved} in offers</small>
                    )}
                  </span>
                </button>
              ))}
          </div>
          <p className="collection-footnote">
            Tools change the game. Wall marks can be stamped again and again
            while you own a copy.
          </p>
        </>
      ) : (
        <div className="collection-offers">
          {!data.partners.length && (
            <p className="collection-empty">
              Trades start with an accepted friend. Your cards are ready when
              your circle grows.
            </p>
          )}
          {!data.trades.length ? (
            <div className="collection-empty">
              <ArrowLeftRight size={26} />
              <h3>No offers yet.</h3>
              <p>
                Offer a spare card for something you want. Your friend can
                answer later.
              </p>
              <button
                onClick={() => openOffer()}
                disabled={
                  !data.partners.length || !cards.some((card) => card.owned)
                }
              >
                Make an offer
              </button>
            </div>
          ) : (
            [...data.trades]
              .sort(
                (a, b) =>
                  Number(b.status === 'PENDING') -
                    Number(a.status === 'PENDING') ||
                  new Date(b.createdAt) - new Date(a.createdAt),
              )
              .map((trade) => (
                <article
                  key={trade.id}
                  id={'card-offer-' + trade.id}
                  tabIndex={-1}
                  className={`collection-offer ${trade.id === focusTradeId ? 'is-focused' : ''}`}
                >
                  <div className="collection-offer-person">
                    <UserAvatar person={trade.partner} size="sm" decorative />
                    <div>
                      <strong>
                        {trade.mine ? 'Your offer to ' : 'From '}
                        {trade.partner.displayName}
                      </strong>
                      <small>
                        {trade.status === 'PENDING'
                          ? 'Open until ' +
                            new Date(trade.expiresAt).toLocaleDateString(
                              undefined,
                              { month: 'short', day: 'numeric' },
                            )
                          : trade.status.toLowerCase()}
                      </small>
                    </div>
                  </div>
                  <div className="collection-offer-swap">
                    <span>
                      <CardArtwork cardId={trade.offeredCardId} size={25} />
                      <strong>{byId[trade.offeredCardId]?.name}</strong>
                      <small>{trade.mine ? 'You give' : 'You get'}</small>
                    </span>
                    <ArrowLeftRight size={18} />
                    <span>
                      <CardArtwork cardId={trade.requestedCardId} size={25} />
                      <strong>{byId[trade.requestedCardId]?.name}</strong>
                      <small>{trade.mine ? 'You get' : 'You give'}</small>
                    </span>
                  </div>
                  {trade.status === 'PENDING' && (
                    <>
                      <p className="collection-offer-note">
                        {trade.mine
                          ? 'Your offered copy is reserved until this closes.'
                          : !byId[trade.requestedCardId]?.owned
                            ? 'You don’t have an available copy to give. Counter or decline.'
                            : 'Accepting swaps these two copies. No Aura changes hands.'}
                      </p>
                      <div className="collection-offer-actions">
                        {trade.mine ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () => respondToCardOffer(trade.id, 'CANCEL'),
                                'Offer cancelled. Your card is back.',
                              )
                            }
                          >
                            Cancel offer
                          </button>
                        ) : (
                          <>
                            <button
                              className="primary"
                              disabled={
                                busy || !byId[trade.requestedCardId]?.owned
                              }
                              onClick={() =>
                                void run(
                                  () => respondToCardOffer(trade.id, 'ACCEPT'),
                                  'Cards exchanged.',
                                )
                              }
                            >
                              Accept
                            </button>
                            <button
                              disabled={
                                busy || !cards.some((card) => card.owned)
                              }
                              onClick={() => openOffer('', trade)}
                            >
                              Counter
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => respondToCardOffer(trade.id, 'DECLINE'),
                                  'Offer declined.',
                                )
                              }
                            >
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </article>
              ))
          )}
        </div>
      )}
      {focusTradeId &&
        tab === 'offers' &&
        !data.trades.some((trade) => trade.id === focusTradeId) && (
          <p className="cards-error" role="status">
            This offer is no longer in your recent history.
          </p>
        )}
      {sheet && (
        <ActionSheet
          title={
            sheet.mode === 'offer'
              ? sheet.counter
                ? 'Counter-offer'
                : 'Make an offer'
              : selected?.name || 'Card'
          }
          onClose={close}
          footer={
            sheet.mode === 'offer' ? (
              <button
                form="card-offer-form"
                className="card-primary-action"
                disabled={
                  busy ||
                  !byId[give]?.owned ||
                  !want ||
                  give === want ||
                  !friend
                }
              >
                {busy ? 'Sending…' : 'Reserve card & send offer'}
              </button>
            ) : sheet.mode === 'use' ? (
              <button
                form="card-use-form"
                className="card-primary-action"
                disabled={
                  busy || (selected?.id === 'PURIFY' ? !canPurify : !target)
                }
              >
                {busy ? 'Using…' : 'Use ' + selected?.name}
              </button>
            ) : (
              <button
                className="card-primary-action"
                onClick={() => buy(selected)}
                disabled={busy || data.balance < selected.cost}
              >
                {busy
                  ? 'Buying…'
                  : data.balance < selected.cost
                    ? 'Need ' + selected.cost + ' Aura'
                    : 'Buy a copy · ' + selected.cost + ' Aura'}
              </button>
            )
          }
        >
          {sheet.mode === 'offer' ? (
            <form
              id="card-offer-form"
              onSubmit={submitOffer}
              className="card-form"
            >
              <label>
                Friend
                <select
                  aria-label="Friend"
                  value={friend}
                  onChange={(event) => setFriend(event.target.value)}
                  disabled={busy || Boolean(sheet.counter)}
                >
                  <option value="">Choose a friend</option>
                  {data.partners.map((person) => (
                    <option
                      key={person.friendshipId}
                      value={person.friendshipId}
                    >
                      {person.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                You give
                <select
                  aria-label="You give"
                  value={give}
                  onChange={(event) => setGive(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Choose an available card</option>
                  {cards
                    .filter((card) => card.owned > 0)
                    .map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name} · {card.owned} ready
                      </option>
                    ))}
                </select>
              </label>
              <label>
                You want
                <select
                  aria-label="You want"
                  value={want}
                  onChange={(event) => setWant(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Choose a card</option>
                  {cards
                    .filter((card) => card.id !== give)
                    .map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                </select>
              </label>
              <p>
                Your copy stays reserved for up to seven days. Declined,
                cancelled and expired offers return it automatically.
                {sheet.counter && ' Sending this replaces the original offer.'}
              </p>
            </form>
          ) : sheet.mode === 'use' ? (
            <form id="card-use-form" onSubmit={activate} className="card-form">
              <p>{selected.description}</p>
              {selected.id === 'PURIFY' ? (
                <p>
                  {canPurify
                    ? 'This clears your debt across active contracts. Grace periods stay the same.'
                    : 'You have no debt to clear.'}
                </p>
              ) : (
                <label>
                  Contract
                  <select
                    aria-label="Contract"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">Choose a contract</option>
                    {usable(selected).map((friendship) => (
                      <option key={friendship._id} value={friendship._id}>
                        {ownerName(friendship)}
                      </option>
                    ))}
                  </select>
                  {!usable(selected).length && (
                    <small>No eligible contracts right now.</small>
                  )}
                </label>
              )}
            </form>
          ) : (
            <div className="card-detail">
              <CardArtwork cardId={selected.id} size={74} />
              <p>{selected.description}</p>
              <small>
                {selected.owned} available · {selected.reserved} reserved
              </small>
              {selected.kind === 'STICKER' && (
                <p>
                  Own one copy to stamp this design on the After Hours wall as
                  often as you like. Stamping doesn’t consume it.
                </p>
              )}
              <div className="card-detail-actions">
                <button
                  disabled={!selected.owned || busy}
                  onClick={() => {
                    if (selected.kind === 'STICKER') {
                      close();
                      onNavigate?.('afterHours', { wall: true });
                    } else {
                      setTarget('');
                      setSheet({ mode: 'use', cardId: selected.id });
                    }
                  }}
                >
                  {selected.kind === 'STICKER' ? 'Stamp on wall' : 'Use card'}{' '}
                  <ArrowUpRight size={15} />
                </button>
                <button
                  disabled={!selected.owned || busy || !data.partners.length}
                  onClick={() => openOffer(selected.id)}
                >
                  Offer this card <ArrowLeftRight size={15} />
                </button>
              </div>
            </div>
          )}
          {formError && (
            <p className="card-form-error" role="status">
              {formError}
            </p>
          )}
        </ActionSheet>
      )}
    </section>
  );
};
