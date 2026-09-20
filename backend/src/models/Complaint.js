const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: [true, 'Complaint ID is required'],
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
      default: 'APMC Mandi',
      trim: true
    },
    checkpoint: {
      type: String,
      required: [true, 'Checkpoint is required'],
      enum: {
        values: [
          'GATE_CHECKIN', 'QUALITY_GRADING', 'WEIGHBRIDGE', 'PROCUREMENT', 'PAYOUT',
          'gate', 'quality', 'weighbridge', 'procurement', 'payout',
          'gate_checkin', 'quality_grading'
        ],
        message: '{VALUE} is not a valid checkpoint'
      }
    },
    category: {
      type: String,
      enum: [
        'ASSAYING_DISPUTE', 'WEIGHMENT_VARIANCE', 'PAYOUT_DELAY', 'OFFICER_CONDUCT',
        'FACILITY_ISSUE', 'OTHER',
        'QUALITY_DISPUTE', 'WEIGHT_DISCREPANCY', 'DELAY', 'STAFF_BEHAVIOUR',
        'PAYMENT_ISSUE', 'CORRUPTION_ALLEGATION',
        'quality_dispute', 'partial_accept', 'rejected', 'document_mismatch',
        'delay', 'other'
      ],
      default: 'ASSAYING_DISPUTE'
    },
    description: {
      type: String,
      required: [true, 'Complaint description is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_INVESTIGATION', 'RESOLVED', 'REJECTED', 'OPEN', 'INVESTIGATING'],
      default: 'PENDING',
      index: true
    },
    source: {
      type: String,
      enum: ['farmer', 'staff'],
      default: 'farmer'
    },
    assignedTo: {
      type: String,
      default: 'Mandi Supervisor'
    },
    resolvedBy: {
      type: String,
      default: null
    },
    resolutionNotes: {
      type: String,
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

complaintSchema.index({ centreId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
