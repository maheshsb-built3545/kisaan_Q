const mongoose = require('mongoose');

/**
 * PlanRequest — resource sharing request between centres.
 * type 'own': same-centre officer self-plans (supervisor notified, can flag).
 * type 'borrow': one centre borrows from another; lending centre officer decides.
 * Deadline escalation: no decision by deadline → escalated to district_admin.
 */
const planRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['own', 'borrow']
  },
  fromCentre: { type: String, required: true, trim: true }, // requesting centre
  toCentre: { type: String, trim: true }, // lending centre (borrow only)
  resource: {
    type: String,
    required: true,
    enum: ['labourer', 'weighbridge', 'assaying_bay', 'gate_lane', 'truck_bay', 'storage_unit']
  },
  count: { type: Number, required: true, min: 1 },
  dates: [{ type: String }], // ['YYYY-MM-DD', ...]
  status: {
    type: String,
    required: true,
    enum: ['pending', 'allowed', 'declined', 'expired', 'escalated'],
    default: 'pending',
    index: true
  },
  deadline: { type: Date, required: true, index: true },
  requestedBy: { type: String, required: true }, // officer staff id
  decidedBy: { type: String }, // staff id of decision maker
  reason: { type: String, trim: true }, // reason for decline / flag
  supervisorFlag: { type: String }, // supervisor's "not possible" note (own plan)
  auditEntries: [{
    action: String,
    actorId: String,
    actorRole: String,
    note: String,
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

planRequestSchema.index({ fromCentre: 1, status: 1 });
planRequestSchema.index({ toCentre: 1, status: 1 });

const PlanRequest = mongoose.model('PlanRequest', planRequestSchema);
module.exports = PlanRequest;
