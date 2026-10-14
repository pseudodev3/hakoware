const mongoose = require('mongoose');
// Deterministic pair ID uses Mongo's built-in unique index. No index-readiness gate.
const schema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  revision: { type: Number, default: 0 },
  status: { type: String, enum: ['NONE', 'PENDING', 'CONNECTED', 'DECLINED'], default: 'NONE' },
  requestedBy: { type: String, default: null },
  requestedAt: { type: Date, default: null },
  blockedBy: { type: [String], default: [], select: false },
  sequence: { type: Number, default: 0 },
  receipts: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  outbox: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
}, { timestamps: true });
schema.index({ participants: 1, updatedAt: -1 });
module.exports = mongoose.model('SocialConnection', schema);
