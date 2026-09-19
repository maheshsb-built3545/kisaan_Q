const mongoose = require('mongoose');

/**
 * Farmer Schema
 * STRICT PRIVACY: Data Minimization applied - No Aadhaar or raw banking data stored.
 */
const farmerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Farmer phone number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
    },
    name: {
      type: String,
      required: [true, 'Farmer name is required'],
      trim: true
    },
    preferredLanguage: {
      type: String,
      enum: {
        values: ['mr', 'hi', 'en'],
        message: '{VALUE} is not a supported language'
      },
      default: 'mr'
    },
    registeredVia: {
      type: String,
      enum: {
        values: ['app', 'assisted', 'manual_admin'],
        message: '{VALUE} is not a valid registration channel'
      },
      default: 'app'
    },
    village: {
      type: String,
      default: 'Kopargaon',
      trim: true
    },
    crop: {
      type: String,
      default: 'Wheat',
      trim: true
    },
    landArea: {
      type: Number,
      default: 2.5,
      min: 0.1
    },
    district: {
      type: String,
      default: 'Ahmednagar',
      trim: true
    },
    state: {
      type: String,
      default: 'Maharashtra',
      trim: true
    },
    passcodeHash: {
      type: String,
      trim: true
    },
    kisanId: {
      type: String,
      trim: true
    },
    pendingDues: {
      type: Number,
      default: 0,
      min: 0
    },
    pushToken: {
      type: String,
      trim: true
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number] // [longitude, latitude]
      },
      address: {
        type: String,
        trim: true
      }
    },
    cancellationHistory: [
      {
        tokenNumber: { type: String, trim: true },
        mandiName: { type: String, trim: true },
        cancelledAt: { type: Date, default: Date.now },
        penaltyAmount: { type: Number, default: 0 },
        reason: { type: String, trim: true },
        status: {
          type: String,
          enum: ['DUE', 'DEDUCTED', 'WAIVED'],
          default: 'DUE'
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Geospatial 2dsphere index for proximity / pickup location queries
farmerSchema.index({ pickupLocation: '2dsphere' }, { sparse: true });

const Farmer = mongoose.model('Farmer', farmerSchema);

module.exports = Farmer;

