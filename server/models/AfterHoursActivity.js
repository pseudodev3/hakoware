const crypto = require('crypto');
const mongoose = require('mongoose');

const AfterHoursActivitySchema = new mongoose.Schema({
  publicId: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(12).toString('hex')
  },
  uniqueKey: { type: String, unique: true, sparse: true },
  scopeKey: { type: String, required: true, index: true },
  roundKey: { type: String, required: true, index: true },
  type: { type: String, enum: ['ANSWER', 'CALLOUT', 'SHOUT', 'HOT_TAKE', 'CONFESSION', 'QUESTION', 'REPLY', 'CHALLENGE', 'CHALLENGE_JOIN'], required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  parentActivityId: { type: mongoose.Schema.Types.ObjectId, ref: 'AfterHoursActivity', default: null, index: true },
  promptId: { type: String, required: true },
  promptText: { type: String, required: true, maxlength: 240 },
  choice: { type: String, default: null, maxlength: 100 },
  text: { type: String, default: null, maxlength: 180 },
  anonymous: { type: Boolean, default: false },
  burnAmount: { type: Number, default: 0, min: 0, max: 25 },
  replyNotificationDelivered: { type: Boolean, default: false, select: false },
  replyNotificationLease: { type: new mongoose.Schema({ token: String, until: Date }, { _id: false }), default: undefined, select: false },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

AfterHoursActivitySchema.index({ scopeKey: 1, createdAt: -1 });
AfterHoursActivitySchema.index({ scopeKey: 1, roundKey: 1, type: 1 });
AfterHoursActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('AfterHoursActivity', AfterHoursActivitySchema);
