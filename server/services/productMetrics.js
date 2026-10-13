const { createHash } = require('node:crypto');
const User = require('../models/User');
const GrowthEvent = require('../models/GrowthEvent');
const ContractEvent = require('../models/ContractEvent');
const CosmeticOrder = require('../models/CosmeticOrder');
const { exponent } = require('./stripeCheckout');
const catalog = require('../config/cosmetics.json');
const DAY = 86400000;
const id = value => String(value?._id || value);
const dayKey = value => new Date(value).toISOString().slice(0, 10);
const eventId = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const quiet = async operation => {
  try { return await operation(); }
  catch (error) { console.error('Product measurement pending:', error.message); return null; }
};
const recordVisit = (userId, now = new Date()) => quiet(() => User.updateOne({ _id: userId, isTestAccount: { $ne: true } }, [{ $set: {
  'productActivity.firstSeenAt': { $ifNull: ['$productActivity.firstSeenAt', now] },
  'productActivity.lastSeenAt': { $max: [{ $ifNull: ['$productActivity.lastSeenAt', now] }, now] },
  'productActivity.activeDays': { $setUnion: [{ $filter: { input: { $ifNull: ['$productActivity.activeDays', []] }, as: 'day', cond: { $gte: ['$$day', dayKey(now.getTime() - 34 * DAY)] } } }, [dayKey(now)]] }
} }], { updatePipeline: true }));
const recordShopEvent = async (userId, type, packId = null, now = new Date()) => {
  if (!['SHOP_VIEW', 'SHOP_PREVIEW'].includes(type) || type === 'SHOP_PREVIEW' && !catalog.packs.some(pack => pack.id === packId) || type === 'SHOP_VIEW' && packId !== null) throw Object.assign(new Error('Choose a valid shop event'), { status: 400 });
  return quiet(async () => {
    if (!await User.exists({ _id: userId, isTestAccount: { $ne: true } })) return false;
    const _id = eventId(`shop:${userId}:${type}:${packId || 'all'}:${dayKey(now)}`);
    try { await GrowthEvent.updateOne({ _id }, { $setOnInsert: { userId, type, source: packId || 'SHOP', metadata: {}, createdAt: now } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000 || !await GrowthEvent.exists({ _id })) throw error; }
    return true;
  });
};
const recordMutualActivation = (friendship, now = new Date()) => quiet(async () => {
  if (friendship.isTestData || friendship.season?.number !== 1 || !friendship.season?.startedAt) return;
  const users = [friendship.user1?._id || friendship.user1, friendship.user2?._id || friendship.user2];
  if (await User.countDocuments({ _id: { $in: users }, isTestAccount: { $ne: true } }) !== 2) return;
  const earliest = await ContractEvent.aggregate([
    { $match: { friendshipId: friendship._id, userId: { $in: users }, type: { $in: ['CHECKIN', 'VOICE_CHECKIN'] }, createdAt: { $gte: new Date(friendship.season.startedAt), $lte: now } } },
    { $group: { _id: '$userId', at: { $min: '$createdAt' } } }
  ]);
  if (earliest.length !== 2) return;
  const completedAt = new Date(Math.max(...earliest.map(event => new Date(event.at).getTime())));
  await User.updateMany({ _id: { $in: users }, isTestAccount: { $ne: true } }, { $min: { 'productActivity.firstMutualAt': completedAt } });
});
const productSnapshot = async (now = new Date(), { duoUserIds = [], mutualUserIds = [] } = {}) => {
  const since = new Date(now.getTime() - 28 * DAY), today = dayKey(now);
  const [users, events, sales] = await Promise.all([
    User.find({ isTestAccount: { $ne: true } }).select('_id createdAt +productActivity +cosmeticWishlist').lean(),
    GrowthEvent.find({ type: { $in: ['SHOP_VIEW', 'SHOP_PREVIEW', 'CHECKOUT_STARTED', 'COSMETIC_PAID'] }, createdAt: { $gte: since, $lte: now } }).select('userId type source').lean(),
    CosmeticOrder.aggregate([{ $match: { status: { $in: ['PAID', 'DELIVERED'] }, paidAt: { $gte: since, $lte: now } } }, { $group: { _id: '$currency', amount: { $sum: '$paidTotal' }, orders: { $sum: 1 } } }])
  ]);
  const ids = new Set(users.map(id)), realEvents = events.filter(event => ids.has(id(event.userId)));
  const countUsers = type => new Set(realEvents.filter(event => event.type === type).map(event => id(event.userId))).size;
  const previews = new Set(realEvents.filter(event => event.type === 'SHOP_PREVIEW').map(event => id(event.userId)));
  const buyers = new Set(realEvents.filter(event => event.type === 'COSMETIC_PAID' && previews.has(id(event.userId))).map(event => id(event.userId)));
  const retention = offset => {
    let eligible = 0, returned = 0;
    for (const user of users) {
      const first = user.productActivity?.firstSeenAt;
      if (!first || new Date(first) < since || new Date(first) > now) continue;
      const targetDay = dayKey(new Date(dayKey(first)).getTime() + offset * DAY);
      if (targetDay >= today) continue;
      eligible += 1;
      if (user.productActivity.activeDays?.includes(targetDay)) returned += 1;
    }
    return { eligible, returned, rate: eligible ? Math.round(returned / eligible * 100) : null };
  };
  return {
    windowDays: 28, dayTimezone: 'UTC',
    activation: { signups: users.length, usersWithFirstDuo: new Set(duoUserIds.map(id).filter(value => ids.has(value))).size, usersWithFirstMutual: new Set([...mutualUserIds.map(id).filter(value => ids.has(value)), ...users.filter(user => user.productActivity?.firstMutualAt && new Date(user.productActivity.firstMutualAt) <= now).map(id)]).size },
    retention: { basis: 'first recorded visit', day1: retention(1), day7: retention(7), active7d: users.filter(user => user.productActivity?.activeDays?.some(day => day >= dayKey(now.getTime() - 6 * DAY) && day <= today)).length },
    shop: { visitors: countUsers('SHOP_VIEW'), previewers: countUsers('SHOP_PREVIEW'), checkouts: countUsers('CHECKOUT_STARTED'), buyers: countUsers('COSMETIC_PAID'), previewToPurchaseRate: previews.size ? Math.round(buyers.size / previews.size * 100) : null,
      grossPaidTotals: sales.map(sale => ({ currency: sale._id, amount: sale.amount, orders: sale.orders, exponent: exponent(sale._id) })),
      savedCollections: catalog.packs.map(pack => ({ id: pack.id, name: pack.name, saved: users.filter(user => user.cosmeticWishlist?.includes(pack.id)).length })) }
  };
};
module.exports = { recordVisit, recordShopEvent, recordMutualActivation, productSnapshot, eventId, quiet };
