const mongoose = require('mongoose');

// One room per accepted friendship. The built-in _id constraint serializes
// rounds without transactions or an additional production index build.
const schema = new mongoose.Schema({
  revision: { type: Number, default: 0 },
  state: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  noticeQueue: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('DuelRoom', schema);
