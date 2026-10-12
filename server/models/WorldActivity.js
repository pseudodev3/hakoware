const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const schema = new mongoose.Schema({
  publicId: { type: String, default: () => randomBytes(12).toString('hex'), unique: true },
  sourceEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractEvent', unique: true, select: false },
  scopeKey: { type: String, required: true, select: false },
  type: { type: String, enum: ['SIGNAL_FLARE', 'DUO_LEVEL_UP', 'SEASON_COMPLETED', 'BOUNTY_REWARD'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, select: false },
  value: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
schema.index({ scopeKey: 1, createdAt: -1, _id: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
module.exports = mongoose.model('WorldActivity', schema);
