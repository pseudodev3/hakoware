const mongoose = require('mongoose');

const PerspectiveSchema = new mongoose.Schema({
  baseDebt: { type: Number, default: 0 },
  limit: { type: Number, default: 7 },
  lastInteraction: { type: Date, default: Date.now },
  wasBankrupt: { type: Boolean, default: false },
  bankruptAt: { type: Date, default: null },
  calculatedDebt: { type: Number, default: 0 },
  calculatedAt: { type: Date, default: Date.now },
  daysMissed: { type: Number, default: 0 },
  isBankrupt: { type: Boolean, default: false },
  isInWarningZone: { type: Boolean, default: false },
  daysUntilBankrupt: { type: Number, default: 7 }
});

const FriendshipSchema = new mongoose.Schema({
  user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user1DisplayName: String,
  user2DisplayName: String,
  streak: { type: Number, default: 0 },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'BLOCKED'], default: 'PENDING' },
  user1Perspective: { type: PerspectiveSchema, default: () => ({}) },
  user2Perspective: { type: PerspectiveSchema, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure unique friendship between two users regardless of order
FriendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', FriendshipSchema);
