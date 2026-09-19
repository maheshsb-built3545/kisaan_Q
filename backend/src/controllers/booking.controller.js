const bookingService = require('../services/bookingService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const bookingController = {
  createBooking: async (req, res) => {
    try {
      const farmerId = req.user.role === 'farmer' ? req.user.id : req.body.farmerId || req.user.id;
      const { centreId, crop, quantityBand, arrivalWindowStart, arrivalWindowEnd, channel } = req.body;

      const booking = await bookingService.createBooking({
        farmerId,
        centreId,
        crop,
        quantityBand,
        arrivalWindowStart,
        arrivalWindowEnd,
        channel: channel || 'app',
        actorId: req.user.id,
        actorRole: req.user.role
      });

      return successResponse(res, booking, 'Slot booked successfully', 201);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  getBookingById: async (req, res) => {
    try {
      const booking = await bookingService.getBookingById(req.params.id);
      return successResponse(res, booking, 'Booking details retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  },

  cancelBooking: async (req, res) => {
    try {
      const { reason } = req.body;
      const cancelled = await bookingService.cancelBooking(req.params.id, {
        actorId: req.user.id,
        actorRole: req.user.role,
        reason: reason || 'Farmer initiated cancellation'
      });

      return successResponse(res, cancelled, 'Booking cancelled and slot released');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  getMyBookings: async (req, res) => {
    try {
      const bookings = await bookingService.getFarmerBookings(req.user.id);
      return successResponse(res, bookings, 'Farmer bookings retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = bookingController;
