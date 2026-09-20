const express = require('express');
const router = express.Router();
const fastTrackBiddingController = require('../controllers/fastTrackBidding.controller');
const { authenticateToken, optionalAuthenticate } = require('../middleware/auth.middleware');

/**
 * @route   POST /api/fasttrack/rounds/start
 * @desc    Farmer starts a 100s Fast-Track bidding auction for their token
 * @access  Public / Farmer
 */
router.post('/rounds/start', optionalAuthenticate, fastTrackBiddingController.startRound);

/**
 * @route   POST /api/fasttrack/rounds/:id/bid
 * @desc    Place a higher discount bid (Resets timer to 100s, checks MSP floor)
 * @access  Public / Trader / Farmer
 */
router.post('/rounds/:id/bid', optionalAuthenticate, fastTrackBiddingController.placeBid);

/**
 * @route   GET /api/fasttrack/rounds/active
 * @desc    Get all active bidding rounds
 * @access  Public
 */
router.get('/rounds/active', optionalAuthenticate, fastTrackBiddingController.getActiveRounds);

/**
 * @route   GET /api/fasttrack/rounds/:id
 * @desc    Get single round detail
 * @access  Public
 */
router.get('/rounds/:id', optionalAuthenticate, fastTrackBiddingController.getRoundById);

/**
 * @route   GET /api/fasttrack/rounds/:id/bids
 * @desc    Get bid history for a round
 * @access  Public
 */
router.get('/rounds/:id/bids', optionalAuthenticate, fastTrackBiddingController.getRoundBids);

/**
 * @route   PATCH /api/fasttrack/rounds/:id/approve
 * @desc    Planning / Resource Officer approves winning bid
 * @access  Officer / Supervisor / Admin
 */
router.patch('/rounds/:id/approve', authenticateToken, fastTrackBiddingController.approveRound);

/**
 * @route   PATCH /api/fasttrack/rounds/:id/decline
 * @desc    Planning / Resource Officer declines round
 * @access  Officer / Supervisor / Admin
 */
router.patch('/rounds/:id/decline', authenticateToken, fastTrackBiddingController.declineRound);

module.exports = router;
