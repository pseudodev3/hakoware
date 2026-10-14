const User = require('../models/User');
const Friendship = require('../models/Friendship');
const ContractEvent = require('../models/ContractEvent');
const WorldActivity = require('../models/WorldActivity');
const { scopeFor } = require('./afterHours');
const TYPES = Object.freeze(['SIGNAL_FLARE', 'DUO_LEVEL_UP', 'SEASON_COMPLETED', 'BOUNTY_REWARD']);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const publishWorldEvent = async event => {
  if (!TYPES.includes(event.type) || !event.metadata?.worldEligible) return;
  if (new Date(event.createdAt) < new Date(Date.now() - 7 * 86400000)) {
    await ContractEvent.updateOne({ _id: event._id }, { $set: { 'metadata.worldPublished': true } });
    return;
  }
  const contract = await Friendship.findById(event.friendshipId).select('user1 user2 isTestData testOwnerId').lean();
  if (!contract) return;
  const users = await User.find({ _id: { $in: [contract.user1, contract.user2] } }).select('isTestAccount testOwnerId privacySettings').lean();
  if (users.length !== 2 || scopeFor(users[0]) !== scopeFor(users[1])) return;
  const actor = event.userId ? await User.findById(event.userId).select('isTestAccount testOwnerId privacySettings').lean() : null;
  const scopeKey = scopeFor(users[0]);
  if (actor && scopeFor(actor) !== scopeKey) return;
  // Duo identities and Flare recipients never enter the public projection.
  const actorId = event.type === 'SIGNAL_FLARE' ? actor?._id : event.type === 'BOUNTY_REWARD' && actor?.privacySettings?.optOutPublicBankruptcy !== true ? actor?._id : null;
  const value = event.type === 'DUO_LEVEL_UP' ? Number(event.metadata.level) || 1 : event.type === 'SEASON_COMPLETED' ? Number(event.metadata.season) || 1 : event.type === 'BOUNTY_REWARD' ? Number(event.aura) || 0 : null;
  const query = { sourceEventId: event._id };
  // _id already has MongoDB's unique primary index, even when the trial volume
  // cannot build secondary indexes. Older rows still match sourceEventId and
  // keep their existing _id and publicId; new rows deduplicate by the event ID.
  try { await WorldActivity.updateOne(query, { $setOnInsert: { _id: event._id, scopeKey, type: event.type, actorId, value, createdAt: event.createdAt } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000 || !await WorldActivity.exists(query)) throw error; }
  await ContractEvent.updateOne({ _id: event._id }, { $set: { 'metadata.worldPublished': true } });
};
let recovery = null;
const reconcileWorldActivity = async ({ prune = false } = {}) => {
  if (!recovery) recovery = (async () => {
    await require('./flareDelivery').reconcileFlareDelivery().catch(error => console.error('Signal Flare delivery pending:', error.message));
    const events = await ContractEvent.find({ type: { $in: TYPES }, 'metadata.worldEligible': true, 'metadata.worldPublished': { $ne: true } }).sort({ createdAt: 1 }).limit(100).lean();
    for (const event of events) await publishWorldEvent(event);
  })().finally(() => { recovery = null; });
  await recovery;
  // Keep the same retention window when the optional TTL index is unavailable.
  if (prune) await WorldActivity.deleteMany({ createdAt: { $lt: new Date(Date.now() - 7 * 86400000) } });
};
const worldFeed = async (userId, { before, limit = 20 } = {}) => {
  const user = await User.findById(userId).select({ isTestAccount: 1, testOwnerId: 1, createdAt: 1, lastWorldActivitySeenAt: 1 }).lean();
  if (!user) fail(404, 'Account not found');
  const size = Number(limit); if (!Number.isInteger(size) || size < 1 || size > 20) fail(400, 'Choose a valid page size');
  const since = new Date(Date.now() - 7 * 86400000);
  const seenSince = new Date(Math.max(since.getTime(), new Date(user.lastWorldActivitySeenAt || user.createdAt || since).getTime()));
  const scopeKey = scopeFor(user); const query = { scopeKey, createdAt: { $gte: since } };
  if (before) {
    if (typeof before !== 'string' || !/^[a-f0-9]{24}$/.test(before)) fail(400, 'Invalid activity page');
    const cursor = await WorldActivity.findOne({ publicId: before, scopeKey }).select('_id createdAt').lean();
    if (!cursor) fail(400, 'That activity page is unavailable');
    query.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
  }
  const [rows, unreadCount] = await Promise.all([
    WorldActivity.find(query).select('+actorId').sort({ createdAt: -1, _id: -1 }).limit(size + 1).populate('actorId', 'displayName username avatar avatarFrame privacySettings').lean(),
    WorldActivity.countDocuments({ scopeKey, createdAt: { $gt: seenSince } })
  ]);
  const page = rows.slice(0, size);
  const events = page.map(row => {
    const actor = row.type === 'SIGNAL_FLARE' || row.type === 'BOUNTY_REWARD' && row.actorId?.privacySettings?.optOutPublicBankruptcy !== true ? row.actorId : null;
    return { id: row.publicId, type: row.type, value: row.value, createdAt: row.createdAt, unread: new Date(row.createdAt) > seenSince, actor: actor ? { displayName: actor.displayName, username: actor.username || null, avatar: actor.avatar || null, avatarFrame: actor.avatarFrame || 'plain' } : null };
  });
  return { events, unreadCount, hasMore: rows.length > size, nextCursor: rows.length > size ? page.at(-1).publicId : null };
};
const markWorldRead = async (userId, ids) => {
  if (!Array.isArray(ids) || ids.length > 50 || ids.some(value => typeof value !== 'string' || !/^[a-f0-9]{24}$/.test(value))) fail(400, 'Choose valid visible activity');
  const user = await User.findById(userId).select('isTestAccount testOwnerId').lean();
  if (!user) fail(404, 'Account not found');
  const latest = await WorldActivity.findOne({ publicId: { $in: ids }, scopeKey: scopeFor(user) }).sort({ createdAt: -1 }).select('createdAt').lean();
  if (latest) await User.updateOne({ _id: userId }, { $max: { lastWorldActivitySeenAt: latest.createdAt } });
  return { success: true };
};
module.exports = { TYPES, publishWorldEvent, reconcileWorldActivity, worldFeed, markWorldRead };
