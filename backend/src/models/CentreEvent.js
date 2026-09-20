const mongoose = require('mongoose');

/**
 * CentreEvent — planned events affecting a centre's capacity on a date.
 * e.g. 'holiday', 'maintenance', 'peak_season', 'custom'.
 */
const centreEventSchema = new mongoose.Schema({
  centreId: { type: String, required: true, index: true, trim: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  kind: {
    type: String,
    required: true,
    enum: ['holiday', 'maintenance', 'peak_season', 'special', 'custom']
  },
  note: { type: String, trim: true },
  createdBy: String
}, { timestamps: true });

centreEventSchema.index({ centreId: 1, date: 1 });

const CentreEvent = mongoose.model('CentreEvent', centreEventSchema);
module.exports = CentreEvent;
