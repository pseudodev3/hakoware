const mongoose = require('mongoose');

const AfterHoursPresenceSchema = new mongoose.Schema({
  scopeKey: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

AfterHoursPresenceSchema.index({ scopeKey: 1, userId: 1 }, { unique: true });
AfterHoursPresenceSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('AfterHoursPresence', AfterHoursPresenceSchema);
