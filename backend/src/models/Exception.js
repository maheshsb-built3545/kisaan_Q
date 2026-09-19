const mongoose = require('mongoose');

/**
 * Exception Schema
 * Captures disputes, crop quality issues, partial intakes, or rejection overrides.
 */
const exceptionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required']
    },
    type: {
      type: String,
      required: [true, 'Exception type is required'],
      enum: {
        values: ['quality_dispute', 'partial_accept', 'rejected', 'document_mismatch'],
        message: '{VALUE} is not a valid exception type'
      }
    },
    reasonCode: {
      type: String,
      required: [true, 'Reason code is required'],
      trim: true
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffUser',
      required: [true, 'Staff user reference is required']
    },
    supervisorOverride: {
      type: Boolean,
      default: false
    },
    overrideReason: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.supervisorOverride) {
            return typeof v === 'string' && v.trim().length > 0;
          }
          return true;
        },
        message: 'Override reason is required when supervisorOverride is enabled'
      }
    },
    outcome: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

exceptionSchema.index({ bookingId: 1 });
exceptionSchema.index({ type: 1, createdAt: -1 });

const Exception = mongoose.model('Exception', exceptionSchema);

module.exports = Exception;
