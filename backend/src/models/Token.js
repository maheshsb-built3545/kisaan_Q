const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  stageIndex: {
    type: Number,
    default: 0
  },
  id: {
    type: String
  },
  title: {
    type: String
  },
  label: {
    type: String
  },
  shortLabel: {
    type: String
  },
  officerName: {
    type: String
  },
  officer: {
    type: String
  },
  officerRole: {
    type: String
  },
  officerCode: {
    type: String
  },
  icon: {
    type: String
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'pending', 'in_progress', 'completed'],
    default: 'Pending'
  },
  timestamp: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  officerSigId: {
    type: String,
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  grade: {
    type: String,
    default: null
  },
  weight: {
    type: String,
    default: null
  }
}, { _id: false });

const tokenSchema = new mongoose.Schema({
  tokenNumber: {
    type: String,
    required: [true, 'Token number is required'],
    unique: true,
    trim: true,
    index: true
  },
  id: {
    type: String,
    trim: true,
    index: true
  },
  farmerName: {
    type: String,
    default: 'Mahesh Borde',
    trim: true
  },
  farmerPhone: {
    type: String,
    required: [true, 'Farmer phone number is required'],
    trim: true,
    index: true
  },
  farmerId: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  mandiId: {
    type: String,
    required: [true, 'Mandi ID is required'],
    trim: true
  },
  mandiName: {
    type: String,
    required: [true, 'Mandi Name is required'],
    trim: true
  },
  mandiCode: {
    type: String,
    trim: true
  },
  crop: {
    type: String,
    required: [true, 'Crop name is required'],
    enum: {
      values: ['Wheat', 'Soybean', 'Onion', 'Cotton', 'Red Onion'],
      message: '{VALUE} is not a supported crop'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity in Quintals is required'],
    min: [0.1, 'Quantity must be at least 0.1 Quintals']
  },
  quantityBand: {
    type: String
  },
  slotDate: {
    type: String
  },
  slotTime: {
    type: String
  },
  slotLabel: {
    type: String
  },
  status: {
    type: String,
    enum: [
      'Booked', 'In-Progress', 'Gate-Exit-Requested', 'Cancelled', 'Completed',
      'BOOKED', 'GATE_IN', 'INSPECTED', 'WEIGHED', 'PROCUREMENT', 'COMPLETED',
      'CANCELLED', 'GATE_EXIT_REQUESTED'
    ],
    default: 'Booked'
  },
  cancellationFee: {
    type: Number,
    default: 0
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  gateExitApprovedBy: {
    type: String,
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  },
  currentStageIndex: {
    type: Number,
    default: 0
  },
  queuePosition: {
    type: Number,
    default: 8
  },
  isFastTrack: {
    type: Boolean,
    default: false
  },
  fastTrackTier: {
    type: Number,
    default: null
  },
  fastTrackDiscountedPrice: {
    type: Number,
    default: null
  },
  stages: {
    type: [stageSchema],
    default: []
  },
  latitude: {
    type: Number,
    default: 19.8928
  },
  longitude: {
    type: Number,
    default: 74.4820
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [74.4820, 19.8928]
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Geospatial 2dsphere index for proximity / micro-pooling queries
tokenSchema.index({ location: '2dsphere' });
tokenSchema.index({ farmerPhone: 1, status: 1 });

// Pre-save hook to ensure id matches tokenNumber, phone matches farmerPhone, and coordinates are synced
tokenSchema.pre('save', function (next) {
  if (!this.id && this.tokenNumber) {
    this.id = this.tokenNumber;
  }
  if (!this.tokenNumber && this.id) {
    this.tokenNumber = this.id;
  }
  if (!this.phone && this.farmerPhone) {
    this.phone = this.farmerPhone;
  }
  if (!this.farmerPhone && this.phone) {
    this.farmerPhone = this.phone;
  }

  // Synchronize GeoJSON coordinates
  const lat = Number(this.latitude) || 19.8928;
  const lng = Number(this.longitude) || 74.4820;
  this.latitude = lat;
  this.longitude = lng;
  this.location = {
    type: 'Point',
    coordinates: [lng, lat]
  };

  next();
});

module.exports = mongoose.model('Token', tokenSchema);
