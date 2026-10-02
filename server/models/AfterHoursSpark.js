const mongoose = require('mongoose');

const AfterHoursSparkSchema = new mongoose.Schema({
  scopeKey: { type: String, required: true, index: true },
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'AfterHoursActivity', required: true, index: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, default: 1, min: 1, max: 1 },
  createdAt: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

AfterHoursSparkSchema.index({ activityId: 1, fromUserId: 1 }, { unique: true });
AfterHoursSparkSchema.index({ fromUserId: 1, createdAt: -1 });
AfterHoursSparkSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
AfterHoursSparkSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('AfterHoursSpark', AfterHoursSparkSchema);
