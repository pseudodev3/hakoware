const mongoose = require('mongoose');

const BountySchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetName: { type: String, required: true },
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true },
  amount: { type: Number, required: true },
  message: { type: String },
  status: { type: String, enum: ['ACTIVE', 'CLAIMED', 'EXPIRED'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(+new Date() + 7*24*60*60*1000) } // 7 days
}, { timestamps: true });

module.exports = mongoose.model('Bounty', BountySchema);
