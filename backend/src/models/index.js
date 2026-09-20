const Farmer = require('./Farmer');
const Centre = require('./Centre');
const Booking = require('./Booking');
const QueueState = require('./QueueState');
const ProcurementRecord = require('./ProcurementRecord');
const StaffUser = require('./StaffUser');
const AuditLog = require('./AuditLog');
const Notification = require('./Notification');
const Exception = require('./Exception');
const Token = require('./Token');
const CropPrice = require('./CropPrice');
const Waitlist = require('./Waitlist');
const SlotOffer = require('./SlotOffer');
const Complaint = require('./Complaint');
const FastTrackRound = require('./FastTrackRound');
const FastTrackBid = require('./FastTrackBid');

// Planning & Forecast models (B7)
const Resource = require('./Resource');
const Availability = require('./Availability');
const CentreEvent = require('./CentreEvent');
const SlotCap = require('./SlotCap');
const ForecastSnapshot = require('./ForecastSnapshot');
const PlanRequest = require('./PlanRequest');

// Redirect & Broadcast models (B9)
const RedirectOffer = require('./RedirectOffer');
const InboundQuota = require('./InboundQuota');
const Broadcast = require('./Broadcast');

module.exports = {
  Farmer,
  Centre,
  Booking,
  QueueState,
  ProcurementRecord,
  StaffUser,
  AuditLog,
  Notification,
  Exception,
  Token,
  CropPrice,
  Waitlist,
  SlotOffer,
  Complaint,
  FastTrackRound,
  FastTrackBid,
  // Planning & Forecast
  Resource,
  Availability,
  CentreEvent,
  SlotCap,
  ForecastSnapshot,
  PlanRequest,
  // Redirect & Broadcast
  RedirectOffer,
  InboundQuota,
  Broadcast
};

// Ensure all models support seedBatch for non-invasive showcase tagging & cleanup
for (const model of Object.values(module.exports)) {
  if (model?.schema && !model.schema.paths.seedBatch) {
    try {
      model.schema.add({
        seedBatch: { type: String, default: null, index: true }
      });
    } catch (_) {}
  }
}


