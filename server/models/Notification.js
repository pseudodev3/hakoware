const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship' },
  voiceNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoiceNote' },
  afterHoursActivityId: { type: String, default: null, maxlength: 64 },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
