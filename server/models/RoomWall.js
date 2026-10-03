const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    scopeKey: { type: String, required: true },
    weekKey: { type: String, required: true },
    revision: { type: Number, default: 0 },
    pieces: { type: [Object], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ scopeKey: 1, weekKey: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('RoomWall', schema);
