const express = require('express');
const router = express.Router();
const fastTrackBiddingController = require('../controllers/fastTrackBidding.controller');
const { authenticateToken, optionalAuthenticate, scopeToCentre } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

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
 * @access  Resource Officer / Supervisor / Admin / System
 */
router.post(
  '/rounds/open',
  authenticateToken,
  checkRole('resource_officer', 'supervisor', 'admin', 'system'),
  scopeToCentre,
  fastTrackBiddingController.openRound
);

/**
 * @route   POST /api/fasttrack/rounds/:id/join
 * @desc    Farmer joins a round with their confirmed booking
 * @access  Farmer (Authenticated)
 */
router.post('/rounds/:id/join', authenticateToken, checkRole('farmer'), fastTrackBiddingController.joinRound);

/**
 * @route   POST /api/fasttrack/rounds/:id/request-start
 * @desc    Participant requests start when under quorum
 * @access  Farmer (Authenticated)
 */
router.post('/rounds/:id/request-start', authenticateToken, checkRole('farmer'), fastTrackBiddingController.requestStart);

/**
 * @route   POST /api/fasttrack/rounds/:id/bids
 * @desc    Place an atomic bid on a LIVE round
 * @access  Farmer (Authenticated)
 */
router.post('/rounds/:id/bids', authenticateToken, checkRole('farmer'), fastTrackBiddingController.placeBid);

/**
 * @route   POST /api/fasttrack/rounds/:id/start-decision
 * @desc    Centre Officer approves or declines start request
 * @access  Resource Officer / Supervisor / Admin
 */
router.post(
  '/rounds/:id/start-decision',
  authenticateToken,
  checkRole('resource_officer', 'supervisor', 'admin'),
  scopeToCentre,
  fastTrackBiddingController.officerStartDecision
);

/**
 * @route   POST /api/fasttrack/rounds/:id/decision
 * @desc    Centre Officer approves or declines winning bid
 * @access  Resource Officer / Supervisor / Admin
 */
router.post(
  '/rounds/:id/decision',
  authenticateToken,
  checkRole('resource_officer', 'supervisor', 'admin'),
  scopeToCentre,
  fastTrackBiddingController.officerDecision
);

// ============================================================================
// DOCUMENTED ALIASES (Backward Compatibility)
// ============================================================================

/**
 * @route   POST /api/fasttrack/rounds/:id/bid
 * @desc    Alias for POST /api/fasttrack/rounds/:id/bids (singular alias)
 */
router.post('/rounds/:id/bid', authenticateToken, checkRole('farmer'), fastTrackBiddingController.placeBid);

/**
 * @route   PATCH /api/fasttrack/rounds/:id/approve
 * @desc    Legacy alias for POST /api/fasttrack/rounds/:id/decision (approved: true)
 */
router.patch(
  '/rounds/:id/approve',
  authenticateToken,
  checkRole('resource_officer', 'supervisor', 'admin'),
  scopeToCentre,
  (req, res) => {
    req.body = { ...req.body, approved: true };
    return fastTrackBiddingController.officerDecision(req, res);
  }
);

/**
 * @route   PATCH /api/fasttrack/rounds/:id/decline
 * @desc    Legacy alias for POST /api/fasttrack/rounds/:id/decision (approved: false)
 */
router.patch(
  '/rounds/:id/decline',
  authenticateToken,
  checkRole('resource_officer', 'supervisor', 'admin'),
  scopeToCentre,
  (req, res) => {
    req.body = { ...req.body, approved: false };
    return fastTrackBiddingController.officerDecision(req, res);
  }
);

/**
 * @route   POST /api/fasttrack/:id/approve
 * @desc    Legacy alias for POST /api/fasttrack/rounds/:id/decision (approved: true)
 */
router.post(
  '/:id/approve',
  authenticateToken,
  checkRole('resource_officer', 'supervisor', 'admin'),
  scopeToCentre,
  (req, res) => {
    req.body = { ...req.body, approved: true };
    return fastTrackBiddingController.officerDecision(req, res);
  }
);

/**
 * @route   POST /api/fasttrack/:id/reject
 * @desc    Legacy alias for POST /api/fasttrack/rounds/:id/decision (approved: false)
 */
router.post(
  '/:id/reject',
  authenticateToken,
  checkRole('resource_officer', 'supervisor', 'admin'),
  scopeToCentre,
  (req, res) => {
    req.body = { ...req.body, approved: false };
    return fastTrackBiddingController.officerDecision(req, res);
  }
);

/**
 * @route   GET /api/fasttrack
 * @desc    Alias for GET /api/fasttrack/rounds
 */
router.get('/', optionalAuthenticate, fastTrackBiddingController.getRounds);

module.exports = router;

