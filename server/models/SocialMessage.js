const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderId: { type: String, required: true },
  sequence: { type: Number, required: true },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, required: true },
});
schema.index({ connectionId: 1, sequence: -1 });
module.exports = mongoose.model('SocialMessage', schema);
