const mongoose = require('mongoose');
const { createHash } = require('node:crypto');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const CardTrade = require('../models/CardTrade');
const Notification = require('../models/Notification');
const ContractEvent = require('../models/ContractEvent');
const { CARD_CATALOG } = require('./cardCatalog');
const { removeCard } = require('./cardInventory');
// Each reservation and its receipt commit in one account update. OPEN can
// become ACCEPTING or CLOSING once; recovery finishes that same decision.
// Terminal cancellation receipts fence off late concurrent reservations.
const id = value => String(value?._id || value || '');
const oid = value => new mongoose.Types.ObjectId(id(value));
const stableId = value => new mongoose.Types.ObjectId(createHash('sha256').update(value).digest('hex').slice(0, 24));
const fields = '+escrowVersion +phase +closingStatus +settlementActorId +deliveryPending';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const retryKey = value => { if (!/^[a-zA-Z0-9_-]{16,80}$/.test(String(value || ''))) fail(400, 'A retry key is required'); return String(value); };
const readTrade = tradeId => CardTrade.findById(tradeId).select(fields).lean();
const receipt = async (userId, tradeId) => {
  const user = await User.findById(userId).select('+cardTradeReceipts').lean();
  return user?.cardTradeReceipts?.find(value => id(value.tradeId) === id(tradeId)) || null;
};
const participantContract = async (friendshipId, actorId) => {
  if (!mongoose.isValidObjectId(friendshipId)) fail(404, 'Accepted contract not found');
  const friendship = await Friendship.findOne({ _id: friendshipId, status: 'ACTIVE', $or: [{ user1: actorId }, { user2: actorId }] }).lean();
  if (!friendship) fail(404, 'Trade with an accepted friend');
  const recipientId = id(friendship.user1) === id(actorId) ? friendship.user2 : friendship.user1;
  const people = await User.find({ _id: { $in: [actorId, recipientId] } }).select('_id isTestAccount testOwnerId').lean();
  if (people.length !== 2 || Boolean(people[0].isTestAccount) !== Boolean(people[1].isTestAccount) || people[0].isTestAccount && id(people[0].testOwnerId) !== id(people[1].testOwnerId)) fail(404, 'Trade partner not found');
  return { friendship, recipientId };
};
const holdCard = async (trade, side, legacy = false) => {
  const sender = side === 'SENDER';
  const userId = sender ? trade.senderId : trade.recipientId;
  const cardId = sender ? trade.offeredCardId : trade.requestedCardId;
  const pairKey = `${id(trade.recipientId)}:${trade.offeredCardId}:${trade.requestedCardId}`;
  const value = { tradeId: oid(trade._id), side, cardId, ...(sender ? { pairKey } : {}), state: 'HELD', createdAt: new Date() };
  const filter = { _id: userId, 'cardTradeReceipts.tradeId': { $ne: trade._id }, ...(!legacy ? { inventory: cardId } : {}) };
  if (sender && !legacy) {
    filter.cardTradeReceipts = { $not: { $elemMatch: { side: 'SENDER', pairKey, state: 'HELD' } } };
    filter.$expr = { $lt: [{ $size: { $filter: { input: { $ifNull: ['$cardTradeReceipts', []] }, as: 'held', cond: { $and: [{ $eq: ['$$held.side', 'SENDER'] }, { $eq: ['$$held.state', 'HELD'] }] } } } }, 10] };
  }
  const result = await User.findOneAndUpdate(filter, [
    ...(!legacy ? removeCard(cardId) : []),
    { $set: { cardTradeReceipts: { $concatArrays: [{ $ifNull: ['$cardTradeReceipts', []] }, [{ $literal: value }]] } } }
  ], { returnDocument: 'after', updatePipeline: true }).select('+cardTradeReceipts');
  if (result) return true;
  return (await receipt(userId, trade._id))?.state === 'HELD';
};
// A terminal receipt also acts as a tombstone: a late concurrent request cannot
// reserve a card after a cancellation has already finished.
const refundCard = async (trade, side) => {
  const sender = side === 'SENDER', userId = sender ? trade.senderId : trade.recipientId;
  const cardId = sender ? trade.offeredCardId : trade.requestedCardId, tradeId = oid(trade._id);
  const matching = { $filter: { input: { $ifNull: ['$cardTradeReceipts', []] }, as: 'r', cond: { $eq: ['$$r.tradeId', tradeId] } } };
  const held = { $gt: [{ $size: { $filter: { input: matching, as: 'r', cond: { $eq: ['$$r.state', 'HELD'] } } } }, 0] };
  const tombstone = { tradeId, side, cardId, state: 'REFUNDED', createdAt: new Date() };
  await User.updateOne({ _id: userId }, [{ $set: {
    inventory: { $concatArrays: [{ $ifNull: ['$inventory', []] }, { $cond: [held, [cardId], []] }] },
    cardDiscoveries: { $setUnion: [{ $ifNull: ['$cardDiscoveries', []] }, { $cond: [held, [cardId], []] }] },
    cardTradeReceipts: { $cond: [
      { $gt: [{ $size: matching }, 0] },
      { $map: { input: '$cardTradeReceipts', as: 'r', in: { $cond: [{ $and: [{ $eq: ['$$r.tradeId', tradeId] }, { $eq: ['$$r.state', 'HELD'] }] }, { $mergeObjects: ['$$r', { state: 'REFUNDED' }] }, '$$r'] } } },
      { $concatArrays: [{ $ifNull: ['$cardTradeReceipts', []] }, [{ $literal: tombstone }]] }
    ] }
  } }], { updatePipeline: true });
};
const deliverCard = async (trade, side) => {
  const sender = side === 'SENDER', userId = sender ? trade.senderId : trade.recipientId;
  const received = sender ? trade.requestedCardId : trade.offeredCardId, tradeId = oid(trade._id);
  const result = await User.updateOne({ _id: userId, cardTradeReceipts: { $elemMatch: { tradeId, state: 'HELD' } } }, [{ $set: {
    inventory: { $concatArrays: [{ $ifNull: ['$inventory', []] }, [received]] },
    cardDiscoveries: { $setUnion: [{ $ifNull: ['$cardDiscoveries', []] }, [received]] },
    cardTradeReceipts: { $map: { input: '$cardTradeReceipts', as: 'r', in: { $cond: [{ $eq: ['$$r.tradeId', tradeId] }, { $mergeObjects: ['$$r', { state: 'DELIVERED' }] }, '$$r'] } } }
  } }], { updatePipeline: true });
  if (!result.matchedCount && (await receipt(userId, trade._id))?.state !== 'DELIVERED') fail(409, 'This exchange needs recovery. Your reserved cards remain protected.');
};
const adoptLegacy = async trade => {
  if (!trade || trade.escrowVersion === 1 || trade.status !== 'PENDING') return trade;
  // Historical pending offers already removed their sender's card atomically.
  await holdCard(trade, 'SENDER', true);
  await CardTrade.updateOne({ _id: trade._id, escrowVersion: { $ne: 1 } }, { $set: { escrowVersion: 1, phase: 'OPEN', deliveryPending: false } });
  return readTrade(trade._id);
};
const beginClose = async (trade, status, actorId = null, counterTradeId = null) => {
  await CardTrade.updateOne({ _id: trade._id, phase: { $in: ['PREPARING', 'OPEN'] } }, { $set: { phase: 'CLOSING', closingStatus: status, settlementActorId: actorId || trade.senderId, ...(counterTradeId ? { counterTradeId } : {}) } });
  return readTrade(trade._id);
};
const finishClose = async trade => {
  await refundCard(trade, 'SENDER'); await refundCard(trade, 'RECIPIENT');
  const failed = trade.closingStatus === 'REJECTED';
  await CardTrade.updateOne({ _id: trade._id, phase: 'CLOSING' }, { $set: { phase: failed ? 'FAILED' : 'COMPLETE', status: failed ? 'CANCELLED' : trade.closingStatus, settledAt: new Date(), deliveryPending: !failed && ['CANCELLED', 'DECLINED'].includes(trade.closingStatus) } });
  return readTrade(trade._id);
};
const finishAccept = async trade => {
  await deliverCard(trade, 'SENDER'); await deliverCard(trade, 'RECIPIENT');
  await CardTrade.updateOne({ _id: trade._id, phase: 'ACCEPTING' }, { $set: { phase: 'COMPLETE', status: 'ACCEPTED', settledAt: new Date(), settlementActorId: trade.recipientId, deliveryPending: true } });
  return readTrade(trade._id);
};
const deliverActivity = async trade => {
  if (!trade?.deliveryPending || !['OPEN', 'COMPLETE'].includes(trade.phase)) return;
  const status = trade.status;
  if (status === 'ACCEPTED') await ContractEvent.updateOne({ _id: stableId(`trade:${id(trade)}:accepted-event`) }, { $setOnInsert: { friendshipId: trade.friendshipId, userId: trade.recipientId, type: 'CARD_TRADE_ACCEPTED', metadata: { offeredCardId: trade.offeredCardId, requestedCardId: trade.requestedCardId } } }, { upsert: true });
  const actorId = status === 'PENDING' ? trade.senderId : trade.settlementActorId;
  const toUserId = id(actorId) === id(trade.senderId) ? trade.recipientId : trade.senderId;
  const actor = await User.findById(actorId).select('displayName').lean();
  const title = status === 'PENDING' ? 'Card offer' : 'Card trade ' + status.toLowerCase();
  // Preserve legacy random-ID notices instead of issuing a second one.
  if (!await Notification.exists({ cardTradeId: trade._id, type: 'CARD_TRADE', toUserId, title })) await Notification.updateOne({ _id: stableId(`trade:${id(trade)}:notice:${status}`) }, { $setOnInsert: {
    toUserId, fromUserId: actorId, friendshipId: trade.friendshipId, type: 'CARD_TRADE', title,
    message: `${actor?.displayName || 'Your friend'} ${status === 'PENDING' ? 'offered' : status.toLowerCase()} ${CARD_CATALOG[trade.offeredCardId].name} for ${CARD_CATALOG[trade.requestedCardId].name}.`, cardTradeId: trade._id
  } }, { upsert: true });
  await CardTrade.updateOne({ _id: trade._id, phase: trade.phase, status }, { $set: { deliveryPending: false } });
};
const reconcileTrade = async tradeId => {
  let trade = await adoptLegacy(await readTrade(tradeId));
  if (!trade) return null;
  const active = async () => Boolean(await Friendship.exists({ _id: trade.friendshipId, status: 'ACTIVE' }));
  if (trade.phase === 'PREPARING') {
    if (trade.expiresAt <= new Date() || !await active()) trade = await beginClose(trade, 'REJECTED');
    else if (!await holdCard(trade, 'SENDER')) trade = await beginClose(trade, 'REJECTED');
    else {
      let ready = true;
      if (trade.counterOf) {
        let previous = await adoptLegacy(await readTrade(trade.counterOf));
        if (previous && id(previous.recipientId) === id(trade.senderId) && id(previous.friendshipId) === id(trade.friendshipId) && previous.status === 'PENDING' && previous.phase === 'OPEN' && previous.expiresAt > new Date()) previous = await beginClose(previous, 'COUNTERED', trade.senderId, trade._id);
        if (previous?.phase === 'CLOSING' && id(previous.counterTradeId) === id(trade._id)) previous = await finishClose(previous);
        ready = previous?.status === 'COUNTERED' && id(previous.counterTradeId) === id(trade._id);
      }
      if (ready) {
        await CardTrade.updateOne({ _id: trade._id, phase: 'PREPARING' }, { $set: { phase: 'OPEN', deliveryPending: true } }); trade = await readTrade(trade._id);
      } else trade = await beginClose(trade, 'REJECTED');
    }
  }
  if (trade.phase === 'OPEN') {
    if (trade.expiresAt <= new Date() || !await active()) trade = await beginClose(trade, trade.expiresAt <= new Date() ? 'EXPIRED' : 'CANCELLED');
    else if ((await receipt(trade.recipientId, trade._id))?.state === 'HELD') {
      await CardTrade.updateOne({ _id: trade._id, phase: 'OPEN', expiresAt: { $gt: new Date() } }, { $set: { phase: 'ACCEPTING' } }); trade = await readTrade(trade._id);
    }
  }
  if (trade.phase === 'CLOSING') trade = await finishClose(trade);
  if (trade.phase === 'ACCEPTING') trade = await finishAccept(trade);
  await deliverActivity(trade).catch(error => console.error('Card trade activity pending:', error.message));
  return trade;
};
let workerCursor = null;
const settleExpiredTrades = async (userId = null) => {
  const eligible = { $or: [{ status: 'PENDING' }, { deliveryPending: true }] };
  let query = userId ? { $and: [eligible, { $or: [{ senderId: userId }, { recipientId: userId }] }] } : { ...eligible, ...(workerCursor ? { _id: { $gt: workerCursor } } : {}) };
  let trades = await CardTrade.find(query).select('_id').sort({ _id: 1 }).limit(userId ? 1000 : 100).lean();
  if (!userId && !trades.length && workerCursor) { workerCursor = null; trades = await CardTrade.find(eligible).select('_id').sort({ _id: 1 }).limit(100).lean(); }
  for (const trade of trades) {
    try { await reconcileTrade(trade._id); }
    catch (error) { if (userId) throw error; console.error('Card trade recovery pending:', id(trade._id), error.message); }
  }
  if (!userId && trades.length) workerCursor = trades.at(-1)._id;
};
const matchesRequest = (trade, actorId, body, clientId) => id(trade.senderId) === id(actorId) && trade.clientId === clientId && id(trade.friendshipId) === id(body.friendshipId) && trade.offeredCardId === body.offeredCardId && trade.requestedCardId === body.requestedCardId && id(trade.counterOf) === id(body.counterOf);
const createOffer = async (actorId, body) => {
  const clientId = retryKey(body.clientId), offered = String(body.offeredCardId || ''), requested = String(body.requestedCardId || '');
  if (!CARD_CATALOG[offered] || !CARD_CATALOG[requested] || offered === requested) fail(400, 'Choose two different cards');
  if (body.counterOf && !mongoose.isValidObjectId(body.counterOf)) fail(400, 'Invalid offer');
  let trade = await CardTrade.findOne({ senderId: actorId, clientId }).select(fields).lean();
  if (trade) {
    if (!matchesRequest(trade, actorId, body, clientId)) fail(409, 'This retry key belongs to another offer.');
    trade = await reconcileTrade(trade._id);
    if (trade.phase === 'FAILED') fail(409, 'Your offer could not reserve this card. Make a fresh offer.');
    return trade;
  }
  await settleExpiredTrades(actorId);
  const { friendship, recipientId } = await participantContract(body.friendshipId, actorId);
  if (body.counterOf && !await CardTrade.exists({ _id: body.counterOf, recipientId: actorId, friendshipId: friendship._id, status: 'PENDING', expiresAt: { $gt: new Date() } })) fail(409, 'That offer has already changed');
  const tradeId = stableId(`card-offer:v1:${id(actorId)}:${clientId}`);
  try {
    await CardTrade.updateOne({ _id: tradeId }, { $setOnInsert: { senderId: actorId, recipientId, friendshipId: friendship._id, offeredCardId: offered, requestedCardId: requested, clientId, status: 'PENDING', phase: 'PREPARING', escrowVersion: 1, expiresAt: new Date(Date.now() + 7 * 86400000), ...(body.counterOf ? { counterOf: body.counterOf } : {}) } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; const duplicate = await readTrade(tradeId); if (!duplicate) fail(409, 'You already have this offer open with that friend.'); }
  trade = await readTrade(tradeId);
  if (!matchesRequest(trade, actorId, body, clientId)) fail(409, 'This retry key belongs to another offer.');
  trade = await reconcileTrade(tradeId);
  if (trade.phase === 'FAILED') fail(409, 'That card is unavailable, already offered, or your ten open offers are full. Your cards have not moved.');
  return trade;
};
const respondToOffer = async (actorId, tradeId, action) => {
  if (!mongoose.isValidObjectId(tradeId)) fail(404, 'Offer not found');
  if (!['ACCEPT', 'DECLINE', 'CANCEL'].includes(action)) fail(400, 'Choose accept, decline or cancel');
  let trade = await readTrade(tradeId);
  if (!trade || ![id(trade.senderId), id(trade.recipientId)].includes(id(actorId))) fail(404, 'Offer not found');
  if ((action === 'CANCEL' ? id(trade.senderId) : id(trade.recipientId)) !== id(actorId)) fail(403, 'Only the other person can answer this offer');
  trade = await reconcileTrade(tradeId);
  const terminal = { ACCEPT: 'ACCEPTED', DECLINE: 'DECLINED', CANCEL: 'CANCELLED' }[action];
  if (trade.status === terminal) return trade;
  if (trade.status !== 'PENDING' || trade.phase !== 'OPEN') fail(409, `This offer is ${trade.status.toLowerCase()}`);
  if (action === 'ACCEPT') {
    await participantContract(trade.friendshipId, actorId);
    if (!await holdCard(trade, 'RECIPIENT')) {
      trade = await readTrade(tradeId);
      if (trade.status === 'ACCEPTED') return trade;
      if (trade.status !== 'PENDING') fail(409, `This offer is ${trade.status.toLowerCase()}`);
      fail(409, 'You no longer have the requested card. Counter or decline instead.');
    }
    await CardTrade.updateOne({ _id: trade._id, phase: 'OPEN', expiresAt: { $gt: new Date() } }, { $set: { phase: 'ACCEPTING' } });
  } else await beginClose(trade, terminal, actorId);
  trade = await reconcileTrade(tradeId);
  if (trade.status !== terminal) fail(409, `This offer is ${trade.status.toLowerCase()}`);
  return trade;
};
module.exports = { createOffer, respondToOffer, settleExpiredTrades, reconcileTrade, retryKey };
