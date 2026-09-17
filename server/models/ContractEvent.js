const mongoose = require('mongoose');

const ContractEventSchema = new mongoose.Schema({
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  type: { type: String, required: true, index: true },
  xp: { type: Number, default: 0 },
  aura: { type: Number, default: 0 },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});

ContractEventSchema.index({ friendshipId: 1, createdAt: -1 });

module.exports = mongoose.model('ContractEvent', ContractEventSchema);
