const mongoose = require('mongoose');

/**
 * CropPrice Schema
 * Unified statutory Minimum Support Price (MSP) and daily dynamic Mandi market rate model.
 */
const cropPriceSchema = new mongoose.Schema(
  {
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
    mspPrice: {
      type: Number,
      required: [true, 'Statutory MSP price is required'],
      min: [0, 'MSP price must be positive']
    },
    marketPriceToday: {
      type: Number,
      required: [true, 'Today market price is required'],
      min: [0, 'Market price must be positive']
    },
    marketPriceYesterday: {
      type: Number,
      default: null
    },
    effectiveDate: {
      type: String,
      required: [true, 'Effective date string (YYYY-MM-DD) is required'],
      trim: true
    },
    updatedBy: {
      type: String,
      default: 'SYSTEM_SEED',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on { mandiId, crop, effectiveDate } to prevent duplicate entries per day
cropPriceSchema.index({ mandiId: 1, crop: 1, effectiveDate: 1 }, { unique: true });

const CropPrice = mongoose.model('CropPrice', cropPriceSchema);

module.exports = CropPrice;
