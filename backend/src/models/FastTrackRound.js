const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    farmerId: { type: String, required: true },
    phone: { type: String, required: true },
    name: { type: String, default: 'Farmer' },
    bookingId: { type: mongoose.Schema.Types.Mixed, required: true },
    tokenNumber: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const leaderSchema = new mongoose.Schema(
  {
    farmerId: { type: String, required: true },
    phone: { type: String, required: true },
    name: { type: String, default: 'Farmer' },
    bookingId: { type: mongoose.Schema.Types.Mixed, required: true },
    tokenNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    bidTime: { type: Date, default: Date.now }
  },
  { _id: false }
);

const officerDecisionSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['APPROVED', 'DECLINED', 'TIMEOUT'], default: null },
    decidedBy: { type: String, default: null },
    officerRole: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    reason: { type: String, default: null }
  },
  { _id: false }
);

const fastTrackRoundSchema = new mongoose.Schema(
  {
    roundId: {
      type: String,
      required: [true, 'Round ID is required'],
      unique: true,
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
      default: 'APMC Mandi',
      trim: true
    },
    slotDate: {
      type: String,
      required: [true, 'Slot date is required'],
      trim: true,
      index: true
    },
    slotHour: {
      type: String,
      required: [true, 'Slot hour/time is required'],
      trim: true
    },
    status: {
      type: String,
      enum: [
        'JOINING',
        'START_REQUESTED',
        'LIVE',
        'AWAITING_APPROVAL',
        'APPROVED',
        'CANCELLED_NO_QUORUM',
        'CLOSED_NO_BIDS',
        'DECLINED'
      ],
      default: 'JOINING',
      index: true
    },
    participants: [participantSchema],
    currentLeader: {
      type: leaderSchema,
      default: null
    },
    candidateQueue: [leaderSchema],
    endsAt: {
      type: Date,
      default: null,
      index: true
    },
    officerDecisionExpiresAt: {
      type: Date,
      default: null,
      index: true
    },
    officerDecision: {
      type: officerDecisionSchema,
      default: () => ({})
    },
    startRequestedBy: {
      type: Object,
      default: null
    },
    startRequestedAt: {
      type: Date,
      default: null
    },
    seq: {
      type: Number,
      default: 0
    },
    reserveFee: {
      type: Number,
      default: 200
    },
    bidStep: {
      type: Number,
      default: 10
    },
    bidCeiling: {
      type: Number,
      default: 500
    },
    capPerHour: {
      type: Number,
      default: 2
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

fastTrackRoundSchema.index({ centreId: 1, slotDate: 1, status: 1 });

module.exports = mongoose.model('FastTrackRound', fastTrackRoundSchema);
