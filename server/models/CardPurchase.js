const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientId: { type: String, required: true },
    cardId: { type: String, required: true },
    cost: { type: Number, required: true },
  },
  { timestamps: true },
);
schema.index({ userId: 1, clientId: 1 }, { unique: true });
module.exports = mongoose.model('CardPurchase', schema);
