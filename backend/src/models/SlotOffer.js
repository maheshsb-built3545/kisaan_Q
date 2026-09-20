const mongoose = require('mongoose');

const slotOfferSchema = new mongoose.Schema(
  {
    waitlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Waitlist',
      required: true,
      index: true
    },
    releasedTokenNumber: {
      type: String,
      default: null,
      trim: true
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
    slotDate: {
      type: String,
      required: [true, 'Slot date is required'],
      trim: true
    },
    slotTime: {
      type: String,
      required: [true, 'Slot time is required'],
      trim: true
    },
    offeredAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: [true, 'Offer expiration time is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
      default: 'PENDING',
      index: true
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    createdTokenNumber: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

slotOfferSchema.index({ farmerPhone: 1, status: 1 });
slotOfferSchema.index({ centreId: 1, slotDate: 1, status: 1 });

module.exports = mongoose.model('SlotOffer', slotOfferSchema);
