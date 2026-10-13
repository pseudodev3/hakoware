const User = require('../models/User');
const Friendship = require('../models/Friendship');
const CardTrade = require('../models/CardTrade');
const { CARD_CATALOG } = require('./cardCatalog');
const { publicKey } = require('./clientViews');
const { createOffer, respondToOffer, settleExpiredTrades, retryKey } = require('./cardTradeEscrow');
const id = value => String(value?._id || value || '');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const personView = value => ({ displayName: value?.displayName || 'Your friend', username: value?.username || null, avatar: value?.avatar || null, avatarFrame: value?.avatarFrame || 'plain' });
const collectionSnapshot = async (actorId) => {
  await settleExpiredTrades(actorId);
  const participant = {
    $or: [{ senderId: actorId }, { recipientId: actorId }],
  };
  const populate = (query) =>
    query
      .select('+phase')
      .populate('senderId', 'displayName username avatar avatarFrame')
      .populate('recipientId', 'displayName username avatar avatarFrame')
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
      CardTrade.find({ ...participant, status: { $ne: 'PENDING' }, phase: { $ne: 'FAILED' } })
        .sort({ createdAt: -1 })
        .limit(40),
    ),
    Friendship.find({
      status: 'ACTIVE',
      $or: [{ user1: actorId }, { user2: actorId }],
    })
      .populate('user1', 'displayName username avatar avatarFrame')
      .populate('user2', 'displayName username avatar avatarFrame')
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
      processing: ['PREPARING', 'ACCEPTING', 'CLOSING'].includes(trade.phase),
      createdAt: trade.createdAt,
      expiresAt: trade.expiresAt,
      counterTradeId: trade.counterTradeId ? id(trade.counterTradeId) : null,
    })),
  };
};
module.exports = { createOffer, respondToOffer, collectionSnapshot, settleExpiredTrades, retryKey };
