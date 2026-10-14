const mongoose = require('mongoose');

// A bounded queue per account scope. Its primary key and revision serialize pairing
// on standalone Mongo without transactions or a new secondary index build.
const schema = new mongoose.Schema({
  _id: String,
  revision: { type: Number, default: 0 },
  seats: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('OpenTableQueue', schema);
