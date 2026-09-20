const mongoose = require('mongoose');

/**
 * Availability — daily resource availability override per centre.
 */
const availabilitySchema = new mongoose.Schema({
  centreId: { type: String, required: true, index: true, trim: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  resourceType: { type: String, required: true },
  available: { type: Number, required: true, min: 0 },
  note: { type: String, trim: true },
  updatedBy: String
}, { timestamps: true });

availabilitySchema.index({ centreId: 1, date: 1, resourceType: 1 }, { unique: true });

const Availability = mongoose.model('Availability', availabilitySchema);
module.exports = Availability;
