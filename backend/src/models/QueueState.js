const mongoose = require('mongoose');

/**
 * QueueState Schema
 * Tracks real-time queue ordering and dynamic position estimates for a centre on a given date.
 */
const queueStateSchema = new mongoose.Schema(
  {
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: [true, 'Centre reference is required']
    },
    date: {
      type: String,
      required: [true, 'Queue date (YYYY-MM-DD) is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must follow YYYY-MM-DD format']
    },
    activeBookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
      }
    ],
    currentPositionMap: {
      type: Map,
      of: String,
      default: () => new Map()
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Ensure one QueueState per centre per operational date
queueStateSchema.index({ centreId: 1, date: 1 }, { unique: true });

const QueueState = mongoose.model('QueueState', queueStateSchema);

module.exports = QueueState;
