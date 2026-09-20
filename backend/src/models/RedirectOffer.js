const mongoose = require('mongoose');

/**
 * RedirectOffer — officer proposes redirecting a farmer to a different centre.
 * Only books at receiving centre after both:
 * (a) InboundQuota is set and not full, and (b) farmer accepts.
 */
const redirectOfferSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.Mixed, // accepts ObjectId or string phone/id
    required: true,
    index: true
  },
  fromCentre: { type: String, required: true, trim: true },
  toCentre: { type: String, required: true, trim: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  hour: { type: Number, required: true }, // proposed hour at receiving centre
  quotaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'InboundQuota' },
  originalBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending',
    index: true
  },
  expiresAt: { type: Date, required: true, index: true },
  proposedBy: { type: String }, // staff id
  newBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }, // set on accept
  distanceKm: { type: Number }, // approx distance from fromCentre to toCentre
  toCentreHeatStatus: { type: String, enum: ['Green', 'Amber', 'Red'], default: 'Green' }
}, { timestamps: true });

redirectOfferSchema.index({ farmerId: 1, status: 1 });

const RedirectOffer = mongoose.model('RedirectOffer', redirectOfferSchema);
module.exports = RedirectOffer;
