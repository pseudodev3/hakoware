const mongoose = require('mongoose');

const PendingInviteSchema = new mongoose.Schema({
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  inviterName: { type: String, required: true },
  recipientEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
  templateId: { type: String, required: true, default: 'DONT_GHOST' },
  limit: { type: Number, required: true, min: 1, max: 30 },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }
}, { timestamps: true });

PendingInviteSchema.index({ inviterId: 1, recipientEmail: 1 }, { unique: true });
PendingInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingInvite', PendingInviteSchema);
