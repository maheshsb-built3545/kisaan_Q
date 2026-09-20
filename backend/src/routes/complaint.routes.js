const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaint.controller');
const { authenticateToken, optionalAuthenticate, scopeToCentre } = require('../middleware/auth.middleware');

/**
 * @route   POST /api/complaints
 * @desc    Farmer files a grievance for an active token (Gate -> Payout)
 * @access  Farmer (Authenticated via JWT only)
 */
router.post('/', authenticateToken, complaintController.createComplaint);

/**
 * @route   GET /api/complaints/my
 * @desc    Farmer views all grievances filed by them
 * @access  Farmer (Authenticated via JWT only)
 */
router.get('/my', authenticateToken, complaintController.getMyComplaints);

/**
 * @route   GET /api/complaints/all
 * @desc    District-wide list of complaints (District Admin / Admin)
 * @access  District Admin / Admin / Staff
 */
router.get('/all', authenticateToken, scopeToCentre, complaintController.getComplaints);

/**
 * @route   GET /api/complaints
 * @desc    List complaints (Supervisor filtered to centre, Admin/Officers read-only)
 * @access  Staff / Supervisor / Admin / Officer
 */
router.get('/', authenticateToken, scopeToCentre, complaintController.getComplaints);

/**
 * @route   GET /api/complaints/:id
 * @desc    Get single grievance detail
 */
router.get('/:id', optionalAuthenticate, complaintController.getComplaintById);

/**
 * @route   PATCH /api/complaints/:id/resolve
 * @desc    Supervisor resolves a grievance (Officers read-only)
 * @access  Supervisor
 */
router.patch('/:id/resolve', authenticateToken, scopeToCentre, complaintController.resolveComplaint);
router.put('/:id/resolve', authenticateToken, scopeToCentre, complaintController.resolveComplaint);

module.exports = router;
