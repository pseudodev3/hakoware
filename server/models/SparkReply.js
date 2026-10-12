const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const schema = new mongoose.Schema({
  publicId: { type: String, default: () => randomBytes(12).toString('hex'), unique: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'SparkPost', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: String, required: true },
  text: { type: String, required: true, maxlength: 280 },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
schema.index({ postId: 1, authorId: 1, clientId: 1 }, { unique: true });
schema.index({ postId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('SparkReply', schema);
