const mongoose = require('mongoose');

const VoiceNoteSchema = new mongoose.Schema({
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: String,
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filePath: { type: String, required: true }, // Path to the audio file on the server
  duration: Number,
  listened: { type: Boolean, default: false },
  listenedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VoiceNote', VoiceNoteSchema);
