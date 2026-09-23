const mongoose = require('mongoose');

const ContractReactionSchema = new mongoose.Schema({
  friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true, index: true },
  checkinEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractEvent', required: true, index: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reaction: { type: String, enum: ['💀', '🤝', '👀', '😭'], required: true }
}, { timestamps: true });

ContractReactionSchema.index({ checkinEventId: 1, fromUserId: 1 }, { unique: true });
ContractReactionSchema.index({ friendshipId: 1, createdAt: -1 });

module.exports = mongoose.model('ContractReaction', ContractReactionSchema);
