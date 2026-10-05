const mongoose = require('mongoose');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const CardTrade = require('../models/CardTrade');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const { CARD_CATALOG } = require('./cardCatalog');
const { takeCard } = require('./cardInventory');
const { publicKey } = require('./clientViews');
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status, ...(status === 503 ? { publicMessage: message } : {}) });
};
const id = (value) => String(value?._id || value || '');
const personView = (value) =>
  value
    ? {
        displayName: value.displayName,
        username: value.username || null,
        avatar: value.avatar || null,
      }
    : { displayName: 'Your friend', username: null, avatar: null };
const retryKey = (value) => {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(String(value || '')))
    fail(400, 'A retry key is required');
  return String(value);
};
const inTransaction = async (operation) => {
  try {
    return await mongoose.connection.transaction(operation);
  } catch (error) {
    if (
      /Transaction numbers are only allowed|does not support retryable writes/.test(
        error.message,
      )
    )
      fail(
        503,
        'Trading is temporarily unavailable. Your cards have not moved.',
      );
    throw error;
  }
};
const closeOffer = async (trade, status, session) => {
  if (trade.status !== 'PENDING') return trade;
  await User.updateOne(
    { _id: trade.senderId },
    {
      $push: { inventory: trade.offeredCardId },
      $addToSet: { cardDiscoveries: trade.offeredCardId },
    },
    { session },
  );
  trade.status = status;
  trade.settledAt = new Date();
  await trade.save({ session });
  return trade;
};
const settleStaleOffer = (tradeId) =>
  inTransaction(async (session) => {
    const trade = await CardTrade.findById(tradeId).session(session);
    if (!trade || trade.status !== 'PENDING') return;
    const active = await Friendship.exists({
      _id: trade.friendshipId,
      status: 'ACTIVE',
    }).session(session);
    if (trade.expiresAt <= new Date() || !active)
      await closeOffer(trade, active ? 'EXPIRED' : 'CANCELLED', session);
  });
const settleExpiredTrades = async (userId = null) => {
  const trades = userId
    ? await CardTrade.find({
        status: 'PENDING',
        $or: [{ senderId: userId }, { recipientId: userId }],
      })
        .select('_id')
        .lean()
    : await CardTrade.aggregate([
        { $match: { status: 'PENDING' } },
        {
          $lookup: {
            from: 'friendships',
            localField: 'friendshipId',
            foreignField: '_id',
            as: 'contract',
          },
        },
        {
          $match: {
            $or: [
              { expiresAt: { $lte: new Date() } },
              { 'contract.0.status': { $ne: 'ACTIVE' } },
            ],
          },
        },
        { $sort: { expiresAt: 1 } },
        { $limit: 100 },
        { $project: { _id: 1 } },
      ]);
  for (const trade of trades) await settleStaleOffer(trade._id);
};
const participantContract = async (friendshipId, actorId, session) => {
  if (!mongoose.isValidObjectId(friendshipId))
    fail(404, 'Accepted contract not found');
  const friendship = await Friendship.findOne({
    _id: friendshipId,
    status: 'ACTIVE',
    $or: [{ user1: actorId }, { user2: actorId }],
  }).session(session);
  if (!friendship) fail(404, 'Trade with an accepted friend');
  const recipientId =
    id(friendship.user1) === id(actorId) ? friendship.user2 : friendship.user1;
  const people = await User.find({ _id: { $in: [actorId, recipientId] } })
    .select('_id displayName isTestAccount testOwnerId')
    .session(session);
  if (
    people.length !== 2 ||
    Boolean(people[0].isTestAccount) !== Boolean(people[1].isTestAccount) ||
    (people[0].isTestAccount &&
      id(people[0].testOwnerId) !== id(people[1].testOwnerId))
  )
    fail(404, 'Trade partner not found');
  return {
    friendship,
    recipientId,
    actor: people.find((person) => id(person) === id(actorId)),
  };
};
const tradeNotification = async (trade, actorId, status, session) => {
  const recipientId =
    id(actorId) === id(trade.senderId) ? trade.recipientId : trade.senderId;
  const actor = await User.findById(actorId)
    .select('displayName')
    .session(session);
  await Notification.create(
    [
      {
        toUserId: recipientId,
        fromUserId: actorId,
        friendshipId: trade.friendshipId,
        type: 'CARD_TRADE',
        title:
          status === 'PENDING'
            ? 'Card offer'
            : 'Card trade ' + status.toLowerCase(),
        message: `${actor?.displayName || 'Your friend'} ${status === 'PENDING' ? 'offered' : status.toLowerCase()} ${CARD_CATALOG[trade.offeredCardId].name} for ${CARD_CATALOG[trade.requestedCardId].name}.`,
        cardTradeId: trade._id,
      },
    ],
    { session },
  );
};
const createOffer = async (actorId, body) => {
  const clientId = retryKey(body.clientId);
  const offered = String(body.offeredCardId || '');
  const requested = String(body.requestedCardId || '');
  if (
    !CARD_CATALOG[offered] ||
    !CARD_CATALOG[requested] ||
    offered === requested
  )
    fail(400, 'Choose two different cards');
  await settleExpiredTrades(actorId);
  try {
    return await inTransaction(async (session) => {
      const duplicate = await CardTrade.findOne({
        senderId: actorId,
        clientId,
      }).session(session);
      if (duplicate) return duplicate;
      const { friendship, recipientId } = await participantContract(
        body.friendshipId,
        actorId,
        session,
      );
      let previous = null;
      if (body.counterOf) {
        if (!mongoose.isValidObjectId(body.counterOf))
          fail(400, 'Invalid offer');
        previous = await CardTrade.findOne({
          _id: body.counterOf,
          recipientId: actorId,
          friendshipId: friendship._id,
          status: 'PENDING',
          expiresAt: { $gt: new Date() },
        }).session(session);
        if (!previous) fail(409, 'That offer has already changed');
        await closeOffer(previous, 'COUNTERED', session);
      }
      if (
        (await CardTrade.countDocuments({
          senderId: actorId,
          status: 'PENDING',
        }).session(session)) >= 10
      )
        fail(400, 'Finish or cancel an offer before making another');
      if (!(await takeCard(actorId, offered, session)))
        fail(
          409,
          'That card is no longer available. It may be used or reserved.',
        );
      const [trade] = await CardTrade.create(
        [
          {
            senderId: actorId,
            recipientId,
            friendshipId: friendship._id,
            offeredCardId: offered,
            requestedCardId: requested,
            clientId,
            expiresAt: new Date(Date.now() + 7 * 86400000),
            ...(previous ? { counterOf: previous._id } : {}),
          },
        ],
        { session },
      );
      if (previous) {
        previous.counterTradeId = trade._id;
        await previous.save({ session });
      }
      await tradeNotification(trade, actorId, 'PENDING', session);
      return trade;
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await CardTrade.findOne({
        senderId: actorId,
        clientId,
      });
      if (duplicate) return duplicate;
      fail(409, 'You already have this offer open with that friend');
    }
    throw error;
  }
};
const respondToOffer = async (actorId, tradeId, action) => {
  if (!mongoose.isValidObjectId(tradeId)) fail(404, 'Offer not found');
  if (!['ACCEPT', 'DECLINE', 'CANCEL'].includes(action))
    fail(400, 'Choose accept, decline or cancel');
  const owned = await CardTrade.exists({
    _id: tradeId,
    $or: [{ senderId: actorId }, { recipientId: actorId }],
  });
  if (!owned) fail(404, 'Offer not found');
  await settleStaleOffer(tradeId);
  return inTransaction(async (session) => {
    const trade = await CardTrade.findById(tradeId).session(session);
    const authorized =
      action === 'CANCEL'
        ? id(trade.senderId) === id(actorId)
        : id(trade.recipientId) === id(actorId);
    if (!authorized) fail(403, 'Only the other person can answer this offer');
    const terminal = {
      ACCEPT: 'ACCEPTED',
      DECLINE: 'DECLINED',
      CANCEL: 'CANCELLED',
    }[action];
    if (trade.status === terminal) return trade;
    if (trade.status !== 'PENDING')
      fail(409, `This offer is ${trade.status.toLowerCase()}`);
    if (action !== 'ACCEPT') await closeOffer(trade, terminal, session);
    else {
      await participantContract(trade.friendshipId, actorId, session);
      if (
        !(await takeCard(
          actorId,
          trade.requestedCardId,
          session,
          trade.offeredCardId,
        ))
      )
        fail(
          409,
          'You no longer have the requested card. Counter or decline instead.',
        );
      const sender = await User.updateOne(
        { _id: trade.senderId },
        {
          $push: { inventory: trade.requestedCardId },
          $addToSet: { cardDiscoveries: trade.requestedCardId },
        },
        { session },
      );
      if (!sender.matchedCount)
        fail(409, 'Your trade partner is no longer available');
      trade.status = 'ACCEPTED';
      trade.settledAt = new Date();
      await trade.save({ session });
      await ContractEvent.create(
        [
          {
            friendshipId: trade.friendshipId,
            userId: actorId,
            type: 'CARD_TRADE_ACCEPTED',
            metadata: {
              offeredCardId: trade.offeredCardId,
              requestedCardId: trade.requestedCardId,
            },
          },
        ],
        { session },
      );
    }
    await tradeNotification(trade, actorId, terminal, session);
    return trade;
  });
};
const collectionSnapshot = async (actorId) => {
  await settleExpiredTrades(actorId);
  const participant = {
    $or: [{ senderId: actorId }, { recipientId: actorId }],
  };
  const populate = (query) =>
    query
      .populate('senderId', 'displayName username avatar')
      .populate('recipientId', 'displayName username avatar')
      .lean();
  const [user, openTrades, history, friendships] = await Promise.all([
    User.findById(actorId)
      .select('inventory cardDiscoveries auraBalance')
      .lean(),
    populate(
      CardTrade.find({ ...participant, status: 'PENDING' }).sort({
        createdAt: -1,
      }),
    ),
    populate(
      CardTrade.find({ ...participant, status: { $ne: 'PENDING' } })
        .sort({ createdAt: -1 })
        .limit(40),
    ),
    Friendship.find({
      status: 'ACTIVE',
      $or: [{ user1: actorId }, { user2: actorId }],
    })
      .populate('user1', 'displayName username avatar')
      .populate('user2', 'displayName username avatar')
      .lean(),
  ]);
  if (!user) fail(404, 'Account not found');
  const trades = [...openTrades, ...history];
  const counts = {};
  const reserved = {};
  for (const cardId of user.inventory || [])
    counts[cardId] = (counts[cardId] || 0) + 1;
  for (const trade of trades)
    if (trade.status === 'PENDING' && id(trade.senderId) === id(actorId))
      reserved[trade.offeredCardId] = (reserved[trade.offeredCardId] || 0) + 1;
  const discovered = new Set([
    ...(user.cardDiscoveries || []),
    ...Object.keys(counts),
    ...Object.keys(reserved),
  ]);
  return {
    balance: Number(user.auraBalance) || 0,
    cards: Object.values(CARD_CATALOG).map((card) => ({
      ...card,
      owned: counts[card.id] || 0,
      reserved: reserved[card.id] || 0,
      discovered: discovered.has(card.id),
    })),
    partners: friendships.map((friendship) => ({
      friendshipId: id(friendship),
      contractKey: publicKey(friendship._id, 'contract'),
      ...personView(
        id(friendship.user1) === id(actorId)
          ? friendship.user2
          : friendship.user1,
      ),
    })),
    trades: trades.map((trade) => ({
      id: id(trade),
      mine: id(trade.senderId) === id(actorId),
      friendshipId: id(trade.friendshipId),
      partner: personView(
        id(trade.senderId) === id(actorId) ? trade.recipientId : trade.senderId,
      ),
      offeredCardId: trade.offeredCardId,
      requestedCardId: trade.requestedCardId,
      status: trade.status,
      createdAt: trade.createdAt,
      expiresAt: trade.expiresAt,
      counterTradeId: trade.counterTradeId ? id(trade.counterTradeId) : null,
    })),
  };
};
module.exports = {
  createOffer,
  respondToOffer,
  collectionSnapshot,
  settleExpiredTrades,
  retryKey,
  inTransaction,
};
