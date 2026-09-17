const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 32 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  nenType: { type: String, enum: ['ENHANCER', 'TRANSMUTER', 'CONJURER', 'EMITTER', 'MANIPULATOR', 'SPECIALIST', null], default: null },
  inventory: [{ type: String }],
  auraScore: { type: Number, default: 850 },
  auraBalance: { type: Number, default: 0, min: 0 },
  welcomeAuraGranted: { type: Boolean, default: false },
  lastDailyAuraBonusKey: { type: String, default: null },
  defaultLimit: { type: Number, default: 7, min: 1, max: 30 },
  emailVerified: { type: Boolean, default: false },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    weeklySummary: { type: Boolean, default: true },
    bankruptcyWarnings: { type: Boolean, default: true }
  },
  privacySettings: {
    hideAuraScore: { type: Boolean, default: false },
    optOutLeaderboard: { type: Boolean, default: false },
    optOutPublicBankruptcy: { type: Boolean, default: false }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
