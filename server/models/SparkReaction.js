const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'SparkPost', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reaction: { type: String, enum: ['❤️', '😂', '👀', '🤝', '✨'], required: true }
}, { versionKey: false });
schema.index({ postId: 1, userId: 1 }, { unique: true });
module.exports = mongoose.model('SparkReaction', schema);
