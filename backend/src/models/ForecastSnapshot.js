const mongoose = require('mongoose');

/**
 * ForecastSnapshot — persisted daily forecast for a centre (rule-based, not AI).
 */
const forecastSnapshotSchema = new mongoose.Schema({
  centreId: { type: String, required: true, index: true, trim: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  confirmedBookings: { type: Number, default: 0 },
  leadDays: { type: Number, default: 0 },
  projectedBookings: { type: Number, default: 0 },
  expectedArrivalsMin: { type: Number, default: 0 },
  expectedArrivalsMax: { type: Number, default: 0 },
  expectedArrivalsMid: { type: Number, default: 0 },
  totalQuintalsMin: { type: Number, default: 0 },
  totalQuintalsMax: { type: Number, default: 0 },
  labourNeeded: { type: Number, default: 0 },
  bottleneck: { type: String, default: 'unknown' },
  heatStatus: { type: String, enum: ['Green', 'Amber', 'Red'], default: 'Green' },
  dataQualityBadge: { type: String, default: 'assumed' }, // 'assumed' or 'measured (N samples)'
  insufficientData: { type: Boolean, default: false },
  note: { type: String },
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

forecastSnapshotSchema.index({ centreId: 1, date: 1 }, { unique: true });

const ForecastSnapshot = mongoose.model('ForecastSnapshot', forecastSnapshotSchema);
module.exports = ForecastSnapshot;
