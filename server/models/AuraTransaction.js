const mongoose = require('mongoose');

const AuraTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true }, // positive for earn, negative for spend
  type: { type: String, required: true }, // CHECKIN, ACHIEVEMENT, BOUNTY, BAILOUT, etc.
  description: { type: String, required: true },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuraTransaction', AuraTransactionSchema);
