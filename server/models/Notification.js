const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship' },
  contractEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractEvent' },
  cardTradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'CardTrade' },
  wallPieceId: String,
  wallWeekKey: String,
  voiceNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoiceNote' },
  afterHoursActivityId: { type: String, default: null, maxlength: 64 },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

NotificationSchema.index({ toUserId: 1, friendshipId: 1 }, { unique: true, partialFilterExpression: { type: 'CONTRACT_MESSAGE', read: false } });
NotificationSchema.index({ toUserId: 1, contractEventId: 1 }, { unique: true, partialFilterExpression: { contractEventId: { $type: 'objectId' } } });
NotificationSchema.index({ toUserId: 1, fromUserId: 1, wallPieceId: 1, wallWeekKey: 1 }, { unique: true, partialFilterExpression: { type: 'AFTER_HOURS_WALL' } });

module.exports = mongoose.model('Notification', NotificationSchema);
