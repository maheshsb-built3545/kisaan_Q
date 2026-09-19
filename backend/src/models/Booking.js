const mongoose = require('mongoose');

/**
 * Booking Schema
 */
const bookingSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farmer',
      required: [true, 'Farmer reference is required']
    },
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: [true, 'Centre reference is required']
    },
    crop: {
      type: String,
      required: [true, 'Crop name is required'],
      trim: true
    },
    quantityBand: {
      type: String,
      required: [true, 'Quantity band is required'],
      enum: {
        values: ['0-5q', '5-15q', '15q+'],
        message: '{VALUE} is not a valid quantity band'
      }
    },
    arrivalWindowStart: {
      type: Date,
      required: [true, 'Arrival window start time is required']
    },
    arrivalWindowEnd: {
      type: Date,
      required: [true, 'Arrival window end time is required'],
      validate: {
        validator: function (v) {
          return !this.arrivalWindowStart || v > this.arrivalWindowStart;
        },
        message: 'Arrival window end time must be after start time'
      }
    },
    tokenNumber: {
      type: String,
      required: [true, 'Token number is required'],
      unique: true,
      trim: true
    },
    qrCode: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          'BOOKED',
          'CONFIRMED',
          'CHECKED_IN',
          'INSPECTED',
          'WEIGHED_READY_FOR_AUCTION',
          'ELIGIBLE_FOR_RELEASE',
          'RELEASED',
          'CANCELLED',
          'COMPLETED'
        ],
        message: '{VALUE} is not a valid booking status'
      },
      default: 'BOOKED'
    },
    grade: {
      type: String,
      trim: true
    },
    moisturePercentage: {
      type: Number
    },
    inspectorNotes: {
      type: String,
      trim: true
    },
    grossWeight: {
      type: Number
    },
    tareWeight: {
      type: Number
    },
    netWeight: {
      type: Number
    },
    weighbridgeId: {
      type: String,
      trim: true
    },
    channel: {
      type: String,
      enum: {
        values: ['app', 'sms', 'assisted'],
        message: '{VALUE} is not a valid booking channel'
      },
      default: 'app'
    },
    gracePeriodEnd: {
      type: Date
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
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast querying of bookings by centre, arrival window, and status
bookingSchema.index({ centreId: 1, arrivalWindowStart: 1, status: 1 });
bookingSchema.index({ farmerId: 1, createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
