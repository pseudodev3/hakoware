const mongoose = require('mongoose');
const cosmeticCatalog = require('../config/cosmetics.json');

const UserSchema = new mongoose.Schema({
  displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 32 },
  username: { type: String, trim: true, minlength: 3, maxlength: 20, default: undefined },
  usernameNormalized: { type: String, trim: true, lowercase: true, unique: true, sparse: true, index: true, default: undefined },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  avatarStorageKey: { type: String, default: null },
  nenType: { type: String, enum: ['ENHANCER', 'TRANSMUTER', 'CONJURER', 'EMITTER', 'MANIPULATOR', 'SPECIALIST', null], default: null },
  inventory: [{ type: String }],
  cardDiscoveries: [{ type: String }],
  // Kept with the balance/inventory so a lost response can never charge twice.
  // Private durable receipts also repair the external ledger after an outage.
  cardPurchaseReceipts: {
    type: [new mongoose.Schema({
      clientId: { type: String, required: true },
      cardId: { type: String, required: true },
      cost: { type: Number, required: true },
      createdAt: { type: Date, required: true },
      journaled: { type: Boolean, default: false },
    }, { _id: false })],
    default: [],
    select: false,
  },
  auraBalance: { type: Number, default: 0, min: 0 },
  cardBack: { type: String, enum: require('../config/cardBacks.json').map(back => back.id), default: 'original' },
  gameRewardDays: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },
  cardTradeReceipts: { type: [new mongoose.Schema({ tradeId: mongoose.Schema.Types.ObjectId, side: { type: String, enum: ['SENDER', 'RECIPIENT'] }, cardId: String, pairKey: String, state: { type: String, enum: ['HELD', 'REFUNDED', 'DELIVERED'] }, createdAt: Date }, { _id: false })], default: [], select: false },
  avatarFrame: { type: String, enum: ['plain', 'linked', 'orbit', 'crown', ...cosmeticCatalog.frames.map(frame => frame.id)], default: 'plain' },
  cardFinish: { type: String, enum: cosmeticCatalog.finishes.map(finish => finish.id), default: 'classic' },
  profileDecoration: { type: String, enum: cosmeticCatalog.decorations.map(decoration => decoration.id), default: 'none' },
  cosmeticUnlocks: { type: [String], enum: [...new Set(cosmeticCatalog.packs.flatMap(pack => pack.grants))], default: [], select: false },
  cosmeticWishlist: { type: [String], enum: cosmeticCatalog.packs.map(pack => pack.id), default: [], select: false },
  cosmeticCheckoutHolds: { type: [new mongoose.Schema({ orderId: String, grants: [String] }, { _id: false })], default: [], select: false },
  cosmeticReceipts: { type: [new mongoose.Schema({ orderId: String, packId: String, buyerId: mongoose.Schema.Types.ObjectId, receivedAt: Date, seenAt: { type: Date, default: null } }, { _id: false })], default: [], select: false },
  productActivity: { type: new mongoose.Schema({ firstSeenAt: Date, lastSeenAt: Date, activeDays: [String], firstMutualAt: Date }, { _id: false }), default: () => ({}), select: false },
  earnedAvatarFrames: { type: [String], enum: ['plain', 'linked', 'orbit', 'crown'], default: ['plain'], select: false },
  showcase: { type: new mongoose.Schema({ favoriteCardId: { type: String, default: null }, featuredDuoId: { type: mongoose.Schema.Types.ObjectId, default: null } }, { _id: false }), default: () => ({}), select: false },
  auraBank: { type: new mongoose.Schema({ outstanding: { type: Number, default: 0, min: 0, max: 100 }, lastBorrowedAt: { type: Date, default: null }, creditLimit: { type: Number, enum: [25, 50, 100], default: 25 } }, { _id: false }), default: () => ({}), select: false },
  auraWalletReceipts: { type: [new mongoose.Schema({ key: String, kind: String, amount: Number, repaid: Number, type: String, description: String, metadata: { type: Object, default: {} }, createdAt: Date, journaled: { type: Boolean, default: false } }, { _id: false })], default: [], select: false },
  lastWorldActivitySeenAt: { type: Date, default: null, select: false },
  welcomeAuraGranted: { type: Boolean, default: false },
  lastDailyAuraBonusKey: { type: String, default: null },
  plusInterestAt: { type: Date, default: null },
  defaultLimit: { type: Number, default: 7, min: 1, max: 30 },
  emailVerified: { type: Boolean, default: false },
  authVersion: { type: Number, default: 0, min: 0 },
  isTestAccount: { type: Boolean, default: false, index: true },
  testOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    weeklySummary: { type: Boolean, default: true },
    bankruptcyWarnings: { type: Boolean, default: true }
  },
  privacySettings: {
    optOutPublicBankruptcy: { type: Boolean, default: false }
  },
  // Historical Discover data is retained for compatibility; it is no longer
  // displayed, editable through the API or used to authorize any social action.
  discovery: {
    enabled: { type: Boolean, default: false },
    bio: { type: String, default: '', maxlength: 160 },
    interests: { type: [String], default: [] },
    intent: { type: String, enum: ['games', 'conversation', 'accountability'], default: 'games' }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
