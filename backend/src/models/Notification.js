const mongoose = require('mongoose');

/**
 * Notification Schema
 * Tracks automated notifications dispatched to farmers across multiple channels.
 */
const notificationSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required']
    },
    channel: {
      type: String,
      required: [true, 'Notification channel is required'],
      enum: {
        values: ['sms', 'push', 'ivr'],
        message: '{VALUE} is not a valid notification channel'
      }
    },
    messageType: {
      type: String,
      required: [true, 'Message type is required'],
      enum: {
        values: ['booking_confirmed', 'window_approaching', 'status_update', 'vacancy_released'],
        message: '{VALUE} is not a valid message type'
      }
    },
    deliveryStatus: {
      type: String,
      enum: {
        values: ['sent', 'delivered', 'failed', 'retried'],
        message: '{VALUE} is not a valid delivery status'
      },
      default: 'sent'
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

notificationSchema.index({ bookingId: 1, timestamp: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
