const mongoose = require('mongoose');

const AfterHoursVoteSchema = new mongoose.Schema({
  scopeKey: { type: String, required: true, index: true },
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'AfterHoursActivity', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vote: { type: String, enum: ['REAL', 'NONSENSE'], required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

AfterHoursVoteSchema.index({ activityId: 1, userId: 1 }, { unique: true });
AfterHoursVoteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('AfterHoursVote', AfterHoursVoteSchema);
