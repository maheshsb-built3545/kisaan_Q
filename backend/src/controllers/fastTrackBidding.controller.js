const fastTrackAuctionService = require('../services/fastTrackAuctionService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const fastTrackBiddingController = {
  /**
   * @route   POST /api/fasttrack/rounds/start
   * @desc    Start an auction round for an active token
   */
  startRound: async (req, res) => {
    try {
      const { tokenNumber, phone, startingBid = 10, timerSeconds = 100 } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      const round = await fastTrackAuctionService.startAuctionRound({
        tokenNumber,
        phone: phone || req.user?.phone,
        startingBid,
        timerSeconds,
        io
      });

      return successResponse(res, round, `Fast-Track bidding round started for Token #${tokenNumber} (100s timer active)`, 201);
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return errorResponse(res, err.message, statusCode);
    }
  },

  /**
   * @route   POST /api/fasttrack/rounds/:id/bid
   * @desc    Place a bid in active round (resets 100s timer)
   */
  placeBid: async (req, res) => {
    try {
      const { id } = req.params;
      const { bidDiscountPerQtl, bidderPhone, bidderName } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      const effectivePhone = bidderPhone || req.user?.phone || '9876543210';
      const effectiveName = bidderName || req.user?.name || 'Trader / Buyer';

      const result = await fastTrackAuctionService.placeBid({
        roundId: id,
        bidderPhone: effectivePhone,
        bidderName: effectiveName,
        bidDiscountPerQtl,
        now: req.body.simulatedNow ? new Date(req.body.simulatedNow) : new Date(),
        io
      });

      return successResponse(res, result, `Bid of ₹${bidDiscountPerQtl}/Qtl placed successfully. Timer reset to 100 seconds.`, 200);
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return errorResponse(res, err.message, statusCode);
    }
  },

  /**
   * @route   GET /api/fasttrack/rounds/active
   * @desc    Get all active Fast-Track rounds
   */
  getActiveRounds: async (req, res) => {
    try {
      const filter = {};
      if (req.query.centreId) filter.centreId = req.query.centreId;
      if (req.query.crop) filter.crop = req.query.crop;

      const rounds = await fastTrackAuctionService.getActiveRounds(filter);
      return successResponse(res, { rounds, total: rounds.length }, 'Active bidding rounds retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   GET /api/fasttrack/rounds/:id
   * @desc    Get single round detail
   */
  getRoundById: async (req, res) => {
    try {
      const { id } = req.params;
      const round = await fastTrackAuctionService.getRoundById(id);
      if (!round) {
        return errorResponse(res, `Round '${id}' not found`, 404);
      }
      return successResponse(res, round, 'Round details retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   GET /api/fasttrack/rounds/:id/bids
   * @desc    Get bid history for a round
   */
  getRoundBids: async (req, res) => {
    try {
      const { id } = req.params;
      const bids = await fastTrackAuctionService.getBidsForRound(id);
      return successResponse(res, { bids, total: bids.length }, 'Bids retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   PATCH /api/fasttrack/rounds/:id/approve
   * @desc    Planning / Resource Officer approves winning bid
   */
  approveRound: async (req, res) => {
    try {
      const { id } = req.params;
      const { decisionNotes } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      const result = await fastTrackAuctionService.approveWinningBid({
        roundId: id,
        officerUser: req.user,
        decisionNotes,
        io
      });

      return successResponse(res, result, 'Winning bid approved. Token prioritized to front of queue.', 200);
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return errorResponse(res, err.message, statusCode);
    }
  },

  /**
   * @route   PATCH /api/fasttrack/rounds/:id/decline
   * @desc    Planning / Resource Officer declines round
   */
  declineRound: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const io = req.io || req.app?.get('io') || req.app?.io;

      const round = await fastTrackAuctionService.declineRound({
        roundId: id,
        officerUser: req.user,
        reason,
        io
      });

      return successResponse(res, round, 'Fast-Track round declined', 200);
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return errorResponse(res, err.message, statusCode);
    }
  }
};

module.exports = fastTrackBiddingController;
