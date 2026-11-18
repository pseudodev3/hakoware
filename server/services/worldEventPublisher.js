const User = require('../models/User');
const Friendship = require('../models/Friendship');
const ContractEvent = require('../models/ContractEvent');
const WorldActivity = require('../models/WorldActivity');
const { scopeFor } = require('./afterHours');

const TYPES = Object.freeze(['SIGNAL_FLARE', 'DUO_LEVEL_UP', 'SEASON_COMPLETED', 'BOUNTY_REWARD']);

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

module.exports = { TYPES, publishWorldEvent };
