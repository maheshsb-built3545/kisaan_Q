const mongoose = require('mongoose');

/**
 * Stage Progress Sub-Schema
 */
const stageProgressSchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      required: [true, 'Stage name is required'],
      trim: true
    },
    status: {
      type: String,
      required: [true, 'Stage status is required'],
      enum: {
        values: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BYPASSED'],
        message: '{VALUE} is not a valid stage status'
      },
      default: 'PENDING'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffUser'
    },
    remarks: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

/**
 * ProcurementRecord Schema
 * 1:1 mapping with Booking for physical intake tracking, weighbridge logging, and payment lifecycle tracking.
 */
const procurementRecordSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      unique: true
    },
    stages: {
      type: [stageProgressSchema],
      default: []
    },
    paymentStatus: {
      type: String,
      enum: {
        values: [
          'procurement_approved',
          'bill_generated',
          'payment_file_submitted',
          'payment_initiated',
          'payment_confirmed',
          'status_unavailable'
        ],
        message: '{VALUE} is not a valid payment status'
      },
      default: 'status_unavailable'
    },
    paymentStatusSource: {
      type: String,
      trim: true
    },
    paymentStatusTimestamp: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const ProcurementRecord = mongoose.model('ProcurementRecord', procurementRecordSchema);

module.exports = ProcurementRecord;
