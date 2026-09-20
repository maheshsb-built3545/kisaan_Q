const mongoose = require('mongoose');

/**
 * Resource — physical resource inventory at a procurement centre (demo data).
 * Idempotent: seeded with DEMO_ prefix records per centre.
 */
const resourceSchema = new mongoose.Schema({
  centreId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['labourer', 'weighbridge', 'assaying_bay', 'gate_lane', 'truck_bay', 'storage_unit'],
    index: true
  },
  count: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unitCapacity: {
    // e.g. quintals per shift for labour, vehicles per hour for bays
    type: Number,
    default: 1
  },
  label: {
    type: String,
    trim: true,
    default: 'demo data'
  },
  updatedBy: String
}, { timestamps: true });

resourceSchema.index({ centreId: 1, type: 1 }, { unique: true });

const Resource = mongoose.model('Resource', resourceSchema);
module.exports = Resource;
