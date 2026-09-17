const mongoose = require('mongoose');

const AuraTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  idempotencyKey: { type: String, unique: true, sparse: true },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuraTransaction', AuraTransactionSchema);
