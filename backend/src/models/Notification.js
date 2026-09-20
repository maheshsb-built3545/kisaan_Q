const mongoose = require('mongoose');

/**
 * Notification Schema
 * Unified notification hub supporting farmers and staff across multiple delivery channels.
 */
const notificationSchema = new mongoose.Schema(
  {
    // Recipient & Scoping
    recipientType: {
      type: String,
      enum: {
        values: ['farmer', 'staff', 'role', 'centre_staff'],
        message: '{VALUE} is not a valid recipient type'
      },
      default: 'farmer',
      required: true,
      index: true
    },
    recipientId: {
      type: String,
      required: [true, 'Recipient ID is required'],
      index: true
    },
    centreId: {
      type: String,
      index: true
    },

    // Event & Content
    event: {
      type: String,
      required: [true, 'Notification event type is required'],
      index: true
    },
    lang: {
      type: String,
      enum: ['en', 'hi', 'mr'],
      default: 'en'
    },
    title: {
      type: String,
      required: [true, 'Notification title is required']
    },
    body: {
      type: String,
      required: [true, 'Notification body is required']
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // Deduplication key (sparse unique)
    dedupeKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },

    // Delivery Status per Channel
    channels: {
      inApp: {
        status: {
          type: String,
          enum: ['delivered', 'read'],
          default: 'delivered'
        },
        deliveredAt: {
          type: Date,
          default: Date.now
        }
      },
      sms: {
        status: {
          type: String,
          enum: ['none', 'queued', 'sent', 'mock', 'failed'],
          default: 'none'
        },
        providerRef: {
          type: String
        },
        attempts: {
          type: Number,
          default: 0
        },
        sentAt: {
          type: Date
        }
      }
    },

    // Read state
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date
    },

    // Backward Compatibility Fields
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
      index: true
    },
    channel: {
      type: String,
      required: false
    },
    messageType: {
      type: String,
      required: false
    },
    deliveryStatus: {
      type: String,
      required: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for performant inbox queries
notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, centreId: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
