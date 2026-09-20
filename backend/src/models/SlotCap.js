const mongoose = require('mongoose');

/**
 * SlotCap — hourly slot capacity cap per centre per date.
 * Officers can set a cap (with a warning if cap < confirmed).
 * Cap NEVER cancels existing bookings.
 */
const slotCapSchema = new mongoose.Schema({
  centreId: { type: String, required: true, index: true, trim: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  hour: { type: Number, required: true, min: 0, max: 23 }, // 0–23
  cap: { type: Number, required: true, min: 0 },
  confirmedAtSet: { type: Number, default: 0 }, // confirmed count when cap was set (for warning)
  warnCapBelowConfirmed: { type: Boolean, default: false }, // warning flag
  setBy: String
}, { timestamps: true });

slotCapSchema.index({ centreId: 1, date: 1, hour: 1 }, { unique: true });

const SlotCap = mongoose.model('SlotCap', slotCapSchema);
module.exports = SlotCap;
