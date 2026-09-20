'use strict';

const express = require('express');
const router = express.Router();
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { getHeatStatus } = require('../config/forecast');
const { computeDayForecast } = require('../services/forecastService');
const { Booking } = require('../models');
const mongoose = require('mongoose');

/**
 * Public endpoint: day-load colour for a centre on a given date.
 * Used by farmer booking date picker to show Green/Amber/Red.
 * No authentication required.
 *
 * GET /api/centres/:id/day-load?date=YYYY-MM-DD
 * Returns: { centreId, date, heatStatus: 'Green'|'Amber'|'Red', label: 'rule-based' }
 */
router.get('/:id/day-load', async (req, res) => {
  try {
    const centreId = (req.params.id || 'KPG-01').toUpperCase();
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    let bookings = [];
    if (mongoose.connection.readyState === 1) {
      const { Centre } = require('../models');
      const centreDoc = await Centre.findOne({ code: centreId }).select('_id').lean();
      if (centreDoc) {
        const startOfDay = new Date(date + 'T00:00:00.000Z');
        const endOfDay = new Date(date + 'T23:59:59.999Z');
        bookings = await Booking.find({
          centreId: centreDoc._id,
          arrivalWindowStart: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] }
        }).select('quantityBand').lean();
      }
    }

    const forecast = computeDayForecast(centreId, date, bookings);

    return successResponse(res, {
      centreId,
      date,
      heatStatus: forecast.heatStatus,
      label: 'rule-based'
    }, 'Day load colour retrieved');
  } catch (err) {
    return errorResponse(res, 'Failed to retrieve day load', 500, err.message);
  }
});

module.exports = router;
