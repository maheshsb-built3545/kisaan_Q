const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true
    },
    farmerName: {
      type: String,
      required: [true, 'Farmer name is required'],
      trim: true
    },
    farmerPhone: {
      type: String,
      required: [true, 'Farmer phone number is required'],
      trim: true,
      index: true
    },
    centreId: {
      type: String,
      required: [true, 'Centre ID is required'],
      trim: true,
      index: true
    },
    mandiId: {
      type: String,
      required: [true, 'Mandi ID is required'],
      trim: true
    },
    mandiName: {
      type: String,
      default: 'APMC Kopargaon',
      trim: true
    },
    crop: {
      type: String,
      required: [true, 'Crop is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: 0.1
    },
    requestedSlotDate: {
      type: String,
      required: [true, 'Requested slot date is required'],
      trim: true,
      index: true
    },
    requestedSlotTime: {
      type: String,
      default: '08:00 AM - 11:00 AM',
      trim: true
    },
    status: {
      type: String,
      enum: ['WAITING', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED'],
      default: 'WAITING',
      index: true
    },
    priority: {
      type: Number,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    seedBatch: {
      type: String,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

waitlistSchema.index({ centreId: 1, requestedSlotDate: 1, status: 1, priority: -1, joinedAt: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
