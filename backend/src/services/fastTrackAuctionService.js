/**
 * KisanQ Rule-Based Fast-Track Auction Service (PRD Section 2.5)
 * 
 * Rule-based auction with human approval.
 * - Farmer bids commit an amount from their payout
 * - 100s server countdown with atomic conditional updates
 * - Quorum threshold of 5 (or officer start approval)
 * - Officer approval / mandatory-reason decline workflow
 * - Full notification and AuditLog wiring per step
 */

const mongoose = require('mongoose');
const FastTrackRound = require('../models/FastTrackRound');
const FastTrackBid = require('../models/FastTrackBid');
const Token = require('../models/Token');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const notificationService = require('./notificationService');
const fastTrackConfig = require('../config/fastTrackConfig');
const logger = require('../utils/logger');

/**
 * Audit log helper
 */
async function recordAudit(actor, action, targetId, details = {}, centreId = null) {
  try {
    if (mongoose.connection.readyState === 1) {
      await AuditLog.create({
        actorId: actor?.id || actor?._id || 'SYSTEM',
        actorRole: actor?.role || 'system',
        actorName: actor?.name || 'System Worker',
        action,
        targetId: targetId?.toString(),
        centreId: centreId || actor?.assignedMandi || null,
        details,
        reason: details.reason || details.notes || null,
        timestamp: new Date()
      });
    }
  } catch (e) {
    logger.warn(`[FastTrack] Audit log notice: ${e.message}`);
  }
}

/**
 * Emit socket event helper
 */
function emitSocket(io, centreId, event, data) {
  if (!io) return;
  try {
    io.to(`mandi_${centreId}`).emit(event, data);
    io.emit(event, data); // Global broadcast for dashboards
  } catch (e) {
    logger.warn(`[FastTrack] Socket emit notice: ${e.message}`);
  }
}

const fastTrackAuctionService = {
  /**
   * Open or retrieve an existing round for a centre, date, and slot hour
   */
  openRound: async ({ centreId, mandiId, mandiName, slotDate, slotHour, actor = null, io = null }) => {
    if (!centreId || !slotDate || !slotHour) {
      const err = new Error('centreId, slotDate, and slotHour are required to open a round');
      err.statusCode = 400;
      throw err;
    }

    const effectiveMandiId = mandiId || centreId;
    const effectiveMandiName = mandiName || 'APMC Mandi';

    // Check cap per hour
    const activeCount = await FastTrackRound.countDocuments({
      centreId,
      slotDate,
      slotHour,
      status: { $in: ['JOINING', 'START_REQUESTED', 'LIVE', 'AWAITING_APPROVAL', 'APPROVED'] }
    });

    if (activeCount >= fastTrackConfig.capPerHour) {
      const existing = await FastTrackRound.findOne({
        centreId,
        slotDate,
        slotHour,
        status: { $in: ['JOINING', 'START_REQUESTED', 'LIVE'] }
      });
      if (existing) return existing;

      const err = new Error(`Fast-track capacity reached: Maximum ${fastTrackConfig.capPerHour} rounds per hour for this centre.`);
      err.statusCode = 429;
      throw err;
    }

    const roundId = `FTR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const round = await FastTrackRound.create({
      roundId,
      centreId,
      mandiId: effectiveMandiId,
      mandiName: effectiveMandiName,
      slotDate,
      slotHour,
      status: 'JOINING',
      participants: [],
      candidateQueue: [],
      currentLeader: null,
      reserveFee: fastTrackConfig.reserveFee,
      bidStep: fastTrackConfig.bidStep,
      bidCeiling: fastTrackConfig.bidCeiling,
      capPerHour: fastTrackConfig.capPerHour
    });

    await recordAudit(actor || { id: 'SYSTEM', role: 'system' }, 'FAST_TRACK_ROUND_OPENED', round.roundId, {
      centreId,
      slotDate,
      slotHour
    }, centreId);

    emitSocket(io, centreId, 'fasttrack:round', round);
    return round;
  },

  /**
   * Join an open round (Farmer with confirmed booking)
   */
  joinRound: async ({ roundId, farmerUser, tokenNumber, bookingId, io = null }) => {
    if (!farmerUser || !farmerUser.id || !farmerUser.phone) {
      const err = new Error('Authentication required: Valid farmer credentials required.');
      err.statusCode = 401;
      throw err;
    }

    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (!['JOINING', 'START_REQUESTED', 'LIVE'].includes(round.status)) {
      const err = new Error(`Cannot join round in '${round.status}' status`);
      err.statusCode = 400;
      throw err;
    }

    // 1. Validate confirmed booking belonging to this farmer
    const bookingQuery = {
      $or: [
        { tokenNumber: tokenNumber || '' },
        { id: tokenNumber || '' },
        { _id: mongoose.Types.ObjectId.isValid(bookingId) ? bookingId : new mongoose.Types.ObjectId() }
      ]
    };

    let tokenDoc = await Token.findOne(bookingQuery);
    if (!tokenDoc) {
      tokenDoc = await Booking.findOne(bookingQuery);
    }

    if (!tokenDoc) {
      const err = new Error(`Confirmed booking not found for token '${tokenNumber}'`);
      err.statusCode = 404;
      throw err;
    }

    // Check ownership: phone must match
    const tokenPhone = tokenDoc.farmerPhone || tokenDoc.phone;
    if (tokenPhone !== farmerUser.phone) {
      const err = new Error('Forbidden: You can only join fast-track bidding using your own confirmed booking.');
      err.statusCode = 403;
      throw err;
    }

    // Check centre & date match
    if (tokenDoc.mandiId !== round.centreId && tokenDoc.mandiId !== round.mandiId) {
      const err = new Error(`Booking centre (${tokenDoc.mandiId}) does not match round centre (${round.centreId}).`);
      err.statusCode = 400;
      throw err;
    }

    // Check booking status
    if (['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'].includes(tokenDoc.status)) {
      const err = new Error(`Cannot use booking in '${tokenDoc.status}' status for fast-track bidding.`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Rule: One fast-track per farmer per day
    const existingParticipation = await FastTrackRound.findOne({
      _id: { $ne: round._id },
      slotDate: round.slotDate,
      'participants.phone': farmerUser.phone,
      status: { $in: ['APPROVED', 'LIVE', 'AWAITING_APPROVAL'] }
    });

    if (existingParticipation) {
      const err = new Error('Rule limit: Only one fast-track participation per farmer per day is permitted.');
      err.statusCode = 400;
      throw err;
    }

    // Check if already in this round
    const alreadyIn = round.participants.find((p) => p.phone === farmerUser.phone);
    if (alreadyIn) {
      return round;
    }

    round.participants.push({
      farmerId: farmerUser.id.toString(),
      phone: farmerUser.phone,
      name: farmerUser.name || 'Farmer',
      bookingId: tokenDoc._id,
      tokenNumber: tokenDoc.tokenNumber || tokenNumber,
      joinedAt: new Date()
    });

    // Quorum rule: Auto-start LIVE if participants >= 5
    if (round.participants.length >= fastTrackConfig.minQuorum && round.status === 'JOINING') {
      round.status = 'LIVE';
      round.endsAt = new Date(Date.now() + fastTrackConfig.countdownSeconds * 1000);
      logger.info(`[FastTrack] Round ${round.roundId} reached quorum (${round.participants.length}). Auto-started LIVE!`);
    }

    await round.save();

    await recordAudit(farmerUser, 'FAST_TRACK_FARMER_JOINED', round.roundId, {
      tokenNumber: tokenDoc.tokenNumber,
      participantsCount: round.participants.length,
      status: round.status
    }, round.centreId);

    // Notify farmer of successful join
    try {
      await notificationService.notify({
        recipientPhone: farmerUser.phone,
        recipientName: farmerUser.name,
        recipientRole: 'farmer',
        templateKey: 'FAST_TRACK_JOINED',
        centreId: round.centreId,
        params: {
          roundId: round.roundId,
          centreId: round.centreId,
          status: round.status
        }
      });
    } catch (e) {}

    emitSocket(io, round.centreId, 'fasttrack:round', round);
    return round;
  },

  /**
   * Request Start when < 5 participants
   */
  requestStart: async ({ roundId, farmerUser, io = null }) => {
    if (!farmerUser || !farmerUser.id || !farmerUser.phone) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (round.status !== 'JOINING') {
      const err = new Error(`Cannot request start for round in '${round.status}' status`);
      err.statusCode = 400;
      throw err;
    }

    const isParticipant = round.participants.some((p) => p.phone === farmerUser.phone);
    if (!isParticipant) {
      const err = new Error('Only joined participants can request to start the round.');
      err.statusCode = 403;
      throw err;
    }

    round.status = 'START_REQUESTED';
    round.startRequestedBy = {
      farmerId: farmerUser.id.toString(),
      phone: farmerUser.phone,
      name: farmerUser.name || 'Farmer'
    };
    round.startRequestedAt = new Date();
    await round.save();

    await recordAudit(farmerUser, 'FAST_TRACK_START_REQUESTED', round.roundId, {
      participantsCount: round.participants.length
    }, round.centreId);

    // Notify centre officers of start request
    try {
      await notificationService.notify({
        recipientPhone: null,
        recipientRole: 'centre_staff',
        centreId: round.centreId,
        templateKey: 'FAST_TRACK_START_REQUESTED',
        params: {
          roundId: round.roundId,
          centreId: round.centreId,
          participantsCount: round.participants.length
        }
      });
    } catch (e) {}

    emitSocket(io, round.centreId, 'fasttrack:round', round);
    return round;
  },

  /**
   * Centre Officer Start Decision (for < 5 participants requests)
   */
  officerStartDecision: async ({ roundId, officerUser, approved, reason = null, io = null }) => {
    if (!officerUser || !officerUser.role) {
      const err = new Error('Authentication required: Authorized staff session required.');
      err.statusCode = 401;
      throw err;
    }

    const allowedRoles = ['resource_officer', 'supervisor', 'admin', 'planning_officer'];
    if (!allowedRoles.includes(officerUser.role)) {
      const err = new Error('Forbidden: Only Resource Officer, Mandi Supervisor, or Admin can decide start requests.');
      err.statusCode = 403;
      throw err;
    }

    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    // Centre scoping check
    if (officerUser.role !== 'admin' && officerUser.role !== 'district_admin') {
      const userCentre = officerUser.assignedMandi || officerUser.mandiId;
      if (userCentre && userCentre !== round.centreId && userCentre !== round.mandiId) {
        const err = new Error(`Access denied: You are assigned to centre '${userCentre}' and cannot decide rounds for '${round.centreId}'.`);
        err.statusCode = 403;
        throw err;
      }
    }

    if (round.status !== 'START_REQUESTED') {
      const err = new Error(`Round is in '${round.status}' status, not 'START_REQUESTED'.`);
      err.statusCode = 400;
      throw err;
    }

    if (approved) {
      round.status = 'LIVE';
      round.endsAt = new Date(Date.now() + fastTrackConfig.countdownSeconds * 1000);
      round.officerDecision = {
        status: 'APPROVED',
        decidedBy: officerUser.name || officerUser.role,
        officerRole: officerUser.role,
        decidedAt: new Date(),
        reason: reason || 'Officer approved start under quorum'
      };
    } else {
      if (!reason || !reason.trim()) {
        const err = new Error('Decline reason is mandatory when rejecting a start request.');
        err.statusCode = 400;
        throw err;
      }
      round.status = 'CANCELLED_NO_QUORUM';
      round.officerDecision = {
        status: 'DECLINED',
        decidedBy: officerUser.name || officerUser.role,
        officerRole: officerUser.role,
        decidedAt: new Date(),
        reason: reason.trim()
      };
    }

    await round.save();

    await recordAudit(officerUser, approved ? 'FAST_TRACK_START_APPROVED' : 'FAST_TRACK_START_DECLINED', round.roundId, {
      approved,
      reason
    }, round.centreId);

    emitSocket(io, round.centreId, 'fasttrack:round', round);
    return round;
  },

  /**
   * Place an atomic bid in a LIVE round
   */
  placeBid: async ({ roundId, farmerUser, amount, simulatedNow = null, io = null }) => {
    if (!farmerUser || !farmerUser.id || !farmerUser.phone) {
      const err = new Error('Authentication required: Valid farmer session required.');
      err.statusCode = 401;
      throw err;
    }

    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const now = simulatedNow ? new Date(simulatedNow) : new Date();

    // Check round status
    if (round.status !== 'LIVE') {
      const err = new Error(`Cannot place bids: Round is currently in '${round.status}' status.`);
      err.statusCode = 400;
      throw err;
    }

    // Check if expired
    if (round.endsAt && now >= round.endsAt) {
      round.status = round.currentLeader ? 'AWAITING_APPROVAL' : 'CLOSED_NO_BIDS';
      await round.save();
      const err = new Error('Bidding timer has expired for this round.');
      err.statusCode = 400;
      throw err;
    }

    // Verify participant
    const participant = round.participants.find((p) => p.phone === farmerUser.phone);
    if (!participant) {
      const err = new Error('You must join the round with a confirmed booking before placing a bid.');
      err.statusCode = 403;
      throw err;
    }

    const bidVal = Number(amount);
    if (isNaN(bidVal) || bidVal <= 0) {
      const err = new Error('Valid positive bid amount in rupees is required.');
      err.statusCode = 400;
      throw err;
    }

    // Rule: Min Reserve fee check
    if (bidVal < round.reserveFee) {
      const err = new Error(`Bid of ₹${bidVal} is below the reserve fee floor of ₹${round.reserveFee}.`);
      err.statusCode = 400;
      throw err;
    }

    // Rule: Ceiling check
    if (bidVal > round.bidCeiling) {
      const err = new Error(`Bid of ₹${bidVal} exceeds maximum ceiling of ₹${round.bidCeiling}.`);
      err.statusCode = 400;
      throw err;
    }

    // Rule: Step increment check
    const currentHigh = round.currentLeader?.amount || 0;
    const minRequired = currentHigh === 0 ? round.reserveFee : currentHigh + round.bidStep;

    if (bidVal < minRequired) {
      const err = new Error(`Bid of ₹${bidVal} must be at least ₹${minRequired} (Current leader: ₹${currentHigh}, Step: ₹${round.bidStep}).`);
      err.statusCode = 400;
      throw err;
    }

    // ── ATOMIC CONDITIONAL UPDATE ON (seq + amount) ──
    const currentSeq = round.seq;
    const newEndsAt = new Date(now.getTime() + fastTrackConfig.countdownSeconds * 1000);

    const newLeader = {
      farmerId: farmerUser.id.toString(),
      phone: farmerUser.phone,
      name: farmerUser.name || participant.name || 'Farmer',
      bookingId: participant.bookingId,
      tokenNumber: participant.tokenNumber,
      amount: bidVal,
      bidTime: now
    };

    const previousLeader = round.currentLeader;

    const atomicUpdate = await FastTrackRound.findOneAndUpdate(
      {
        _id: round._id,
        status: 'LIVE',
        seq: currentSeq,
        $or: [
          { 'currentLeader.amount': { $lt: bidVal } },
          { currentLeader: null }
        ]
      },
      {
        $set: {
          currentLeader: newLeader,
          endsAt: newEndsAt
        },
        $inc: { seq: 1 },
        $push: {
          candidateQueue: {
            $each: [newLeader],
            $sort: { amount: -1, bidTime: 1 }
          }
        }
      },
      { new: true }
    );

    if (!atomicUpdate) {
      const err = new Error('Bid collision: A concurrent or higher bid was placed simultaneously. Please retry with a higher amount.');
      err.statusCode = 409;
      throw err;
    }

    const bidId = `BID-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`;
    const bidDoc = await FastTrackBid.create({
      bidId,
      roundId: round._id,
      farmerId: farmerUser.id.toString(),
      farmerPhone: farmerUser.phone,
      farmerName: farmerUser.name || participant.name,
      bookingId: participant.bookingId,
      tokenNumber: participant.tokenNumber,
      amount: bidVal,
      seq: currentSeq + 1,
      bidTime: now
    });

    await recordAudit(farmerUser, 'FAST_TRACK_BID_PLACED', round.roundId, {
      amount: bidVal,
      tokenNumber: participant.tokenNumber,
      seq: currentSeq + 1,
      newEndsAt
    }, round.centreId);

    // Notify previous leader that they were outbid
    if (previousLeader && previousLeader.phone !== farmerUser.phone) {
      try {
        await notificationService.notify({
          recipientPhone: previousLeader.phone,
          recipientName: previousLeader.name,
          recipientRole: 'farmer',
          templateKey: 'FAST_TRACK_OUTBID',
          centreId: round.centreId,
          params: {
            roundId: round.roundId,
            newLeaderAmount: bidVal,
            tokenNumber: previousLeader.tokenNumber
          }
        });
      } catch (e) {}
    }

    emitSocket(io, round.centreId, 'fasttrack:bid', { round: atomicUpdate, bid: bidDoc });
    emitSocket(io, round.centreId, 'fasttrack:round', atomicUpdate);

    return { round: atomicUpdate, bid: bidDoc };
  },

  /**
   * Officer Approval / Decline Decision
   */
  officerDecision: async ({ roundId, officerUser, approved, reason = null, io = null }) => {
    if (!officerUser || !officerUser.role) {
      const err = new Error('Authentication required: Authorized staff session required.');
      err.statusCode = 401;
      throw err;
    }

    const allowedRoles = ['resource_officer', 'supervisor', 'admin', 'planning_officer'];
    if (!allowedRoles.includes(officerUser.role)) {
      const err = new Error('Forbidden: Only Resource Officer, Mandi Supervisor, or Admin can make fast-track decisions.');
      err.statusCode = 403;
      throw err;
    }

    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    // Centre scoping check
    if (officerUser.role !== 'admin' && officerUser.role !== 'district_admin') {
      const userCentre = officerUser.assignedMandi || officerUser.mandiId;
      if (userCentre && userCentre !== round.centreId && userCentre !== round.mandiId) {
        const err = new Error(`Access denied: You are assigned to centre '${userCentre}' and cannot approve/decline rounds for '${round.centreId}'.`);
        err.statusCode = 403;
        throw err;
      }
    }

    if (round.status !== 'AWAITING_APPROVAL') {
      const err = new Error(`Round is in '${round.status}' status, not 'AWAITING_APPROVAL'.`);
      err.statusCode = 400;
      throw err;
    }

    const leader = round.currentLeader;
    if (!leader) {
      round.status = 'CLOSED_NO_BIDS';
      await round.save();
      const err = new Error('No winning bidder present for this round.');
      err.statusCode = 400;
      throw err;
    }

    if (approved) {
      round.status = 'APPROVED';
      round.officerDecision = {
        status: 'APPROVED',
        decidedBy: officerUser.name || officerUser.role,
        officerRole: officerUser.role,
        decidedAt: new Date(),
        reason: reason || 'Officer approved winning fast-track commitment'
      };
      await round.save();

      // Update Token / Booking document
      const tokenDoc = await Token.findOne({
        $or: [{ tokenNumber: leader.tokenNumber }, { _id: leader.bookingId }]
      });

      if (tokenDoc) {
        tokenDoc.isFastTrack = true;
        tokenDoc.fastTrackCommitment = {
          amount: leader.amount,
          status: 'COMMITTED'
        };
        await tokenDoc.save();
      }

      await recordAudit(officerUser, 'FAST_TRACK_APPROVED', round.roundId, {
        winnerPhone: leader.phone,
        winnerToken: leader.tokenNumber,
        amount: leader.amount
      }, round.centreId);

      // Notify winning farmer
      try {
        await notificationService.notify({
          recipientPhone: leader.phone,
          recipientName: leader.name,
          recipientRole: 'farmer',
          templateKey: 'FAST_TRACK_APPROVED',
          centreId: round.centreId,
          params: {
            roundId: round.roundId,
            tokenNumber: leader.tokenNumber,
            committedAmount: leader.amount
          }
        });
      } catch (e) {}

      emitSocket(io, round.centreId, 'fasttrack:round', round);
      return { round, winner: leader };
    }

    // ── DECLINE PATH (Mandatory Reason Required) ──
    if (!reason || !reason.trim()) {
      const err = new Error('Decline reason is mandatory when rejecting a winning bid.');
      err.statusCode = 400;
      throw err;
    }

    // Reject current leader and cascade to next in candidateQueue
    const declinedLeader = leader;
    const remainingCandidates = round.candidateQueue.filter(
      (c) => c.phone !== declinedLeader.phone && c.tokenNumber !== declinedLeader.tokenNumber
    );

    await recordAudit(officerUser, 'FAST_TRACK_DECLINED', round.roundId, {
      declinedPhone: declinedLeader.phone,
      declinedToken: declinedLeader.tokenNumber,
      amount: declinedLeader.amount,
      reason: reason.trim()
    }, round.centreId);

    // Notify declined farmer with reason
    try {
      await notificationService.notify({
        recipientPhone: declinedLeader.phone,
        recipientName: declinedLeader.name,
        recipientRole: 'farmer',
        templateKey: 'FAST_TRACK_DECLINED',
        centreId: round.centreId,
        params: {
          roundId: round.roundId,
          tokenNumber: declinedLeader.tokenNumber,
          reason: reason.trim()
        }
      });
    } catch (e) {}

    if (remainingCandidates.length > 0) {
      // Cascade to next highest bidder
      round.currentLeader = remainingCandidates[0];
      round.candidateQueue = remainingCandidates;
      round.officerDecisionExpiresAt = new Date(Date.now() + fastTrackConfig.officerTimeoutMinutes * 60 * 1000);
      round.status = 'AWAITING_APPROVAL';
      await round.save();

      logger.info(`[FastTrack] Cascaded leadership on round ${round.roundId} to next bidder (${round.currentLeader.phone}, ₹${round.currentLeader.amount}).`);
      emitSocket(io, round.centreId, 'fasttrack:round', round);
      return { round, cascaded: true, nextLeader: round.currentLeader };
    }

    // No remaining candidates -> round becomes DECLINED
    round.status = 'DECLINED';
    round.currentLeader = null;
    round.candidateQueue = [];
    round.officerDecision = {
      status: 'DECLINED',
      decidedBy: officerUser.name || officerUser.role,
      officerRole: officerUser.role,
      decidedAt: new Date(),
      reason: reason.trim()
    };
    await round.save();

    emitSocket(io, round.centreId, 'fasttrack:round', round);
    return { round, cascaded: false };
  },

  /**
   * Handle Leader Booking Cancellation mid-round
   */
  handleLeaderCancellation: async (tokenNumber, io = null) => {
    if (!tokenNumber) return;
    const activeRounds = await FastTrackRound.find({
      'currentLeader.tokenNumber': tokenNumber,
      status: { $in: ['LIVE', 'AWAITING_APPROVAL'] }
    });

    for (const round of activeRounds) {
      const remainingCandidates = round.candidateQueue.filter((c) => c.tokenNumber !== tokenNumber);
      if (remainingCandidates.length > 0) {
        round.currentLeader = remainingCandidates[0];
        round.candidateQueue = remainingCandidates;
        await round.save();
        logger.info(`[FastTrack] Leader cancelled token ${tokenNumber}. Leadership passed to ${round.currentLeader.tokenNumber} (₹${round.currentLeader.amount}).`);
      } else {
        round.currentLeader = null;
        round.candidateQueue = [];
        if (round.status === 'AWAITING_APPROVAL') {
          round.status = 'CLOSED_NO_BIDS';
        }
        await round.save();
      }
      emitSocket(io, round.centreId, 'fasttrack:round', round);
    }
  },

  /**
   * Background Expiry and Timeout Processor
   */
  processRoundExpiries: async (options = {}) => {
    const now = options.simulatedNow ? new Date(options.simulatedNow) : new Date();
    const results = { liveExpired: 0, officerTimedOut: 0 };

    if (mongoose.connection.readyState !== 1) return results;

    // 1. Check LIVE rounds where endsAt <= now
    const liveExpiredRounds = await FastTrackRound.find({
      status: 'LIVE',
      endsAt: { $lte: now }
    });

    for (const round of liveExpiredRounds) {
      if (round.currentLeader) {
        round.status = 'AWAITING_APPROVAL';
        round.officerDecisionExpiresAt = new Date(now.getTime() + fastTrackConfig.officerTimeoutMinutes * 60 * 1000);
        await round.save();
        results.liveExpired++;

        await recordAudit({ id: 'SYSTEM', role: 'system' }, 'FAST_TRACK_AWAITING_APPROVAL', round.roundId, {
          leaderPhone: round.currentLeader.phone,
          leaderAmount: round.currentLeader.amount
        }, round.centreId);

        // Notify centre officers of pending approval
        try {
          await notificationService.notify({
            recipientPhone: null,
            recipientRole: 'centre_staff',
            centreId: round.centreId,
            templateKey: 'FAST_TRACK_OFFICER_REVIEW',
            params: {
              roundId: round.roundId,
              centreId: round.centreId,
              winnerAmount: round.currentLeader.amount
            }
          });
        } catch (e) {}
      } else {
        round.status = 'CLOSED_NO_BIDS';
        await round.save();
        results.liveExpired++;

        await recordAudit({ id: 'SYSTEM', role: 'system' }, 'FAST_TRACK_CLOSED_NO_BIDS', round.roundId, {}, round.centreId);
      }
      emitSocket(options.io, round.centreId, 'fasttrack:round', round);
    }

    // 2. Check AWAITING_APPROVAL rounds where officerDecisionExpiresAt <= now (10-min timeout)
    const timedOutRounds = await FastTrackRound.find({
      status: 'AWAITING_APPROVAL',
      officerDecisionExpiresAt: { $lte: now }
    });

    for (const round of timedOutRounds) {
      const timedOutLeader = round.currentLeader;
      const remaining = round.candidateQueue.filter(
        (c) => c.phone !== timedOutLeader?.phone && c.tokenNumber !== timedOutLeader?.tokenNumber
      );

      await recordAudit({ id: 'SYSTEM', role: 'system' }, 'FAST_TRACK_OFFICER_TIMEOUT', round.roundId, {
        timedOutLeader: timedOutLeader?.phone
      }, round.centreId);

      if (remaining.length > 0) {
        round.currentLeader = remaining[0];
        round.candidateQueue = remaining;
        round.officerDecisionExpiresAt = new Date(now.getTime() + fastTrackConfig.officerTimeoutMinutes * 60 * 1000);
        await round.save();
        results.officerTimedOut++;
      } else {
        round.status = 'CLOSED_NO_BIDS';
        round.currentLeader = null;
        round.candidateQueue = [];
        await round.save();
        results.officerTimedOut++;
      }
      emitSocket(options.io, round.centreId, 'fasttrack:round', round);
    }

    return results;
  },

  /**
   * Query rounds
   */
  getRounds: async (filter = {}) => {
    const query = {};
    if (filter.centreId) query.centreId = filter.centreId;
    if (filter.status) query.status = filter.status;
    if (filter.slotDate) query.slotDate = filter.slotDate;

    return await FastTrackRound.find(query).sort({ createdAt: -1 });
  },

  getRoundById: async (roundId) => {
    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };
    return await FastTrackRound.findOne(query);
  },

  getBidsForRound: async (roundId) => {
    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };
    const round = await FastTrackRound.findOne(query);
    if (!round) return [];
    return await FastTrackBid.find({ roundId: round._id }).sort({ amount: -1, bidTime: 1 });
  },

  /**
   * Start background auction worker for expiry and timeouts
   */
  startAuctionWorker: (intervalMs = 5000, io = null) => {
    logger.info(`[FastTrack] Started background auction expiry worker (${intervalMs}ms interval)`);
    return setInterval(async () => {
      try {
        await fastTrackAuctionService.processRoundExpiries({ io });
      } catch (e) {
        logger.warn(`[FastTrack] Auction worker notice: ${e.message}`);
      }
    }, intervalMs);
  }
};

module.exports = fastTrackAuctionService;
