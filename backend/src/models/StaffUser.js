const mongoose = require('mongoose');

/**
 * StaffUser Schema
 * Internal administrative authentication and role-based access for procurement desk officers, supervisors, and admins.
 */
const staffUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Staff user name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Staff phone number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: [
          'security_gate',
          'quality_assayer',
          'weighmaster',
          'procurement',
          'accounts_settlement',
          'operator',
          'staff',
          'supervisor',
          'district_admin',
          'auditor'
        ],
        message: '{VALUE} is not a valid staff role'
      }
    },
    officerCode: {
      type: String,
      trim: true
    },
    deskName: {
      type: String,
      trim: true
    },
    terminalLane: {
      type: String,
      trim: true
    },
    terminalCode: {
      type: String,
      trim: true
    },
    assignedMandi: {
      type: String,
      default: 'KPG-01',
      trim: true
    },
    assignedMandiName: {
      type: String,
      default: 'APMC Kopargaon',
      trim: true
    },
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre'
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

staffUserSchema.index({ role: 1, assignedMandi: 1 });

const StaffUser = mongoose.model('StaffUser', staffUserSchema);

module.exports = StaffUser;

