const mongoose = require('mongoose');

const fastTrackRoundSchema = new mongoose.Schema(
  {
    roundId: {
      type: String,
      required: [true, 'Round ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    tokenNumber: {
      type: String,
      required: [true, 'Token number is required'],
      trim: true,
      index: true
    },
    tokenId: {
      type: mongoose.Schema.Types.Mixed,
      default: null
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
      default: 'APMC Mandi',
      trim: true
    },
    crop: {
      type: String,
      required: [true, 'Crop is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required']
    },
    baseMarketPrice: {
      type: Number,
      required: [true, 'Base mandi market price is required']
    },
    floorPrice: {
      type: Number,
      required: [true, 'Floor MSP price is required']
    },
    startingBid: {
      type: Number,
      default: 10
    },
    highestBid: {
      type: Number,
      default: 10
    },
    highestBidderPhone: {
      type: String,
      default: null
    },
    highestBidderName: {
      type: String,
      default: null
    },
    bidsCount: {
      type: Number,
      default: 0
    },
    roundStartTime: {
      type: Date,
      default: Date.now
    },
    roundEndTime: {
      type: Date,
      required: true,
      index: true
    },
    timerSeconds: {
      type: Number,
      default: 100
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'TIMER_EXPIRED', 'APPROVED', 'DECLINED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true
    },
    decisionBy: {
      type: String,
      default: null
    },
    decisionAt: {
      type: Date,
      default: null
    },
    decisionNotes: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

fastTrackRoundSchema.index({ centreId: 1, status: 1 });

module.exports = mongoose.model('FastTrackRound', fastTrackRoundSchema);
