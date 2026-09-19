const mongoose = require('mongoose');

/**
 * FastTrackRequest Schema
 * Represents a farmer's voluntary price-discount request for expedited gate/queue priority.
 */
const fastTrackRequestSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: String,
      required: [true, 'Token number is required'],
      index: true,
      trim: true
    },
    farmerPhone: {
      type: String,
      required: [true, 'Farmer phone number is required'],
      trim: true
    },
    mandiId: {
      type: String,
      required: [true, 'Mandi ID is required'],
      index: true,
      trim: true
    },
    crop: {
      type: String,
      required: [true, 'Crop name is required'],
      trim: true
    },
    tier: {
      type: Number,
      enum: {
        values: [10, 20, 40, 2, 5],
        message: 'Tier must be flat rate ₹10, ₹20, or ₹40/Qtl discount'
      },
      required: [true, 'Discount tier is required']
    },
    discountPerQuintal: {
      type: Number,
      default: 10
    },
    marketPriceAtRequest: {
      type: Number,
      required: [true, 'Market price at request time is required'],
      min: [0, 'Market price must be positive']
    },
    mspPriceAtRequest: {
      type: Number,
      required: [true, 'Statutory MSP price floor is required'],
      min: [0, 'MSP price must be positive']
    },
    discountedPrice: {
      type: Number,
      required: [true, 'Discounted price is required'],
      min: [0, 'Discounted price must be positive']
    },
    slotNumber: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    reviewedBy: {
      type: String,
      default: null,
      trim: true
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast officer queue lookup, token queries, and atomic concurrency capacity slots
fastTrackRequestSchema.index({ mandiId: 1, status: 1, tier: -1, requestedAt: 1 });
fastTrackRequestSchema.index({ tokenNumber: 1, status: 1 });
fastTrackRequestSchema.index(
  { mandiId: 1, slotNumber: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } }
);

const FastTrackRequest = mongoose.model('FastTrackRequest', fastTrackRequestSchema);

module.exports = FastTrackRequest;
