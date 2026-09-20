const fastTrackAuctionService = require('../services/fastTrackAuctionService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const fastTrackBiddingController = {
  /**
   * @route   GET /api/fasttrack/rounds
   * @desc    List rounds (filtered by centreId, status, slotDate)
   * @access  Public / Authenticated
   */
  getRounds: async (req, res) => {
    try {
      const { centreId, status, slotDate } = req.query;
      const rounds = await fastTrackAuctionService.getRounds({ centreId, status, slotDate });
      return successResponse(res, { rounds, total: rounds.length }, 'Fast-track rounds retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   GET /api/fasttrack/rounds/:id
   * @desc    Get single round detail
   * @access  Public / Authenticated
   */
  getRoundById: async (req, res) => {
    try {
      const { id } = req.params;
      const round = await fastTrackAuctionService.getRoundById(id);
      if (!round) {
        return errorResponse(res, `Round '${id}' not found`, 404);
      }
      return successResponse(res, round, 'Round detail retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   POST /api/fasttrack/rounds/open
   * @desc    Open a new round for a centre slot hour
   * @access  Staff / System / Farmer
   */
  openRound: async (req, res) => {
    try {
      const { centreId, mandiId, mandiName, slotDate, slotHour } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      const round = await fastTrackAuctionService.openRound({
        centreId,
        mandiId,
        mandiName,
        slotDate,
        slotHour,
        actor: req.user,
        io
      });

      return successResponse(res, round, `Fast-track round opened (${round.roundId})`, 201);
    } catch (err) {
      const status = err.statusCode || 400;
      return errorResponse(res, err.message, status);
    }
  },

  /**
   * @route   POST /api/fasttrack/rounds/:id/join
   * @desc    Farmer joins a round with their confirmed booking
   * @access  Farmer (Authenticated)
   */
  joinRound: async (req, res) => {
    try {
      const { id } = req.params;
      const { tokenNumber, bookingId } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      if (!req.user || !req.user.phone) {
        return errorResponse(res, 'Authentication required: Valid citizen farmer session required.', 401);
      }

      const round = await fastTrackAuctionService.joinRound({
        roundId: id,
        farmerUser: req.user,
        tokenNumber,
        bookingId,
        io
      });

      return successResponse(res, round, `Joined fast-track round (${round.roundId})`, 200);
    } catch (err) {
      const status = err.statusCode || 400;
      return errorResponse(res, err.message, status);
    }
  },

  /**
   * @route   POST /api/fasttrack/rounds/:id/request-start
   * @desc    Participant requests start when < 5 participants
   * @access  Farmer (Authenticated)
   */
  requestStart: async (req, res) => {
    try {
      const { id } = req.params;
      const io = req.io || req.app?.get('io') || req.app?.io;

      if (!req.user || !req.user.phone) {
        return errorResponse(res, 'Authentication required', 401);
      }

      const round = await fastTrackAuctionService.requestStart({
        roundId: id,
        farmerUser: req.user,
        io
      });

      return successResponse(res, round, 'Start request submitted to centre officer', 200);
    } catch (err) {
      const status = err.statusCode || 400;
      return errorResponse(res, err.message, status);
    }
  },

  /**
   * @route   POST /api/fasttrack/rounds/:id/start-decision
   * @desc    Officer approves or declines start request
   * @access  Officer (Authenticated)
   */
  officerStartDecision: async (req, res) => {
    try {
      const { id } = req.params;
      const { approved, reason } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      const round = await fastTrackAuctionService.officerStartDecision({
        roundId: id,
        officerUser: req.user,
        approved: approved === true || approved === 'true',
        reason,
        io
      });

      return successResponse(
        res,
        round,
        approved ? 'Start request approved. Round is LIVE with 100s timer.' : 'Start request declined.',
        200
      );
    } catch (err) {
      const status = err.statusCode || 400;
      return errorResponse(res, err.message, status);
    }
  },

  /**
   * @route   POST /api/fasttrack/rounds/:id/bids
   * @desc    Place atomic bid on LIVE round
   * @access  Farmer (Authenticated)
   */
  placeBid: async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, simulatedNow } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      if (!req.user || !req.user.phone) {
        return errorResponse(res, 'Authentication required: Valid citizen farmer session required.', 401);
      }

      const result = await fastTrackAuctionService.placeBid({
        roundId: id,
        farmerUser: req.user,
        amount,
        simulatedNow,
        io
      });

      return successResponse(
        res,
        result,
        `Bid of ₹${amount} placed successfully. Server countdown reset to 100s.`,
        201
      );
    } catch (err) {
      const status = err.statusCode || 400;
      return errorResponse(res, err.message, status);
    }
  },

  /**
   * @route   POST /api/fasttrack/rounds/:id/decision
   * @desc    Officer approves or declines winning bid
   * @access  Officer (Authenticated)
   */
  officerDecision: async (req, res) => {
    try {
      const { id } = req.params;
      const { approved, reason } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      const result = await fastTrackAuctionService.officerDecision({
        roundId: id,
        officerUser: req.user,
        approved: approved === true || approved === 'true',
        reason,
        io
      });

      return successResponse(
        res,
        result,
        approved ? 'Fast-track commitment approved. Booking prioritized.' : 'Bid declined and leadership cascaded.',
        200
      );
    } catch (err) {
      const status = err.statusCode || 400;
      return errorResponse(res, err.message, status);
    }
  },

  /**
   * @route   GET /api/fasttrack/rounds/:id/bids
   * @desc    Get bid history for a round
   * @access  Public / Authenticated
   */
  getRoundBids: async (req, res) => {
    try {
      const { id } = req.params;
      const bids = await fastTrackAuctionService.getBidsForRound(id);
      return successResponse(res, { bids, total: bids.length }, 'Bid history retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
};

module.exports = fastTrackBiddingController;
