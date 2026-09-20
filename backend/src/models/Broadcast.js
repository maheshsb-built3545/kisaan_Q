const mongoose = require('mongoose');

/**
 * Broadcast — plain announcement sent by an officer to all farmers at a centre.
 * Supports trilingual content (en/hi/mr) via notify().
 */
const broadcastSchema = new mongoose.Schema({
  centreId: { type: String, required: true, trim: true, index: true },
  text: {
    en: { type: String, required: true, trim: true },
    hi: { type: String, trim: true, default: '' },
    mr: { type: String, trim: true, default: '' }
  },
  sentBy: { type: String, required: true }, // staff id
  sentAt: { type: Date, default: Date.now, index: true },
  recipientCount: { type: Number, default: 0 } // how many farmers were notified
}, { timestamps: true });

const Broadcast = mongoose.model('Broadcast', broadcastSchema);
module.exports = Broadcast;
