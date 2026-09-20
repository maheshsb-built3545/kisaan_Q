const express = require('express');
const router = express.Router();
const fastTrackBiddingController = require('../controllers/fastTrackBidding.controller');
const { authenticateToken, optionalAuthenticate, scopeToCentre } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/fasttrack/rounds
 * @desc    List rounds (with centre / status filters)
 * @access  Public / Authenticated
 */
router.get('/rounds', optionalAuthenticate, fastTrackBiddingController.getRounds);

/**
 * @route   GET /api/fasttrack/rounds/:id
 * @desc    Get single round detail
 * @access  Public / Authenticated
 */
router.get('/rounds/:id', optionalAuthenticate, fastTrackBiddingController.getRoundById);

/**
 * @route   GET /api/fasttrack/rounds/:id/bids
 * @desc    Get bid history for a round
 * @access  Public / Authenticated
 */
router.get('/rounds/:id/bids', optionalAuthenticate, fastTrackBiddingController.getRoundBids);

/**
 * @route   POST /api/fasttrack/rounds/open
 * @desc    Open a new round for a centre slot
 * @access  Staff / Farmer (Authenticated)
 */
router.post('/rounds/open', authenticateToken, fastTrackBiddingController.openRound);

/**
 * @route   POST /api/fasttrack/rounds/:id/join
 * @desc    Farmer joins a round with their confirmed booking
 * @access  Farmer (Authenticated)
 */
router.post('/rounds/:id/join', authenticateToken, fastTrackBiddingController.joinRound);

/**
 * @route   POST /api/fasttrack/rounds/:id/request-start
 * @desc    Participant requests start when under quorum
 * @access  Farmer (Authenticated)
 */
router.post('/rounds/:id/request-start', authenticateToken, fastTrackBiddingController.requestStart);

/**
 * @route   POST /api/fasttrack/rounds/:id/bids
 * @desc    Place an atomic bid on a LIVE round
 * @access  Farmer (Authenticated)
 */
router.post('/rounds/:id/bids', authenticateToken, fastTrackBiddingController.placeBid);

/**
 * @route   POST /api/fasttrack/rounds/:id/start-decision
 * @desc    Centre Officer approves or declines start request
 * @access  Resource Officer / Supervisor / Admin
 */
router.post('/rounds/:id/start-decision', authenticateToken, scopeToCentre, fastTrackBiddingController.officerStartDecision);

/**
 * @route   POST /api/fasttrack/rounds/:id/decision
 * @desc    Centre Officer approves or declines winning bid
 * @access  Resource Officer / Supervisor / Admin
 */
router.post('/rounds/:id/decision', authenticateToken, scopeToCentre, fastTrackBiddingController.officerDecision);

module.exports = router;
