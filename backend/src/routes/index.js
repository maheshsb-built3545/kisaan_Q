const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const bookingRoutes = require('./booking.routes');
const queueRoutes = require('./queue.routes');
const centreRoutes = require('./centre.routes');
const procurementRoutes = require('./procurement.routes');
const exceptionRoutes = require('./exception.routes');
const notificationRoutes = require('./notification.routes');
const adminRoutes = require('./admin.routes');
const auditRoutes = require('./audit.routes');
const tokenRoutes = require('./token.routes');
const farmerRoutes = require('./farmer.routes');
const cropPriceRoutes = require('./cropPrice.routes');
const fastTrackRoutes = require('./fastTrack.routes');
const voiceBookingRoutes = require('./voiceBooking.routes');

// Mount modular service routes
router.use('/auth', authRoutes);
router.use('/staff/fasttrack-requests', fastTrackRoutes);
router.use('/fasttrack', fastTrackRoutes);
router.use('/staff', authRoutes);
router.use('/farmers', farmerRoutes);
router.use('/farmer', farmerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/tokens', tokenRoutes);
router.use('/voice-booking', voiceBookingRoutes);
router.use('/voice', voiceBookingRoutes);

router.use('/queue', queueRoutes);
router.use('/centres', centreRoutes);
router.use('/prices', cropPriceRoutes);
router.use('/crop-prices', cropPriceRoutes);
router.use('/procurement', procurementRoutes);
router.use('/exceptions', exceptionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/audit', auditRoutes);

module.exports = router;

