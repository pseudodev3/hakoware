const mongoose = require('mongoose');

const MomentResponseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: { type: String, required: true, maxlength: 80 },
  answeredAt: { type: Date, default: Date.now }
}, { _id: false });

const ContractMomentSchema = new mongoose.Schema({
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true, index: true },
  type: { type: String, enum: ['HOT_SEAT'], required: true, index: true },
  status: { type: String, enum: ['BREWING', 'OPEN', 'RESOLVED', 'EXPIRED'], default: 'BREWING', index: true },
  startedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  promptId: { type: String, required: true },
  promptText: { type: String, required: true, maxlength: 240 },
  options: [{ type: String, maxlength: 80 }],
  responses: { type: [MomentResponseSchema], default: [] },
  unlockAt: { type: Date, required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  resolvedAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

ContractMomentSchema.index({ friendshipId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ContractMoment', ContractMomentSchema);
