const mongoose = require('mongoose');

// The share code is the primary key. Joining, starting and playing all compete
// on one revision; standalone MongoDB needs no secondary index or transaction.
const schema = new mongoose.Schema({
  _id: { type: String },
  members: { type: [String], required: true },
  hostId: { type: String, required: true },
  status: { type: String, enum: ['WAITING', 'ACTIVE', 'FINISHED', 'CANCELLED', 'EXPIRED'], default: 'WAITING' },
  presence: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },
  revision: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  state: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  rewardQueue: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  noticeQueue: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
}, { timestamps: true, minimize: false });
module.exports = mongoose.model('GroupTable', schema);
