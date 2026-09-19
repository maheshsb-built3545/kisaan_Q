const mongoose = require('mongoose');

/**
 * AuditLog Schema
 * Immutable event stream tracking administrative decisions, status shifts, and override actions.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.Mixed, // Can be Farmer ID, Staff ID, or 'SYSTEM'
      required: [true, 'Actor ID is required']
    },
    actorRole: {
      type: String,
      required: [true, 'Actor role is required'],
      enum: {
        values: ['farmer', 'operator', 'staff', 'supervisor', 'district_admin', 'auditor', 'system'],
        message: '{VALUE} is not a valid actor role'
      }
    },
    action: {
      type: String,
      required: [true, 'Action identifier is required'],
      trim: true
    },
    targetId: {
      type: mongoose.Schema.Types.Mixed, // Target Booking, Centre, Exception, etc.
      required: [true, 'Target ID is required']
    },
    reason: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          // Reason is strictly required for overrides and release actions
          if (this.action && (this.action.includes('OVERRIDE') || this.action.includes('RELEASE'))) {
            return typeof v === 'string' && v.trim().length > 0;
          }
          return true;
        },
        message: 'A clear reason is mandatory for override or slot release actions'
      }
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false // Single event log, timestamp field is explicit
  }
);

// Compound index for querying audit history by target entity and chronological ordering
auditLogSchema.index({ targetId: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
