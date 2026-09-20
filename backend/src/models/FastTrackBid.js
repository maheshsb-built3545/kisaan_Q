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
    tokenNumber: {
      type: String,
      required: [true, 'Token number is required'],
      trim: true,
      index: true
    },
    bidderPhone: {
      type: String,
      required: [true, 'Bidder phone number is required'],
      trim: true,
      index: true
    },
    bidderName: {
      type: String,
      default: 'Trader / Buyer',
      trim: true
    },
    bidDiscountPerQtl: {
      type: Number,
      required: [true, 'Bid discount per quintal is required'],
      min: [1, 'Bid discount must be at least ₹1/Qtl']
    },
    netPriceOffered: {
      type: Number,
      required: [true, 'Net price offered is required']
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

fastTrackBidSchema.index({ roundId: 1, bidDiscountPerQtl: -1, createdAt: 1 });

module.exports = mongoose.model('FastTrackBid', fastTrackBidSchema);
