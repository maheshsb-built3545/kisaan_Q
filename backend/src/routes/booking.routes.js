const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All booking routes require authentication
router.use(authenticate);

// Create new booking reservation
router.post('/', bookingController.createBooking);

// Get my active & historical bookings (Farmer)
router.get('/my', bookingController.getMyBookings);

// Get booking details by ID
router.get('/:id', bookingController.getBookingById);

// Cancel booking (releases slot & records audit log)
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
