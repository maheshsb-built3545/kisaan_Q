const mongoose = require('mongoose');

/**
 * InboundQuota — receiving centre officer sets a quota of how many
 * redirect-accepted farmers can be accommodated for a given date+hour.
 * Atomic increment ensures quota is never exceeded under race conditions.
 */
const inboundQuotaSchema = new mongoose.Schema({
  centreId: { type: String, required: true, trim: true, index: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  hour: { type: Number, required: true },
  count: { type: Number, required: true, min: 1 }, // total quota
  used: { type: Number, default: 0, min: 0 },     // atomically incremented on accept
  setBy: { type: String } // staff id
}, { timestamps: true });

inboundQuotaSchema.index({ centreId: 1, date: 1, hour: 1 }, { unique: true });

const InboundQuota = mongoose.model('InboundQuota', inboundQuotaSchema);
module.exports = InboundQuota;
