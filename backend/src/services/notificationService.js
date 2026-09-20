const mongoose = require('mongoose');
const https = require('https');
const { Notification, Booking, Farmer, StaffUser } = require('../models');
const { inMemoryFarmers } = require('./authService');
const logger = require('../utils/logger');
const { SMS_POLICY, DEFAULT_SMS_BUDGET_PER_FARMER } = require('../config/smsPolicy');
const { renderTemplate } = require('../utils/notificationTemplates');

// In-memory fallback
const inMemoryNotifications = [];

// ---------------------------------------------------------------------------
// Internal helper: resolve farmer phone AND booking context from a bookingId.
// Returns { phone, tokenNumber, windowStart } — phone is the only required field.
// ---------------------------------------------------------------------------
const _resolvePhoneAndContext = async (bookingId) => {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    const booking = await Booking.findById(bookingId)
      .select('farmerId tokenNumber arrivalWindowStart centreId')
      .lean();
    if (!booking?.farmerId) return null;
    const farmer = await Farmer.findById(booking.farmerId).select('phone preferredLanguage noSmartphone smsSentCount').lean();
    if (!farmer?.phone) return null;
    return {
      farmerId:    booking.farmerId.toString(),
      phone:       farmer.phone,
      lang:        farmer.preferredLanguage || 'mr',
      noSmartphone: farmer.noSmartphone || false,
      smsSentCount: farmer.smsSentCount || 0,
      tokenNumber: booking.tokenNumber || null,
      windowStart: booking.arrivalWindowStart || null,
      centreId:    booking.centreId?.toString() || null,
    };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Internal helper: send one SMS via Fast2SMS
// Returns 'sent' on success, 'mock' in dev/unset key, 'failed' on error.
// ---------------------------------------------------------------------------
const _fast2smsSend = (phone, message) => {
  return new Promise((resolve) => {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      logger.warn('[Fast2SMS] FAST2SMS_API_KEY not set — running in SMS mock mode. Real SMS NOT sent.');
      resolve({ status: 'mock' });
      return;
    }

    const cleanPhone = (phone || '').toString().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      logger.warn(`[Fast2SMS] Invalid 10-digit Indian phone number: ${phone}`);
      resolve({ status: 'failed', error: 'Invalid phone number' });
      return;
    }

    const body = JSON.stringify({
      route: 'q',           // Quick Transactional route
      numbers: cleanPhone,
      message,
      flash: 0,
      language: 'english',
    });

    const options = {
      hostname: 'www.fast2sms.com',
      path: '/dev/bulkV2',
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.return === true) {
            logger.info(`[Fast2SMS] SMS sent to +91${cleanPhone} — request_id: ${parsed.request_id}`);
            resolve({ status: 'sent', providerRef: parsed.request_id });
          } else {
            logger.error(`[Fast2SMS] Gateway rejected message to +91${cleanPhone}: ${JSON.stringify(parsed)}`);
            resolve({ status: 'failed', error: parsed.message || 'Gateway error' });
          }
        } catch (e) {
          logger.error(`[Fast2SMS] Invalid JSON response from gateway: ${data}`);
          resolve({ status: 'failed', error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      logger.error(`[Fast2SMS] Network error connecting to Fast2SMS: ${err.message}`);
      resolve({ status: 'failed', error: err.message });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      logger.error('[Fast2SMS] Request timed out after 8000ms');
      resolve({ status: 'failed', error: 'Timeout' });
    });

    req.write(body);
    req.end();
  });
};

const notificationService = {
  /**
   * Unified notification dispatcher for all KisanQ events.
   * Dispatches in-app notification, emits Socket.IO, and applies SMS policy rules.
   *
   * @param {object|string} recipient - { id, type, phone, lang, centreId, noSmartphone, smsSentCount } or recipient ID
   * @param {string} event - Event name (e.g. 'booking_confirmed', 'gate_checkin', 'payout_settled')
   * @param {object} payload - Contextual metadata (tokenNumber, mandiName, amount, etc.)
   * @param {object} opts - { dedupeKey, io, forceSms, bookingId }
   * @returns {Promise<object>} Created notification record
   */
  notify: async (recipient, event, payload = {}, opts = {}) => {
    try {
      // Support both positional (recipient, event, payload, opts) and single-object ({ recipientPhone, templateKey, params }) signatures
      let effectiveEvent = event;
      let effectivePayload = payload;
      let effectiveOpts = opts;
      let rec = recipient;

      if (typeof recipient === 'object' && recipient !== null && (recipient.templateKey || recipient.event || !event)) {
        effectiveEvent = (recipient.templateKey || recipient.event || '').toLowerCase();
        effectivePayload = recipient.params || recipient.payload || {};
        effectiveOpts = recipient.opts || opts || {};
        const rawType = recipient.type || (recipient.recipientRole || recipient.role ? 'staff' : 'farmer');
        rec = {
          id: (recipient.recipientPhone || recipient.phone || recipient.recipientId || recipient.id || 'system').toString(),
          phone: recipient.recipientPhone || recipient.phone,
          name: recipient.recipientName || recipient.name,
          type: ['farmer', 'staff', 'role', 'centre_staff'].includes(rawType) ? rawType : 'staff',
          centreId: recipient.centreId || effectivePayload.centreId || effectivePayload.mandiId
        };
      } else {
        rec = typeof recipient === 'object' && recipient !== null ? { ...recipient } : { id: recipient };
        const rawType = rec.type || (rec.role ? 'staff' : 'farmer');
        rec.type = ['farmer', 'staff', 'role', 'centre_staff'].includes(rawType) ? rawType : 'staff';
        rec.id = (rec.id || rec._id || rec.phone || 'system').toString();
      }

      // Look up farmer details if missing
      if (rec.type === 'farmer' && (!rec.phone || rec.lang === undefined)) {
        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(rec.id)) {
          const farmerDoc = await Farmer.findById(rec.id).select('phone preferredLanguage noSmartphone smsSentCount name').lean();
          if (farmerDoc) {
            rec.phone = rec.phone || farmerDoc.phone;
            rec.lang = rec.lang || farmerDoc.preferredLanguage || 'en';
            rec.noSmartphone = rec.noSmartphone !== undefined ? rec.noSmartphone : (farmerDoc.noSmartphone || false);
            rec.smsSentCount = rec.smsSentCount !== undefined ? rec.smsSentCount : (farmerDoc.smsSentCount || 0);
            rec.name = rec.name || farmerDoc.name;
          }
        }
      }

      const lang = rec.lang || effectivePayload.lang || 'en';
      const centreId = rec.centreId || effectivePayload.centreId || effectivePayload.mandiId || null;

      // 2. Render localized template
      const { title, body } = renderTemplate(effectiveEvent, effectivePayload, lang);

      // 3. Deduplication Check
      const dedupeKey = effectiveOpts.dedupeKey || `${rec.id}_${effectiveEvent}_${effectivePayload.tokenNumber || effectivePayload.bookingId || ''}_${effectivePayload.stage || ''}`;
      
      if (mongoose.connection.readyState === 1) {
        const existing = await Notification.findOne({ dedupeKey });
        if (existing) {
          logger.info(`[Notifications] Deduplication hit for key: ${dedupeKey} — returning existing notification.`);
          return existing;
        }
      } else {
        const existingMem = inMemoryNotifications.find((n) => n.dedupeKey === dedupeKey);
        if (existingMem) {
          logger.info(`[Notifications] In-memory deduplication hit for key: ${dedupeKey}`);
          return existingMem;
        }
      }

      // 4. Evaluate SMS Channel Eligibility
      const isPolicySms = Boolean(SMS_POLICY[event]);
      const isNoSmartphone = Boolean(rec.noSmartphone);
      const isForceSms = Boolean(opts.forceSms);
      const currentSmsCount = rec.smsSentCount || 0;
      const isOverBudget = currentSmsCount >= DEFAULT_SMS_BUDGET_PER_FARMER;

      // Send SMS if: (policy allows OR noSmartphone OR forceSms) AND (under budget OR is key policy event)
      const shouldSendSms = Boolean(rec.phone) && (isPolicySms || isNoSmartphone || isForceSms) && (!isOverBudget || isPolicySms);

      let smsResult = { status: 'none', attempts: 0 };

      if (shouldSendSms) {
        // Build clear SMS text
        const smsText = `KisanQ: ${title}. ${body}`;
        
        // Attempt 1
        smsResult.attempts = 1;
        let dispatch = await _fast2smsSend(rec.phone, smsText);

        // Max 2 attempts retry policy on failure
        if (dispatch.status === 'failed') {
          logger.warn(`[Notifications] SMS attempt 1 failed for ${rec.phone}, executing immediate retry (attempt 2)...`);
          smsResult.attempts = 2;
          dispatch = await _fast2smsSend(rec.phone, smsText);
        }

        smsResult.status = dispatch.status; // 'sent' | 'mock' | 'failed'
        if (dispatch.providerRef) smsResult.providerRef = dispatch.providerRef;
        smsResult.sentAt = new Date();

        // Increment farmer smsSentCount if MongoDB active
        if (rec.type === 'farmer' && dispatch.status === 'sent' && mongoose.connection.readyState === 1) {
          try {
            await Farmer.findOneAndUpdate(
              { $or: [{ _id: mongoose.Types.ObjectId.isValid(rec.id) ? rec.id : null }, { phone: rec.phone }] },
              { $inc: { smsSentCount: 1 } }
            );
          } catch (cntErr) {
            logger.warn(`[Notifications] Failed to increment smsSentCount: ${cntErr.message}`);
          }
        }
      }

      // 5. Construct Notification Record
      const notificationData = {
        recipientType: rec.type,
        recipientId: rec.id,
        centreId: centreId ? centreId.toString() : undefined,
        event: effectiveEvent || 'general',
        lang,
        title,
        body,
        payload,
        dedupeKey,
        channels: {
          inApp: {
            status: 'delivered',
            deliveredAt: new Date()
          },
          sms: {
            status: smsResult.status,
            providerRef: smsResult.providerRef,
            attempts: smsResult.attempts,
            sentAt: smsResult.sentAt
          }
        },
        read: false,
        bookingId: opts.bookingId || payload.bookingId || undefined,
        channel: shouldSendSms ? 'sms' : 'push',
        messageType: event,
        deliveryStatus: smsResult.status === 'sent' || smsResult.status === 'mock' ? 'sent' : 'delivered',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let savedNotification = null;

      if (mongoose.connection.readyState === 1) {
        try {
          const doc = new Notification(notificationData);
          savedNotification = await doc.save();
        } catch (dbErr) {
          logger.warn(`[Notifications] DB save error: ${dbErr.message}, falling back to in-memory`);
          savedNotification = { _id: new mongoose.Types.ObjectId(), ...notificationData };
          inMemoryNotifications.unshift(savedNotification);
        }
      } else {
        savedNotification = { _id: new mongoose.Types.ObjectId(), ...notificationData };
        inMemoryNotifications.unshift(savedNotification);
      }

      // 6. Socket.IO Real-time Push
      const io = opts.io || global.io || null;
      if (io) {
        const eventPayload = {
          notification: savedNotification,
          id: savedNotification._id,
          event,
          title,
          body,
          createdAt: savedNotification.createdAt
        };

        // Emit to targeted user room
        if (rec.id) {
          io.to(`user:${rec.id}`).emit('notification:new', eventPayload);
        }

        // If staff role notification, emit only to centre-scoped role room and/or district_admin
        if (rec.type === 'staff' || rec.type === 'role') {
          if (centreId && rec.role && rec.role !== 'district_admin') {
            io.to(`centre:${centreId}:role:${rec.role}`).emit('notification:new', eventPayload);
          }
          if (rec.role === 'district_admin') {
            io.to('district_admin').emit('notification:new', eventPayload);
          }
        }
      }

      return savedNotification;
    } catch (err) {
      logger.error(`[Notifications] notify() encountered an error: ${err.message}`, { stack: err.stack });
      throw err;
    }
  },

  /**
   * Fetch paginated notifications for a user (farmer or staff)
   */
  getUserNotifications: async ({ recipientId, unreadOnly = false, limit = 20 }) => {
    const lim = Math.min(100, Math.max(1, Number(limit) || 20));
    const query = { recipientId: recipientId.toString() };
    if (unreadOnly) {
      query.read = false;
    }

    if (mongoose.connection.readyState === 1) {
      return await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(lim)
        .lean();
    }

    // In-memory fallback
    return inMemoryNotifications
      .filter((n) => n.recipientId === recipientId.toString() && (!unreadOnly || !n.read))
      .slice(0, lim);
  },

  /**
   * Get unread notification count for user
   */
  getUnreadCount: async (recipientId) => {
    if (mongoose.connection.readyState === 1) {
      return await Notification.countDocuments({
        recipientId: recipientId.toString(),
        read: false
      });
    }
    return inMemoryNotifications.filter(
      (n) => n.recipientId === recipientId.toString() && !n.read
    ).length;
  },

  /**
   * Mark a single notification as read
   */
  markAsRead: async (notificationId, recipientId) => {
    const filter = { _id: notificationId };
    if (recipientId) {
      filter.recipientId = recipientId.toString();
    }

    if (mongoose.connection.readyState === 1) {
      return await Notification.findOneAndUpdate(
        filter,
        {
          read: true,
          readAt: new Date(),
          'channels.inApp.status': 'read'
        },
        { new: true }
      );
    }

    const n = inMemoryNotifications.find(
      (item) => item._id?.toString() === notificationId.toString() && (!recipientId || item.recipientId === recipientId.toString())
    );
    if (n) {
      n.read = true;
      n.readAt = new Date();
      if (n.channels?.inApp) n.channels.inApp.status = 'read';
    }
    return n;
  },

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead: async (recipientId) => {
    if (mongoose.connection.readyState === 1) {
      const result = await Notification.updateMany(
        { recipientId: recipientId.toString(), read: false },
        { read: true, readAt: new Date(), 'channels.inApp.status': 'read' }
      );
      return { count: result.modifiedCount };
    }

    let modified = 0;
    inMemoryNotifications.forEach((n) => {
      if (n.recipientId === recipientId.toString() && !n.read) {
        n.read = true;
        n.readAt = new Date();
        if (n.channels?.inApp) n.channels.inApp.status = 'read';
        modified++;
      }
    });
    return { count: modified };
  },

  // -------------------------------------------------------------------------
  // Legacy methods preserved for backward compatibility
  // -------------------------------------------------------------------------
  sendNotification: async ({ bookingId, channel, messageType, payload }) => {
    let context = null;
    if (bookingId) {
      context = await _resolvePhoneAndContext(bookingId);
    }

    const recipient = {
      id: context?.farmerId || 'legacy_farmer',
      type: 'farmer',
      phone: context?.phone || payload?.phone,
      lang: context?.lang || 'en',
      noSmartphone: context?.noSmartphone || false,
      smsSentCount: context?.smsSentCount || 0
    };

    return await notificationService.notify(recipient, messageType, { ...payload, bookingId, tokenNumber: context?.tokenNumber }, { bookingId });
  },

  getNotificationLog: async (bookingId) => {
    if (mongoose.connection.readyState === 1) {
      return await Notification.find({
        $or: [{ bookingId }, { 'payload.bookingId': bookingId.toString() }]
      }).sort({ createdAt: -1 });
    }
    return inMemoryNotifications.filter(
      (n) => n.bookingId?.toString() === bookingId.toString() || n.payload?.bookingId === bookingId.toString()
    );
  },

  retryNotification: async (notificationId) => {
    let notification = null;
    if (mongoose.connection.readyState === 1) {
      notification = await Notification.findById(notificationId);
    } else {
      notification = inMemoryNotifications.find((n) => n._id?.toString() === notificationId.toString());
    }

    if (!notification) {
      throw new Error(`Notification '${notificationId}' not found`);
    }

    const currentAttempts = notification.channels?.sms?.attempts || 0;
    if (currentAttempts >= 2) {
      throw new Error(`Maximum retry limit reached (2 attempts). Cannot retry notification '${notificationId}'.`);
    }

    // Perform retry dispatch
    const phone = notification.payload?.phone;
    const smsText = `KisanQ: ${notification.title}. ${notification.body}`;
    const result = await _fast2smsSend(phone, smsText);

    const updatedAttempts = currentAttempts + 1;
    const updates = {
      'channels.sms.attempts': updatedAttempts,
      'channels.sms.status': result.status,
      'channels.sms.sentAt': new Date(),
      deliveryStatus: result.status === 'sent' || result.status === 'mock' ? 'sent' : 'delivered'
    };
    if (result.providerRef) updates['channels.sms.providerRef'] = result.providerRef;

    if (mongoose.connection.readyState === 1) {
      return await Notification.findByIdAndUpdate(notificationId, { $set: updates }, { new: true });
    }

    Object.assign(notification, updates);
    return notification;
  },

  sendBookingConfirmation: async (bookingId) => {
    return [await notificationService.sendNotification({
      bookingId,
      channel: 'sms',
      messageType: 'booking_confirmed',
      payload: { message: 'Your booking has been confirmed.' }
    })];
  },

  sendWindowApproaching: async (bookingId) => {
    return notificationService.sendNotification({
      bookingId,
      channel: 'sms',
      messageType: 'window_approaching',
      payload: { message: 'Your arrival window is approaching.' }
    });
  },

  sendStatusUpdate: async (bookingId, statusMessage) => {
    return notificationService.sendNotification({
      bookingId,
      channel: 'push',
      messageType: 'status_update',
      payload: { message: statusMessage }
    });
  }
};

module.exports = notificationService;
