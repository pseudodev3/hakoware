const { randomUUID } = require('node:crypto');
const User = require('../models/User');
const CardPurchase = require('../models/CardPurchase');
const AuraTransaction = require('../models/AuraTransaction');
const { CARD_CATALOG } = require('./cardCatalog');
const { retryKey } = require('./cardTrading');

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const projection = { auraBalance: 1, inventory: 1, cardPurchaseReceipts: 1 };

const upsertOnce = async (Model, filter, fields) => {
  try {
    await Model.updateOne(filter, { $setOnInsert: fields }, { upsert: true });
  } catch (error) {
    // Concurrent journalers can both see an absent entry. Only the index winner writes.
    if (error.code !== 11000 || !await Model.exists(filter)) throw error;
  }
};

const journalPurchase = async (userId, receipt) => {
  await upsertOnce(CardPurchase, { userId, clientId: receipt.clientId }, {
    cardId: receipt.cardId, cost: receipt.cost, createdAt: receipt.createdAt,
  });
  await upsertOnce(AuraTransaction, { idempotencyKey: `card-purchase:${userId}:${receipt.clientId}` }, {
    userId, amount: -receipt.cost, type: 'MARKETPLACE_PURCHASE',
    description: `Purchased ${CARD_CATALOG[receipt.cardId]?.name || receipt.cardId}`,
    createdAt: receipt.createdAt,
  });
  await User.updateOne({ _id: userId }, {
    $set: { 'cardPurchaseReceipts.$[receipt].journaled': true },
  }, { arrayFilters: [{ 'receipt.clientId': receipt.clientId }] });
};

const purchaseCard = async (userId, body) => {
  const card = CARD_CATALOG[String(body.cardId || '').toUpperCase()];
  if (!card) fail(400, 'Unknown card');
  const clientId = body.clientId ? retryKey(body.clientId) : randomUUID();
  // Honor receipts written by the previous transaction-based implementation too.
  const legacy = await CardPurchase.findOne({ userId, clientId }).lean();
  if (legacy && legacy.cardId !== card.id) fail(409, 'This purchase already belongs to another card. Reopen the card to buy a copy.');
  let user = await User.findById(userId).select(projection);
  if (!user) fail(404, 'User not found');
  let receipt = user.cardPurchaseReceipts.find((item) => item.clientId === clientId);
  if (!receipt && !legacy) {
    // Prior successful purchases remain replayable, including unfinished journals.
    // Only new purchases are blocked; owned inventory and old receipts stay intact.
    if (!card.purchasable) fail(410, 'This collectible is no longer sold. Your owned copies stay in your collection and can still be traded.');
    const committed = await User.findOneAndUpdate({
      _id: userId, auraBalance: { $gte: card.cost },
      'cardPurchaseReceipts.clientId': { $ne: clientId },
    }, {
      $inc: { auraBalance: -card.cost },
      $push: {
        inventory: card.id,
        cardPurchaseReceipts: { clientId, cardId: card.id, cost: card.cost, createdAt: new Date(), journaled: false },
      },
      $addToSet: { cardDiscoveries: card.id },
    }, { returnDocument: 'after' }).select(projection);
    // A concurrent retry may have won even if this request saw an empty receipt list.
    user = committed || await User.findById(userId).select(projection);
    if (!user) fail(404, 'User not found');
    receipt = user.cardPurchaseReceipts.find((item) => item.clientId === clientId);
    if (!receipt) fail(400, `You need ${card.cost} Aura to buy this card.`);
  }
  if (receipt && receipt.cardId !== card.id) fail(409, 'This purchase already belongs to another card. Reopen the card to buy a copy.');
  if (receipt && !receipt.journaled) {
    // Delivery is already committed. A ledger outage must not report a failed purchase
    // or debit again; the worker (or the same retry key) finishes the audit later.
    await journalPurchase(userId, receipt).catch((error) => console.error('Card purchase journal pending:', error.message));
  }
  return { success: true, balance: user.auraBalance, inventory: user.inventory, card };
};

const reconcileCardPurchases = async () => {
  const people = await User.find({ 'cardPurchaseReceipts.journaled': false })
    .select({ _id: 1, cardPurchaseReceipts: 1 }).limit(50).lean();
  for (const person of people) {
    for (const receipt of person.cardPurchaseReceipts.filter((item) => !item.journaled).slice(0, 20)) {
      await journalPurchase(person._id, receipt);
    }
  }
};

module.exports = { purchaseCard, reconcileCardPurchases };
