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
}, { _id: false });

const SeasonSchema = new mongoose.Schema({
  number: { type: Number, default: 1, min: 1 },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'COMPLETE'], default: 'PENDING' },
  lengthDays: { type: Number, default: 30, min: 1, max: 365 },
  startedAt: { type: Date, default: null },
  endsAt: { type: Date, default: null }
}, { _id: false });

const ChaosEventSchema = new mongoose.Schema({
  eventId: { type: String, default: null },
  type: { type: String, default: null },
  name: { type: String, default: null },
  description: { type: String, default: null },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const ChaosSchema = new mongoose.Schema({
  level: { type: Number, default: 0, min: 0, max: 5 },
  nextEventAt: { type: Date, default: null },
  activeEvent: { type: ChaosEventSchema, default: null },
  wantedUntil: { type: Date, default: null },
  lastConsequence: { type: String, default: null }
}, { _id: false });

const GrudgeSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  claimantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  victimId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimantName: { type: String, default: null },
  victimName: { type: String, default: null },
  createdAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  revengeUsed: { type: Boolean, default: false },
  originalClaimAmount: { type: Number, default: 0, min: 0 }
}, { _id: false });

const ClaimStateSchema = new mongoose.Schema({
  user1WindowKey: { type: Date, default: null },
  user2WindowKey: { type: Date, default: null },
  user1LastClaimedAt: { type: Date, default: null },
  user2LastClaimedAt: { type: Date, default: null },
  user1LastFlareAt: { type: Date, default: null },
  user2LastFlareAt: { type: Date, default: null }
}, { _id: false });

const FriendshipSchema = new mongoose.Schema({
  user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user1DisplayName: String,
  user2DisplayName: String,
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'BLOCKED'], default: 'PENDING' },
  templateId: { type: String, default: 'DONT_GHOST', index: true },
  duoXP: { type: Number, default: 0, min: 0 },
  duoLevel: { type: Number, default: 1, min: 1 },
  duoTitle: { type: String, default: 'New Contract' },
  season: { type: SeasonSchema, default: () => ({}) },
  chaos: { type: ChaosSchema, default: () => ({}) },
  grudge: { type: GrudgeSchema, default: () => ({}) },
  claimState: { type: ClaimStateSchema, default: () => ({}) },
  user1Perspective: { type: PerspectiveSchema, default: () => ({}) },
  user2Perspective: { type: PerspectiveSchema, default: () => ({}) }
}, { timestamps: true });

FriendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', FriendshipSchema);
