const mongoose = require('mongoose');

const UserAchievementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  unlockedAchievements: [{
    id: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now }
  }],
  totalPoints: { type: Number, default: 0 },
  stats: {
    totalBankruptcies: { type: Number, default: 0 },
    highestDebt: { type: Number, default: 0 },
    maxCleanStreak: { type: Number, default: 0 },
    bailoutsGiven: { type: Number, default: 0 },
    bailoutsReceived: { type: Number, default: 0 },
    totalCheckins: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    totalFriends: { type: Number, default: 0 },
    mercyGranted: { type: Number, default: 0 },
    mercyGiven: { type: Number, default: 0 },
    nightCheckins: { type: Number, default: 0 },
    perfectWeeks: { type: Number, default: 0 },
    phoenixRises: { type: Number, default: 0 }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserAchievement', UserAchievementSchema);
