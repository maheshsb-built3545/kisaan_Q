const mongoose = require('mongoose');
const { Complaint, Token, Farmer, StaffUser } = require('../models');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Checkpoints supported in the active farmer journey
const VALID_CHECKPOINTS = [
  'GATE_CHECKIN', 'QUALITY_GRADING', 'WEIGHBRIDGE', 'PROCUREMENT', 'PAYOUT',
  'gate', 'quality', 'weighbridge', 'procurement', 'payout',
  'gate_checkin', 'quality_grading'
];

/**
 * Normalizes checkpoint strings to standard uppercase key
 */
function normalizeCheckpoint(cp) {
  if (!cp) return 'GATE_CHECKIN';
  const clean = String(cp).toUpperCase().replace(/\s+/g, '_');
  if (clean.includes('GATE')) return 'GATE_CHECKIN';
  if (clean.includes('QUAL') || clean.includes('ASSAY') || clean.includes('GRADE')) return 'QUALITY_GRADING';
  if (clean.includes('WEIGH') || clean.includes('SCALE')) return 'WEIGHBRIDGE';
  if (clean.includes('PROC') || clean.includes('DEED') || clean.includes('AGREE')) return 'PROCUREMENT';
  if (clean.includes('PAY') || clean.includes('DBT') || clean.includes('RECEIPT')) return 'PAYOUT';
  return 'GATE_CHECKIN';
}

const complaintController = {
  /**
   * @route   POST /api/complaints
   * @desc    Farmer files a grievance for an active token (Gate -> Payout)
   * @access  Farmer / Authenticated
   */
  createComplaint: async (req, res) => {
    try {
      const { tokenNumber, checkpoint, category, description, phone, farmerPhone, farmerName } = req.body;

      if (!tokenNumber) {
        return errorResponse(res, 'Token number is required to file a complaint', 400);
      }
      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return errorResponse(res, 'Detailed complaint description is required (min 5 characters)', 400);
      }

      // 1. Locate Token and validate
      const token = await Token.findOne({
        $or: [{ tokenNumber: tokenNumber.trim() }, { id: tokenNumber.trim() }]
      });

      if (!token) {
        return errorResponse(res, `Token '${tokenNumber}' not found. Please verify your token number.`, 404);
      }

      // 2. Validate Active Window (Gate -> Payout)
      // Must not be cancelled
      if (token.status === 'CANCELLED' || token.status === 'Cancelled') {
        return errorResponse(res, 'Cannot file complaint on a cancelled token booking.', 400);
      }

      // 3. Verify Farmer Ownership (if caller is authenticated or phone provided)
      const effectivePhone = req.user?.phone || phone || farmerPhone;
      if (effectivePhone && token.farmerPhone && effectivePhone !== token.farmerPhone && token.phone && effectivePhone !== token.phone) {
        // Only allow if staff raising on farmer behalf
        const isStaff = req.user && ['supervisor', 'district_admin', 'resource_officer', 'staff'].includes(req.user.role);
        if (!isStaff) {
          return errorResponse(res, 'You are not authorized to file a complaint for another farmer\'s token.', 403);
        }
      }

      const effectiveFarmerName = farmerName || req.user?.name || token.farmerName || 'Farmer';
      const effectiveFarmerPhone = effectivePhone || token.farmerPhone || token.phone || '9876543210';
      const canonicalCheckpoint = normalizeCheckpoint(checkpoint || (token.stages?.[token.currentStageIndex || 0]?.id));

      // 4. Generate unique Complaint ID
      const year = new Date().getFullYear();
      const randDigits = String(Math.floor(1000 + Math.random() * 8999));
      const complaintId = `CMP-${year}-${randDigits}`;

      const complaintDoc = await Complaint.create({
        complaintId,
        tokenNumber: token.tokenNumber,
        tokenId: token._id,
        farmerId: req.user?.id || token.farmerId || null,
        farmerName: effectiveFarmerName,
        farmerPhone: effectiveFarmerPhone,
        centreId: token.mandiId || 'KPG-01',
        mandiId: token.mandiId || 'KPG-01',
        mandiName: token.mandiName || 'APMC Mandi',
        checkpoint: canonicalCheckpoint,
        category: category || 'QUALITY_DISPUTE',
        description: description.trim(),
        status: 'OPEN',
        source: req.user?.role && req.user.role !== 'farmer' ? 'staff' : 'farmer',
        assignedTo: 'Mandi Supervisor'
      });

      logger.info(`[Complaints] Created complaint ${complaintId} for token ${token.tokenNumber} at centre ${token.mandiId}`);

      // 5. Notify Mandi Supervisor
      try {
        await notificationService.notify({
          recipientPhone: '9800000008', // Default supervisor desk hotline
          recipientName: 'Mandi Supervisor',
          recipientRole: 'supervisor',
          templateKey: 'COMPLAINT_RECEIVED',
          centreId: token.mandiId,
          params: {
            complaintId,
            tokenNumber: token.tokenNumber,
            checkpoint: canonicalCheckpoint,
            farmerName: effectiveFarmerName,
            mandiName: token.mandiName
          }
        });
      } catch (notifErr) {
        logger.warn(`[Complaints] Supervisor notification note: ${notifErr.message}`);
      }

      return successResponse(res, complaintDoc, 'Complaint registered successfully. Mandi Supervisor has been notified.', 201);
    } catch (err) {
      logger.error(`[Complaints] createComplaint error: ${err.message}`);
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   GET /api/complaints
   * @desc    List complaints (Supervisor filtered to centre, Admin/Officer read-only)
   * @access  Staff / Supervisor / Admin / Officer
   */
  getComplaints: async (req, res) => {
    try {
      const user = req.user || {};
      const filter = {};

      // Role-based centre scoping
      if (user.role === 'supervisor' && user.assignedMandi) {
        if (req.query.centreId && req.query.centreId !== user.assignedMandi && req.query.centreId !== 'ALL') {
          return errorResponse(res, `Access denied: Supervisor assigned to '${user.assignedMandi}' cannot view complaints for '${req.query.centreId}'`, 403);
        }
        filter.centreId = user.assignedMandi;
      } else if (req.query.centreId && req.query.centreId !== 'ALL') {
        filter.centreId = req.query.centreId;
      }

      // Attribute filters
      if (req.query.status) filter.status = req.query.status;
      if (req.query.checkpoint) filter.checkpoint = normalizeCheckpoint(req.query.checkpoint);
      if (req.query.category) filter.category = req.query.category;
      if (req.query.tokenNumber) filter.tokenNumber = req.query.tokenNumber;

      const complaints = await Complaint.find(filter).sort({ createdAt: -1 });

      return successResponse(res, { complaints, total: complaints.length }, 'Complaints retrieved successfully', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   GET /api/complaints/my
   * @desc    Farmer views all grievances filed by their phone number
   * @access  Farmer / Public with phone
   */
  getMyComplaints: async (req, res) => {
    try {
      const phone = req.user?.phone || req.query.phone;
      if (!phone) {
        return errorResponse(res, 'Farmer phone is required to view grievance history', 400);
      }

      const complaints = await Complaint.find({ farmerPhone: phone }).sort({ createdAt: -1 });
      return successResponse(res, { complaints }, 'Grievance history retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   GET /api/complaints/:id
   * @desc    Get single complaint detail
   */
  getComplaintById: async (req, res) => {
    try {
      const { id } = req.params;
      const query = mongoose.Types.ObjectId.isValid(id)
        ? { $or: [{ _id: id }, { complaintId: id }] }
        : { complaintId: id };
      const complaint = await Complaint.findOne(query);

      if (!complaint) {
        return errorResponse(res, `Complaint '${id}' not found`, 404);
      }

      return successResponse(res, complaint, 'Complaint details retrieved', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   PATCH /api/complaints/:id/resolve
   * @desc    Supervisor resolves or updates status of a farmer grievance
   * @access  Supervisor
   */
  resolveComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { status = 'RESOLVED', resolutionNotes, centreId } = req.body;

      // Staff RBAC check: only supervisor can resolve
      if (!req.user || !req.user.role) {
        return errorResponse(res, 'Authentication required to resolve complaints.', 401);
      }
      const userRole = req.user.role;
      if (userRole === 'district_admin') {
        return errorResponse(res, 'Access denied: District Admin role has district-wide read-only access. Only local Mandi Supervisor can resolve grievances.', 403);
      }
      if (!['supervisor', 'admin'].includes(userRole)) {
        return errorResponse(res, 'Access denied: Only Mandi Supervisor can resolve complaints (Officers have read-only view).', 403);
      }

      // Check explicit centreId param or body
      const targetCentre = req.params.centreId || req.body?.centreId || centreId;
      if (userRole === 'supervisor' && req.user?.assignedMandi && targetCentre && targetCentre !== req.user.assignedMandi) {
        return errorResponse(res, `Access denied: Supervisor from '${req.user.assignedMandi}' cannot resolve grievances for centre '${targetCentre}'.`, 403);
      }

      const query = mongoose.Types.ObjectId.isValid(id)
        ? { $or: [{ _id: id }, { complaintId: id }] }
        : { complaintId: id };
      const complaint = await Complaint.findOne(query);

      if (!complaint && id === 'CMP-2026-0001') {
        return errorResponse(res, `Complaint '${id}' not found`, 404);
      }
      if (!complaint) {
        return errorResponse(res, `Complaint '${id}' not found`, 404);
      }

      // Check centre scoping for supervisor against complaint document
      if (userRole === 'supervisor' && req.user?.assignedMandi && complaint.centreId !== req.user.assignedMandi) {
        return errorResponse(res, `Access denied: Supervisor from ${req.user.assignedMandi} cannot resolve grievances at centre ${complaint.centreId}`, 403);
      }

      complaint.status = status;
      complaint.resolutionNotes = resolutionNotes || 'Issue addressed and resolved by Mandi Supervisor';
      complaint.resolvedBy = req.user?.name || req.user?.role || 'Supervisor Desk';
      complaint.resolvedAt = new Date();

      await complaint.save();

      logger.info(`[Complaints] Complaint ${complaint.complaintId} resolved with status '${status}' by ${complaint.resolvedBy}`);

      // Notify Farmer
      try {
        await notificationService.notify({
          recipientPhone: complaint.farmerPhone,
          recipientName: complaint.farmerName,
          recipientRole: 'farmer',
          templateKey: 'COMPLAINT_RESOLVED',
          centreId: complaint.centreId,
          params: {
            complaintId: complaint.complaintId,
            resolutionNotes: complaint.resolutionNotes,
            mandiName: complaint.mandiName
          }
        });
      } catch (notifErr) {
        logger.warn(`[Complaints] Farmer resolution notify note: ${notifErr.message}`);
      }

      return successResponse(res, complaint, `Complaint marked as ${status} successfully.`, 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
};

module.exports = complaintController;
