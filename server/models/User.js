const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // For custom Auth
  avatar: { type: String, default: null },
  auraScore: { type: Number, default: 850 },
  defaultLimit: { type: Number, default: 7 },
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
