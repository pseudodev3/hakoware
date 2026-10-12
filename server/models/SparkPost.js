const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const schema = new mongoose.Schema({
  publicId: { type: String, default: () => randomBytes(12).toString('hex'), unique: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scopeKey: { type: String, required: true },
  clientId: { type: String, required: true },
  text: { type: String, default: '', maxlength: 280 },
  photoStorageKey: { type: String, default: null, select: false },
  photoMime: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
schema.index({ authorId: 1, clientId: 1 }, { unique: true });
schema.index({ scopeKey: 1, authorId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('SparkPost', schema);
