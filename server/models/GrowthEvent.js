const mongoose = require('mongoose');

const GrowthEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  type: {
    type: String,
    enum: ['SHARE'],
    required: true,
    index: true
  },
  source: { type: String, required: true, trim: true, maxlength: 48, index: true },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});

GrowthEventSchema.index({ type: 1, source: 1, createdAt: -1 });

module.exports = mongoose.model('GrowthEvent', GrowthEventSchema);
