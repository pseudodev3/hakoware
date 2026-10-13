const mongoose = require('mongoose');
const catalog = require('../config/cosmetics.json');
const schema = new mongoose.Schema({
  _id: String,
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', default: null },
  packId: { type: String, enum: catalog.packs.map(pack => pack.id), required: true },
  grants: { type: [String], required: true, select: false },
  clientId: { type: String, required: true, select: false },
  priceId: { type: String, required: true, select: false },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  status: { type: String, enum: ['PREPARING', 'OPEN', 'PAID', 'DELIVERED', 'EXPIRED', 'FAILED'], default: 'PREPARING' },
  stripeSessionId: { type: String, default: null, select: false },
  checkoutUrl: { type: String, default: null, select: false },
  checkoutExpiresAt: { type: Date, required: true },
  taxEnabled: { type: Boolean, default: false },
  paidTotal: { type: Number, default: null },
  paidAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
// Primary keys provide retries and fulfillment without new secondary indexes.
module.exports = mongoose.model('CosmeticOrder', schema);
