const mongoose = require('mongoose');

const HuntAttemptSchema = new mongoose.Schema({
  hunterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hunterName: { type: String, required: true },
  bond: { type: Number, default: 0 },
  startedAt: { type: Date, required: true },
  pressureSentAt: { type: Date, default: null },
  pressurePreset: { type: String, default: null },
  endedAt: { type: Date, required: true },
  outcome: {
    type: String,
    enum: ['CLAIMED', 'TARGET_ESCAPED', 'HUNT_EXPIRED', 'NO_PRESSURE'],
    required: true
  },
  repDelta: { type: Number, default: 0 },
  creditedAt: { type: Date, default: null }
}, { _id: false });

const BountySchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetName: { type: String, required: true },
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true },
  amount: { type: Number, required: true },
  listingFee: { type: Number, default: 0, min: 0 },
  message: { type: String },
  status: {
    type: String,
    enum: ['ACTIVE', 'HUNTING', 'PRESSURE_SENT', 'CLAIMED', 'ESCAPED', 'EXPIRED'],
    default: 'ACTIVE'
  },
  hunterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  hunterName: { type: String, default: null },
  hunterBond: { type: Number, default: 0, min: 0 },
  huntStartedAt: { type: Date, default: null },
  huntExpiresAt: { type: Date, default: null },
  pressureSentAt: { type: Date, default: null },
  pressurePreset: { type: String, default: null },
  creditedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  attempts: { type: [HuntAttemptSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
}, { timestamps: true });

BountySchema.index({ status: 1, expiresAt: 1 });
BountySchema.index({ hunterId: 1, huntExpiresAt: 1 });
BountySchema.index({ 'attempts.hunterId': 1 });

module.exports = mongoose.model('Bounty', BountySchema);
