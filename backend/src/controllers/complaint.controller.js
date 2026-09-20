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
      const { tokenNumber, checkpoint, category, description } = req.body;

      if (!tokenNumber) {
        return errorResponse(res, 'Token number is required to file a complaint', 400);
      }
      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return errorResponse(res, 'Detailed complaint description is required (min 5 characters)', 400);
      }

      // Farmer identity derived strictly from authenticated session
      if (!req.user || !req.user.phone) {
        return errorResponse(res, 'Authentication required: Valid citizen farmer session required to file grievances.', 401);
      }
      const callerPhone = req.user.phone;
      const callerName = req.user.name || 'Citizen Farmer';

      // 1. Locate Token and validate
      const token = await Token.findOne({
        $or: [{ tokenNumber: tokenNumber.trim() }, { id: tokenNumber.trim() }]
      });

      if (!token) {
        return errorResponse(res, `Token '${tokenNumber}' not found. Please verify your token number.`, 404);
      }

      // 2. Validate Active Window (Gate -> Payout)
      if (token.status === 'CANCELLED' || token.status === 'Cancelled') {
        return errorResponse(res, 'Cannot file complaint on a cancelled token booking.', 400);
      }

      // 3. Verify Farmer Ownership
      const tokenPhone = token.farmerPhone || token.phone;
      const isStaff = ['supervisor', 'district_admin', 'resource_officer', 'staff', 'admin'].includes(req.user.role);
      if (!isStaff && tokenPhone && tokenPhone !== callerPhone) {
        return errorResponse(res, 'Forbidden: You can only file a grievance for your own confirmed token booking.', 403);
      }

      const canonicalCheckpoint = normalizeCheckpoint(checkpoint || (token.stages?.[token.currentStageIndex || 0]?.id));

      // 4. Rule: Exactly 1 open complaint per checkpoint per token
      const existingOpen = await Complaint.findOne({
        tokenNumber: token.tokenNumber,
        checkpoint: canonicalCheckpoint,
        status: { $in: ['PENDING', 'IN_INVESTIGATION', 'OPEN', 'INVESTIGATING'] }
      });
      if (existingOpen) {
        return errorResponse(
          res,
          `An active grievance (${existingOpen.complaintId}) already exists for this token at checkpoint '${canonicalCheckpoint}'. Only 1 active complaint per checkpoint per token is permitted.`,
          400
        );
      }

      // 5. Generate unique Complaint ID
      const year = new Date().getFullYear();
      const randDigits = String(Math.floor(1000 + Math.random() * 8999));
      const complaintId = `CMP-${year}-${randDigits}`;

      const complaintDoc = await Complaint.create({
        complaintId,
        tokenNumber: token.tokenNumber,
        tokenId: token._id,
        farmerId: req.user.id || token.farmerId || null,
        farmerName: isStaff ? (token.farmerName || callerName) : callerName,
        farmerPhone: isStaff ? (tokenPhone || callerPhone) : callerPhone,
        centreId: token.mandiId || 'KPG-01',
        mandiId: token.mandiId || 'KPG-01',
        mandiName: token.mandiName || 'APMC Mandi',
        checkpoint: canonicalCheckpoint,
        category: category || 'ASSAYING_DISPUTE',
        description: description.trim(),
        status: 'PENDING',
        source: isStaff ? 'staff' : 'farmer',
        assignedTo: 'Mandi Supervisor'
      });

      logger.info(`[Complaints] Created complaint ${complaintId} for token ${token.tokenNumber} at centre ${token.mandiId}`);

      // 6. Notify Mandi Supervisor
      try {
        await notificationService.notify({
          recipientPhone: '9800000008',
          recipientName: 'Mandi Supervisor',
          recipientRole: 'supervisor',
          templateKey: 'COMPLAINT_RECEIVED',
          centreId: token.mandiId,
          params: {
            complaintId,
            tokenNumber: token.tokenNumber,
            checkpoint: canonicalCheckpoint,
            farmerName: callerName,
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
   * @desc    List complaints (Supervisor filtered to centre, Admin/Officers read-only)
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
      if (req.query.source) filter.source = req.query.source;

      const complaints = await Complaint.find(filter).sort({ createdAt: -1 });

      return successResponse(res, { complaints, total: complaints.length }, 'Complaints retrieved successfully', 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  },

  /**
   * @route   GET /api/complaints/my
   * @desc    Farmer views all grievances filed by their authenticated session
   * @access  Farmer (Authenticated via JWT only)
   */
  getMyComplaints: async (req, res) => {
    try {
      const phone = req.user?.phone;
      if (!phone) {
        return errorResponse(res, 'Authentication required: Valid farmer session required to view grievance history', 401);
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

      // Mandatory resolution notes / reason
      if (!resolutionNotes || typeof resolutionNotes !== 'string' || !resolutionNotes.trim()) {
        return errorResponse(res, 'Resolution reason / notes is mandatory when resolving or declining a grievance.', 400);
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

      if (!complaint) {
        return errorResponse(res, `Complaint '${id}' not found`, 404);
      }

      // Check centre scoping for supervisor against complaint document
      if (userRole === 'supervisor' && req.user?.assignedMandi && complaint.centreId !== req.user.assignedMandi) {
        return errorResponse(res, `Access denied: Supervisor from ${req.user.assignedMandi} cannot resolve grievances at centre ${complaint.centreId}`, 403);
      }

      complaint.status = status;
      complaint.resolutionNotes = resolutionNotes.trim();
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
