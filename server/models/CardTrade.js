const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    friendshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Friendship',
      required: true,
    },
    offeredCardId: { type: String, required: true },
    requestedCardId: { type: String, required: true },
    clientId: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'PENDING',
        'ACCEPTED',
        'DECLINED',
        'CANCELLED',
        'EXPIRED',
        'COUNTERED',
      ],
      default: 'PENDING',
    },
    expiresAt: { type: Date, required: true },
    settledAt: Date,
    counterOf: { type: mongoose.Schema.Types.ObjectId, ref: 'CardTrade' },
    counterTradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'CardTrade' },
  },
  { timestamps: true },
);
schema.index({ senderId: 1, clientId: 1 }, { unique: true });
schema.index(
  { senderId: 1, recipientId: 1, offeredCardId: 1, requestedCardId: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
);
schema.index({ status: 1, expiresAt: 1 });
schema.index({ recipientId: 1, createdAt: -1 });
module.exports = mongoose.model('CardTrade', schema);
