const mongoose = require('mongoose');

const VoiceNoteSchema = new mongoose.Schema({
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: String,
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filePath: { type: String, required: true },
  storageKey: { type: String, default: null },
  duration: Number,
  status: { type: String, enum: ['PENDING', 'COMMITTED'], default: 'PENDING', index: true },
  expiresAt: { type: Date, default: null, index: true },
  listened: { type: Boolean, default: false },
  listenedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

VoiceNoteSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('VoiceNote', VoiceNoteSchema);
