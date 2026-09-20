const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaint.controller');
const { authenticateToken, optionalAuthenticate } = require('../middleware/auth.middleware');

/**
 * @route   POST /api/complaints
 * @desc    Farmer files a grievance for an active token (Gate -> Payout)
 * @access  Public / Farmer (optional token or phone)
 */
router.post('/', optionalAuthenticate, complaintController.createComplaint);

/**
 * @route   GET /api/complaints/my
 * @desc    Farmer views all grievances filed by them
 * @access  Farmer / Public
 */
router.get('/my', optionalAuthenticate, complaintController.getMyComplaints);

/**
 * @route   GET /api/complaints/all
 * @desc    District-wide list of complaints (District Admin / Admin)
 * @access  District Admin / Admin / Staff
 */
router.get('/all', optionalAuthenticate, complaintController.getComplaints);

/**
 * @route   GET /api/complaints
 * @desc    List complaints (Supervisor filtered to centre, Admin/Officers read-only)
 * @access  Staff / Supervisor / Admin / Officer
 */
router.get('/', optionalAuthenticate, complaintController.getComplaints);

/**
 * @route   GET /api/complaints/:id
 * @desc    Get single grievance detail
 */
router.get('/:id', optionalAuthenticate, complaintController.getComplaintById);

/**
 * @route   PATCH /api/complaints/:id/resolve
 * @desc    Supervisor resolves a grievance (Officers read-only)
 * @access  Supervisor / District Admin
 */
router.patch('/:id/resolve', authenticateToken, complaintController.resolveComplaint);
router.put('/:id/resolve', authenticateToken, complaintController.resolveComplaint);

module.exports = router;
