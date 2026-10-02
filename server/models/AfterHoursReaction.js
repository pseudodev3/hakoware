const mongoose = require('mongoose');

const AfterHoursReactionSchema = new mongoose.Schema({
  scopeKey: { type: String, required: true, index: true },
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'AfterHoursActivity', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reaction: { type: String, enum: ['💀', '👀', '😭', '🤝'], required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

AfterHoursReactionSchema.index({ activityId: 1, userId: 1 }, { unique: true });
AfterHoursReactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('AfterHoursReaction', AfterHoursReactionSchema);
