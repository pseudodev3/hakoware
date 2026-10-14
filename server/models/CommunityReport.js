const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: ['SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER'], required: true },
  note: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['OPEN', 'REVIEWED'], default: 'OPEN' },
  isTestReport: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('CommunityReport', schema);
