const mongoose = require('mongoose');

const fastTrackBidSchema = new mongoose.Schema(
  {
    bidId: {
      type: String,
      required: [true, 'Bid ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FastTrackRound',
      required: [true, 'Round reference is required'],
      index: true
    },
    farmerId: {
      type: String,
      required: [true, 'Farmer ID is required'],
      index: true
    },
    farmerPhone: {
      type: String,
      required: [true, 'Farmer phone number is required'],
      trim: true,
      index: true
    },
    farmerName: {
      type: String,
      default: 'Farmer',
      trim: true
    },
    bookingId: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    tokenNumber: {
      type: String,
      required: [true, 'Token number is required'],
      trim: true,
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Bid amount (rupees committed) is required'],
      min: [1, 'Bid amount must be at least ₹1']
    },
    seq: {
      type: Number,
      required: true
    },
    bidTime: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

fastTrackBidSchema.index({ roundId: 1, amount: -1, bidTime: 1 });

module.exports = mongoose.model('FastTrackBid', fastTrackBidSchema);
