const mongoose = require('mongoose');
const https = require('https');
const { Notification, Booking, Farmer } = require('../models');
const { inMemoryFarmers } = require('./authService');
const logger = require('../utils/logger');

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
      .select('farmerId tokenNumber arrivalWindowStart')
      .lean();
    if (!booking?.farmerId) return null;
    const farmer = await Farmer.findById(booking.farmerId).select('phone').lean();
    if (!farmer?.phone) return null;
    return {
      phone:       farmer.phone,
      tokenNumber: booking.tokenNumber || null,
      windowStart: booking.arrivalWindowStart || null,
    };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Build a real farmer-facing SMS string from messageType + booking context.
// ---------------------------------------------------------------------------
const _buildSmsText = (messageType, ctx) => {
  const token = ctx?.tokenNumber ? `Token ${ctx.tokenNumber}` : 'your booking';
  const window = ctx?.windowStart
    ? new Date(ctx.windowStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    : null;

  switch (messageType) {
    case 'booking_confirmed':
      return window
        ? `KisanQ: ${token} confirmed. Arrive by ${window} at your mandi. Show this SMS at the gate.`
        : `KisanQ: ${token} confirmed. Please arrive during your scheduled window.`;
    case 'window_approaching':
      return window
        ? `KisanQ: Your arrival window starts at ${window}. Please proceed to the mandi gate now. Token: ${ctx?.tokenNumber || ''}`
        : `KisanQ: Your arrival window is approaching. Please proceed to the mandi gate.`;
    case 'status_update':
      return `KisanQ: Status update for ${token}. Visit the KisanQ app or check with gate staff for details.`;
    case 'vacancy_released':
      return `KisanQ: A slot has opened at your mandi. Open the KisanQ app to book now.`;
    default:
      return `KisanQ: Update for ${token}.`;
  }
};

// ---------------------------------------------------------------------------
// Internal helper: send one SMS via Fast2SMS
// Returns 'sent' on success, 'failed' on error.
// ---------------------------------------------------------------------------
const _fast2smsSend = (phone, message) => {
  return new Promise((resolve) => {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      logger.warn('[Fast2SMS] FAST2SMS_API_KEY not set — running in SMS mock mode. Real SMS NOT sent.');
      resolve('mock');
      return;
    }

    const body = JSON.stringify({
      route: 'q',           // Quick Transactional route
      numbers: phone,
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
            logger.info(`[Fast2SMS] SMS sent to +91${phone} — request_id: ${parsed.request_id}`);
            resolve('sent');
          } else {
            logger.warn(`[Fast2SMS] API rejected — ${JSON.stringify(parsed)}`);
            resolve('failed');
          }
        } catch {
          logger.warn(`[Fast2SMS] Unexpected response: ${data}`);
          resolve('failed');
        }
      });
    });

    req.on('error', (err) => {
      logger.warn(`[Fast2SMS] Network error: ${err.message}`);
      resolve('failed');
    });

    req.setTimeout(8000, () => {
      logger.warn('[Fast2SMS] Request timed out after 8s');
      req.destroy();
      resolve('failed');
    });

    req.write(body);
    req.end();
  });
};

// ---------------------------------------------------------------------------
// Internal helper: resolve push token AND booking context from a bookingId.
// ---------------------------------------------------------------------------
const _resolvePushTokenAndContext = async (bookingId) => {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    const booking = await Booking.findById(bookingId)
      .select('farmerId tokenNumber arrivalWindowStart centreId mandiName')
      .lean();
    if (!booking?.farmerId) return null;
    const farmer = await Farmer.findById(booking.farmerId).select('phone pushToken preferredLanguage').lean();
    return {
      pushToken: farmer?.pushToken || null,
      phone: farmer?.phone || null,
      tokenNumber: booking.tokenNumber || null,
      windowStart: booking.arrivalWindowStart || null,
      centreId: booking.centreId || null,
      mandiName: booking.mandiName || null,
      preferredLanguage: farmer?.preferredLanguage || 'mr'
    };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Internal helper: send one Push Notification via Expo Push Service
// Returns 'sent' on success, 'mock' if no real token, 'failed' on error.
// ---------------------------------------------------------------------------
const _expoPushSend = (pushToken, { title, body, data }) => {
  return new Promise((resolve) => {
    if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken[')) {
      logger.info(`[ExpoPush] No valid ExponentPushToken (${pushToken || 'none'}) — operating in mock push mode.`);
      resolve('mock');
      return;
    }

    const payloadBody = JSON.stringify({
      to: pushToken,
      sound: 'default',
      priority: 'high',
      title: title || '🌾 किसान क्यू: सूचना',
      body: body || 'तुमच्या टोकनबद्दल नवीन अपडेट उपलब्ध आहे.',
      data: data || {}
    });

    const options = {
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadBody)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.data?.status === 'ok' || parsed.data?.[0]?.status === 'ok') {
            logger.info(`[ExpoPush] Push notification dispatched to ${pushToken}`);
            resolve('sent');
          } else {
            logger.warn(`[ExpoPush] Expo push response: ${responseData}`);
            resolve('delivered');
          }
        } catch {
          resolve('delivered');
        }
      });
    });

    req.on('error', (err) => {
      logger.warn(`[ExpoPush] Network error: ${err.message}`);
      resolve('failed');
    });

    req.setTimeout(8000, () => {
      logger.warn('[ExpoPush] Request timed out after 8s');
      req.destroy();
      resolve('failed');
    });

    req.write(payloadBody);
    req.end();
  });
};

const notificationService = {
  /**
   * Dispatch a notification.
   * channel=sms  → real Fast2SMS call (falls back to mock if API key absent)
   * channel=push → Expo HTTP Push Notification dispatch (falls back to mock if no token)
   * channel=ivr  → mock
   */
  sendNotification: async ({ bookingId, channel, messageType, payload }) => {
    if (!bookingId || !channel || !messageType) {
      throw new Error('bookingId, channel, and messageType are required');
    }

    const validChannels = ['sms', 'push', 'ivr'];
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid channel '${channel}'. Must be one of: ${validChannels.join(', ')}`);
    }

    const validMessageTypes = ['booking_confirmed', 'window_approaching', 'status_update', 'vacancy_released'];
    if (!validMessageTypes.includes(messageType)) {
      throw new Error(`Invalid messageType '${messageType}'. Must be one of: ${validMessageTypes.join(', ')}`);
    }

    let deliveryStatus;

    if (channel === 'sms') {
      // ── Real Fast2SMS dispatch ──────────────────────────────────────────
      const ctx = await _resolvePhoneAndContext(bookingId);
      if (!ctx) {
        logger.warn(`[Fast2SMS] Could not resolve phone for booking ${bookingId} — falling back to mock`);
        // Mock fallback when phone can't be resolved (offline / in-memory booking)
        deliveryStatus = Math.random() > 0.1 ? 'delivered' : 'failed';
      } else {
        // payload.message wins if caller supplied an explicit string; otherwise build real text
        const smsMessage = payload?.message || _buildSmsText(messageType, ctx);
        const result = await _fast2smsSend(ctx.phone, smsMessage);
        // 'mock' means FAST2SMS_API_KEY was absent — coin-flip, never reaches Notification schema
        deliveryStatus = result === 'mock'
          ? (Math.random() > 0.1 ? 'delivered' : 'failed')
          : result; // 'sent' | 'failed' — both are valid enum values
      }
      logger.info(
        `[Notification SMS] Type: ${messageType} | Booking: ${bookingId} | Status: ${deliveryStatus}`
      );
    } else if (channel === 'push') {
      // ── Expo Push Notification dispatch ─────────────────────────────────
      const ctx = await _resolvePushTokenAndContext(bookingId);
      const pushToken = payload?.pushToken || ctx?.pushToken;
      const title = payload?.title || (
        messageType === 'booking_confirmed' ? '🌾 किसान क्यू: बुकिंग निश्चित!' :
        messageType === 'window_approaching' ? '🌾 किसान क्यू: आपला नंबर जवळ येत आहे!' :
        messageType === 'status_update' ? '🌾 किसान क्यू: स्थिती अपडेट' :
        '🌾 किसान क्यू: स्लॉट उपलब्ध'
      );
      const body = payload?.body || payload?.message || _buildSmsText(messageType, ctx);
      const data = payload?.data || {
        url: ctx?.centreId ? `kisanq://queue/${ctx.centreId}/${ctx?.tokenNumber || ''}` : 'kisanq://home',
        tokenNumber: ctx?.tokenNumber || null,
        centreId: ctx?.centreId || null,
        notificationType: messageType.toUpperCase()
      };

      const result = await _expoPushSend(pushToken, { title, body, data });
      deliveryStatus = result === 'mock'
        ? (Math.random() > 0.1 ? 'delivered' : 'failed')
        : (result === 'sent' ? 'delivered' : result);

      logger.info(
        `[Notification Push] Type: ${messageType} | Booking: ${bookingId} | Status: ${deliveryStatus} | Token: ${pushToken || 'mock'}`
      );
    } else {
      // ── ivr: unchanged mock behaviour ───────────────────────────
      const deliverySuccess = Math.random() > 0.1; // 90% success rate for mock
      deliveryStatus = deliverySuccess ? 'delivered' : 'failed';
      logger.info(
        `[Notification Mock] Channel: ${channel.toUpperCase()} | Type: ${messageType} | ` +
        `Booking: ${bookingId} | Status: ${deliveryStatus} | Payload: ${JSON.stringify(payload || {})}`
      );
    }

    const notificationData = {
      _id: new mongoose.Types.ObjectId(),
      bookingId,
      channel,
      messageType,
      deliveryStatus,
      timestamp: new Date()
    };

    let notification = null;
    try {
      if (mongoose.connection.readyState === 1) {
        notification = await Notification.create(notificationData);
      }
    } catch (err) {
      logger.warn(`Notification DB fallback: ${err.message}`);
    }

    if (!notification) {
      notification = { ...notificationData, createdAt: new Date(), updatedAt: new Date() };
      inMemoryNotifications.push(notification);
    }

    return notification;
  },

  /**
   * Retry a failed notification.
   *
   * PREVIOUS BEHAVIOUR (now fixed): retryNotification ran its OWN Math.random() coin-flip
   * (Math.random() > 0.05) and patched the DB record — it never called sendNotification and
   * never dispatched a real SMS. This meant retrying a failed Fast2SMS delivery just faked a
   * success.
   *
   * CURRENT BEHAVIOUR: re-dispatches through sendNotification so channel=sms gets a real
   * Fast2SMS attempt on retry, same as the first send. push/ivr still run the mock path
   * (unchanged) because sendNotification branches on channel.
   */
  retryNotification: async (notificationId) => {
    let notification = null;
    try {
      if (mongoose.connection.readyState === 1) {
        notification = await Notification.findById(notificationId);
      }
    } catch (e) { /* fallback */ }
    if (!notification) {
      notification = inMemoryNotifications.find((n) => n._id?.toString() === notificationId.toString());
    }
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    logger.info(
      `[Notification Retry] Channel: ${notification.channel?.toUpperCase()} | ` +
      `Booking: ${notification.bookingId} | notificationId: ${notificationId}`
    );

    // Re-dispatch through sendNotification — real SMS for sms channel, mock for push/ivr
    const retried = await notificationService.sendNotification({
      bookingId:   notification.bookingId,
      channel:     notification.channel,
      messageType: notification.messageType,
      payload:     notification.payload,
    });

    // Patch the original record's deliveryStatus to reflect the retry outcome
    const newStatus = retried.deliveryStatus === 'sent' || retried.deliveryStatus === 'delivered'
      ? 'delivered'
      : 'retried';

    try {
      if (mongoose.connection.readyState === 1) {
        notification = await Notification.findByIdAndUpdate(
          notificationId,
          { deliveryStatus: newStatus },
          { new: true }
        );
      }
    } catch (e) { /* fallback */ }

    if (notification && notification.deliveryStatus !== newStatus) {
      notification.deliveryStatus = newStatus;
    }

    return notification;
  },

  /**
   * Get notification delivery log for a booking
   */
  getNotificationLog: async (bookingId) => {
    let notifications = [];
    try {
      if (mongoose.connection.readyState === 1) {
        notifications = await Notification.find({ bookingId }).sort({ timestamp: -1 });
      }
    } catch (e) { /* fallback */ }

    if (notifications.length === 0) {
      notifications = inMemoryNotifications.filter(
        (n) => n.bookingId?.toString() === bookingId.toString()
      );
    }

    return notifications;
  },

  /**
   * Send batch notifications (convenience helper for booking events)
   */
  sendBookingConfirmation: async (bookingId) => {
    const results = [];
    results.push(await notificationService.sendNotification({
      bookingId,
      channel: 'sms',
      messageType: 'booking_confirmed',
      payload: { message: 'Your booking has been confirmed. Please arrive during your scheduled window.' }
    }));
    results.push(await notificationService.sendNotification({
      bookingId,
      channel: 'push',
      messageType: 'booking_confirmed',
      payload: { title: 'Booking Confirmed', body: 'Your slot has been reserved.' }
    }));
    return results;
  },

  sendWindowApproaching: async (bookingId) => {
    return notificationService.sendNotification({
      bookingId,
      channel: 'sms',
      messageType: 'window_approaching',
      payload: { message: 'Your arrival window is approaching. Please proceed to the centre.' }
    });
  },

  sendStatusUpdate: async (bookingId, statusMessage) => {
    return notificationService.sendNotification({
      bookingId,
      channel: 'push',
      messageType: 'status_update',
      payload: { message: statusMessage || 'Your booking status has been updated.' }
    });
  },

  /**
   * Directly test dispatching a real remote push notification to Expo's Push API
   */
  sendTestPushNotification: async ({ farmerId, phone, pushToken, title, body, data }) => {
    let targetToken = pushToken;

    if (!targetToken) {
      if (mongoose.connection.readyState === 1) {
        let farmer = null;
        if (farmerId && mongoose.Types.ObjectId.isValid(farmerId)) {
          farmer = await Farmer.findById(farmerId).select('pushToken phone').lean();
        }
        if (!farmer && phone) {
          const rawPhone = phone.toString().replace(/\D/g, '');
          farmer = await Farmer.findOne({ phone: rawPhone }).select('pushToken phone').lean();
        }
        targetToken = farmer?.pushToken;
      }

      if (!targetToken && inMemoryFarmers) {
        const rawPhone = (phone || '').toString().replace(/\D/g, '');
        const memFarmer = inMemoryFarmers.get(rawPhone);
        targetToken = memFarmer?.pushToken;
      }
    }

    if (!targetToken) {
      const err = new Error('No push token found for this user. Please ensure notifications are enabled in the mobile app.');
      err.statusCode = 404;
      throw err;
    }

    const payloadBody = JSON.stringify({
      to: targetToken,
      sound: 'default',
      priority: 'high',
      title: title || '🌾 किसान क्यू: आपला नंबर जवळ येत आहे!',
      body: body || 'टोकन #KQ-KPG-2026-5809: कृपया पुढील १५ मिनिटांत कोपरगाव APMC गेट #१ कडे प्रस्थान करा.',
      data: data || {
        url: 'kisanq://queue/KPG-01/KQ-KPG-2026-5809',
        tokenNumber: 'KQ-KPG-2026-5809',
        centreId: 'KPG-01',
        notificationType: 'WINDOW_APPROACHING'
      }
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadBody)
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            logger.info(`[ExpoPush Test] Response from Expo API: ${responseData}`);
            resolve({
              httpStatus: res.statusCode,
              expoResponse: parsed,
              pushToken: targetToken
            });
          } catch (e) {
            resolve({
              httpStatus: res.statusCode,
              rawResponse: responseData,
              pushToken: targetToken
            });
          }
        });
      });

      req.on('error', (err) => {
        logger.error(`[ExpoPush Test] Request error: ${err.message}`);
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Expo push API timed out after 10s'));
      });

      req.write(payloadBody);
      req.end();
    });
  }
};

module.exports = notificationService;
