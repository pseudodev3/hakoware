const Friendship = require('../models/Friendship');
const User = require('../models/User');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const { createNotification } = require('./notificationDelivery');
const notifyRecipient = async (contract, receipt) => {
  const query = { toUserId: receipt.targetId, contractEventId: receipt.eventId };
  if (await Notification.exists(query)) return;
  const sender = await User.findById(receipt.senderId).select('displayName').lean();
  try {
    // The event ID gives each Flare one recipient notification using the
    // existing primary index. This also preserves older random-ID notices.
    await createNotification({ _id: receipt.eventId, ...query, fromUserId: receipt.senderId, friendshipId: contract._id, type: 'SIGNAL_FLARE', title: 'SIGNAL FLARE', message: `${sender?.displayName || 'Your friend'} sent a public Signal Flare. Your contract is waiting.` });
  } catch (error) { if (error.code !== 11000 || !await Notification.exists(query)) throw error; }
};
const reconcileFlareDelivery = async friendshipId => {
  const contracts = await Friendship.find({ ...(friendshipId ? { _id: friendshipId } : {}), 'flareReceipts.done': false }).select({ _id: 1, flareReceipts: 1 }).limit(50).lean();
  let pendingError;
  for (const contract of contracts) for (const receipt of contract.flareReceipts.filter(value => !value.done).slice(0, 20)) {
    try { await ContractEvent.updateOne({ _id: receipt.eventId }, { $setOnInsert: { friendshipId: contract._id, userId: receipt.senderId, type: 'SIGNAL_FLARE', createdAt: receipt.createdAt, metadata: { targetId: receipt.targetId, cooldownHours: 48, publicFlare: true, worldEligible: true } } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000 || !await ContractEvent.exists({ _id: receipt.eventId })) throw error; }
    const event = await ContractEvent.findById(receipt.eventId).lean();
    const deliveries = await Promise.allSettled([require('./worldActivity').publishWorldEvent(event), notifyRecipient(contract, receipt)]);
    const failure = deliveries.find(result => result.status === 'rejected');
    if (failure) { pendingError ||= failure.reason; continue; }
    await Friendship.updateOne({ _id: contract._id }, { $set: { 'flareReceipts.$[receipt].done': true } }, { arrayFilters: [{ 'receipt.eventId': receipt.eventId }] });
  }
  if (pendingError) throw pendingError;
};
module.exports = { reconcileFlareDelivery };
