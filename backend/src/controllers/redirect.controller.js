'use strict';

const { successResponse, errorResponse } = require('../utils/apiResponse');
const {
  proposeRedirect,
  setInboundQuota,
  acceptOffer,
  declineOffer
} = require('../services/redirectService');
const { sendBroadcast } = require('../services/broadcastService');
const { RedirectOffer, InboundQuota, Broadcast, AuditLog } = require('../models');
const notificationService = require('../services/notificationService');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const redirectController = {
  /**
   * POST /api/planning/redirects
   * Body: { farmerId, toCentre, date, hour, distanceKm, toCentreHeatStatus }
   * Officer proposes a redirect for a specific farmer.
   */
  proposeRedirect: async (req, res) => {
    try {
      const { farmerId, toCentre, date, hour, distanceKm, toCentreHeatStatus } = req.body;
      const fromCentre = req.scopedCentreId || req.user?.assignedMandi || 'KPG-01';

      if (!farmerId || !toCentre || !date || hour === undefined) {
        return errorResponse(res, 'farmerId, toCentre, date, hour required', 400);
      }

      const offer = await proposeRedirect({
        farmerId, fromCentre, toCentre, date, hour,
        proposedBy: req.user?.id || req.user?._id,
        distanceKm, toCentreHeatStatus
      });

      if (!offer) {
        return errorResponse(res, 'No eligible booking found for this farmer (may be CHECKED_IN or no booking)', 422);
      }

      return successResponse(res, offer, 'Redirect offer created', 201);
    } catch (err) {
      logger.error(`[Redirect] proposeRedirect error: ${err.message}`);
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * POST /api/planning/inbound-quota
   * Body: { centreId, date, hour, count }
   */
  setInboundQuota: async (req, res) => {
    try {
      const { centreId, date, hour, count } = req.body;
      if (!centreId || !date || hour === undefined || !count) {
        return errorResponse(res, 'centreId, date, hour, count required', 400);
      }
      const officerCentre = (req.scopedCentreId || req.user?.assignedMandi || '').toUpperCase();
      if (req.user?.role !== 'district_admin' && officerCentre !== centreId.toUpperCase()) {
        return errorResponse(res, 'Access denied: can only set quota for own centre', 403);
      }
      const quota = await setInboundQuota({
        centreId, date, hour, count,
        setBy: req.user?.id || req.user?._id
      });
      return successResponse(res, quota, 'Inbound quota set');
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * GET /api/offers/redirect/mine (farmer only)
   * Returns pending redirect offers for the authenticated farmer.
   */
  getMyOffers: async (req, res) => {
    try {
      const farmerId = req.user?.id || req.user?._id;
      if (!farmerId) return errorResponse(res, 'Not authenticated', 401);
      if (mongoose.connection.readyState !== 1) return successResponse(res, [], 'Offers (offline)');
      const offers = await RedirectOffer.find({
        farmerId,
        status: { $in: ['pending', 'accepted', 'declined'] }
      }).sort({ createdAt: -1 }).limit(20).lean();
      return successResponse(res, offers, 'Redirect offers retrieved');
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * POST /api/offers/redirect/:id/accept
   */
  acceptOffer: async (req, res) => {
    try {
      const farmerId = req.user?.id || req.user?._id;
      if (!farmerId) return errorResponse(res, 'Not authenticated', 401);
      const result = await acceptOffer({ offerId: req.params.id, farmerId });
      return successResponse(res, result, 'Redirect accepted. New booking created at receiving centre.');
    } catch (err) {
      const status = err.message.includes('quota') ? 409 : (err.message.includes('expired') ? 410 : 400);
      return errorResponse(res, err.message, status);
    }
  },

  /**
   * POST /api/offers/redirect/:id/decline
   */
  declineOffer: async (req, res) => {
    try {
      const farmerId = req.user?.id || req.user?._id;
      if (!farmerId) return errorResponse(res, 'Not authenticated', 401);
      const offer = await declineOffer({ offerId: req.params.id, farmerId });
      return successResponse(res, offer, 'Redirect declined');
    } catch (err) {
      return errorResponse(res, err.message, 400);
    }
  },

  /**
   * POST /api/planning/broadcasts
   * Body: { centreId, text: { en, hi, mr } }
   */
  sendBroadcast: async (req, res) => {
    try {
      const { centreId, text } = req.body;
      if (!centreId || !text?.en) {
        return errorResponse(res, 'centreId and text.en required', 400);
      }
      const officerCentre = (req.scopedCentreId || req.user?.assignedMandi || '').toUpperCase();
      if (req.user?.role !== 'district_admin' && officerCentre !== centreId.toUpperCase()) {
        return errorResponse(res, 'Access denied: can only broadcast to own centre', 403);
      }
      const result = await sendBroadcast({
        centreId, text,
        sentBy: req.user?.id || req.user?._id,
        io: req.io
      });
      return successResponse(res, result, `Broadcast sent to ${result.notified} farmers`, 201);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
};

module.exports = redirectController;
