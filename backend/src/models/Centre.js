const mongoose = require('mongoose');

/**
 * Centre Capacity Configuration Sub-Schema
 */
const capacityConfigSchema = new mongoose.Schema(
  {
    crop: {
      type: String,
      required: [true, 'Crop type is required for capacity config']
    },
    maxDailySlots: {
      type: Number,
      required: true,
      default: 50,
      min: [1, 'Daily slot capacity must be at least 1']
    },
    quantityBands: [
      {
        type: String,
        enum: ['0-5q', '5-15q', '15q+']
      }
    ],
    lanes: {
      type: Number,
      default: 2,
      min: 1
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 5
    }
  },
  { _id: false }
);

/**
 * Centre Schema
 */
const centreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Procurement centre name is required'],
      trim: true
    },
    code: {
      type: String,
      trim: true
    },
    nameMarathi: {
      type: String,
      trim: true
    },
    district: {
      type: String,
      trim: true
    },
    locationName: {
      type: String,
      trim: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Location coordinates [lng, lat] are required'],
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length === 2;
          },
          message: 'Coordinates must be an array of [longitude, latitude]'
        }
      }
    },
    cropsHandled: {
      type: [String],
      required: [true, 'At least one crop must be specified'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'A centre must handle at least one crop'
      }
    },
    workingHours: {
      start: {
        type: String,
        required: true,
        default: '08:00',
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide start time in HH:mm format']
      },
      end: {
        type: String,
        required: true,
        default: '18:00',
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide end time in HH:mm format']
      }
    },
    capacityConfig: [capacityConfigSchema],
    currentStatus: {
      type: String,
      enum: {
        values: ['Green', 'Amber', 'Red'],
        message: '{VALUE} is not a valid centre status'
      },
      default: 'Green'
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere index on location coordinates for geospatial discovery
centreSchema.index({ location: '2dsphere' });

const Centre = mongoose.model('Centre', centreSchema);

module.exports = Centre;
