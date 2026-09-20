/**
 * KisanQ Dynamic Fast-Track Bidding & Auction Engine (PRD 2.5)
 * 
 * Rules:
 * - 100s countdown timer
 * - 100s timer reset upon valid higher bid
 * - Hard MSP floor protection (market rate - discount >= MSP floor)
 * - Planning / Resource Officer approval workflow
 * - Dynamic priority queue reordering
 */

const mongoose = require('mongoose');
const FastTrackRound = require('../models/FastTrackRound');
const FastTrackBid = require('../models/FastTrackBid');
const Token = require('../models/Token');
const CropPrice = require('../models/CropPrice');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

// Default Fallback MSP Rates
const DEFAULT_MSP_FLOORS = {
  'Soybean': 4892,
  'Cotton': 7121,
  'Wheat': 2275,
  'Onion': 1650,
  'Maize': 2090,
  'Chana': 5440
};

const fastTrackAuctionService = {
  /**
   * Start a Fast-Track Bidding Round for an active token
   */
  startAuctionRound: async ({ tokenNumber, phone, startingBid = 10, timerSeconds = 100, io = null }) => {
    if (!tokenNumber) {
      throw new Error('Token number is required to start a Fast-Track round');
    }

    const token = await Token.findOne({
      $or: [{ tokenNumber: tokenNumber.trim() }, { id: tokenNumber.trim() }]
    });

    if (!token) {
      const err = new Error(`Token '${tokenNumber}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (['COMPLETED', 'Completed', 'CANCELLED', 'Cancelled'].includes(token.status)) {
      const err = new Error(`Cannot start Fast-Track auction for token in '${token.status}' status`);
      err.statusCode = 400;
      throw err;
    }

    // Check if round already active
    const existingActive = await FastTrackRound.findOne({
      tokenNumber: token.tokenNumber,
      status: 'ACTIVE'
    });

    if (existingActive) {
      return existingActive;
    }

    // Lookup crop market price and MSP floor
    const cropName = token.crop || 'Soybean';
    const mandiId = token.mandiId || 'KPG-01';
    const mspFloor = DEFAULT_MSP_FLOORS[cropName] || 4892;

    let marketPrice = Math.round(mspFloor * 1.05); // Default 5% above MSP
    try {
      const priceDoc = await CropPrice.findOne({ mandiId, crop: cropName });
      if (priceDoc && priceDoc.marketPriceToday) {
        marketPrice = priceDoc.marketPriceToday;
      }
    } catch (e) {}

    // Verify margin exists above MSP floor
    const maxDiscount = marketPrice - mspFloor;
    if (maxDiscount < 5) {
      const err = new Error(`Market price (₹${marketPrice}/Qtl) is too close to MSP floor (₹${mspFloor}/Qtl) to enable Fast-Track bidding.`);
      err.statusCode = 400;
      throw err;
    }

    const initialBid = Math.min(Number(startingBid) || 10, maxDiscount);
    const now = new Date();
    const roundEndTime = new Date(now.getTime() + (Number(timerSeconds) || 100) * 1000);

    const year = now.getFullYear();
    const randDigits = String(Math.floor(1000 + Math.random() * 8999));
    const roundId = `FTR-${year}-${randDigits}`;

    const round = await FastTrackRound.create({
      roundId,
      tokenNumber: token.tokenNumber,
      tokenId: token._id,
      farmerPhone: token.farmerPhone || phone || '9876543210',
      farmerName: token.farmerName || 'Farmer',
      centreId: token.mandiId || 'KPG-01',
      mandiId: token.mandiId || 'KPG-01',
      mandiName: token.mandiName || 'APMC Mandi',
      crop: cropName,
      quantity: token.quantity || 25,
      baseMarketPrice: marketPrice,
      floorPrice: mspFloor,
      startingBid: initialBid,
      highestBid: initialBid,
      highestBidderPhone: token.farmerPhone || phone,
      highestBidderName: token.farmerName || 'Initial Ask',
      bidsCount: 1,
      roundStartTime: now,
      roundEndTime,
      timerSeconds: Number(timerSeconds) || 100,
      status: 'ACTIVE'
    });

    logger.info(`[FastTrack] Started round ${roundId} for token ${token.tokenNumber} (Timer: ${timerSeconds}s, MSP Floor: ₹${mspFloor})`);

    if (io) {
      io.to(`mandi_${token.mandiId}`).emit('FASTTRACK_ROUND_STARTED', round);
    }

    return round;
  },

  /**
   * Place a Bid in an Active Round
   * Enforces 100s timer reset rule and hard MSP floor check
   */
  placeBid: async ({ roundId, bidderPhone, bidderName, bidDiscountPerQtl, now = new Date(), io = null }) => {
    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Fast-Track round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const effectiveNow = now ? new Date(now) : new Date();

    // Check if timer expired
    if (round.status === 'TIMER_EXPIRED' || (round.status === 'ACTIVE' && effectiveNow >= round.roundEndTime)) {
      if (round.status === 'ACTIVE') {
        round.status = 'TIMER_EXPIRED';
        await round.save();
      }
      const err = new Error('Bidding timer has expired for this round. Round is closed awaiting officer review.');
      err.statusCode = 400;
      throw err;
    }

    if (round.status !== 'ACTIVE') {
      const err = new Error(`Cannot bid on round in status '${round.status}'`);
      err.statusCode = 400;
      throw err;
    }

    const discount = Number(bidDiscountPerQtl);
    if (isNaN(discount) || discount <= round.highestBid) {
      const err = new Error(`Bid discount (₹${discount}/Qtl) must be strictly higher than current highest bid of ₹${round.highestBid}/Qtl.`);
      err.statusCode = 400;
      throw err;
    }

    // Hard MSP Floor Check: (baseMarketPrice - discount) >= floorPrice
    const netPrice = round.baseMarketPrice - discount;
    if (netPrice < round.floorPrice) {
      const err = new Error(`MSP floor violation: Offered net price ₹${netPrice}/Qtl cannot go below official MSP floor of ₹${round.floorPrice}/Qtl.`);
      err.statusCode = 400;
      throw err;
    }

    // ── 100s Timer Reset Rule ──
    const resetTimerSec = round.timerSeconds || 100;
    const newRoundEndTime = new Date(effectiveNow.getTime() + resetTimerSec * 1000);

    const bidId = `BID-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`;
    const bid = await FastTrackBid.create({
      bidId,
      roundId: round._id,
      tokenNumber: round.tokenNumber,
      bidderPhone: bidderPhone || '9876543210',
      bidderName: bidderName || 'Trader / Buyer',
      bidDiscountPerQtl: discount,
      netPriceOffered: netPrice,
      bidTime: effectiveNow
    });

    round.highestBid = discount;
    round.highestBidderPhone = bidderPhone || '9876543210';
    round.highestBidderName = bidderName || 'Trader / Buyer';
    round.bidsCount += 1;
    round.roundEndTime = newRoundEndTime;
    await round.save();

    logger.info(`[FastTrack] New highest bid ₹${discount}/Qtl on round ${round.roundId} by ${bidderPhone}. Timer reset to 100s (${newRoundEndTime.toISOString()})`);

    if (io) {
      io.to(`mandi_${round.centreId}`).emit('FASTTRACK_BID_PLACED', { round, bid });
    }

    return { round, bid };
  },

  /**
   * Planning / Resource Officer Approves Winning Bid
   */
  approveWinningBid: async ({ roundId, officerUser, decisionNotes, io = null }) => {
    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    // Officer permission check
    const role = officerUser?.role;
    if (role && !['resource_officer', 'supervisor', 'district_admin', 'planning_officer', 'admin'].includes(role)) {
      const err = new Error('Access denied: Only Resource Officer, Planning Officer, or Mandi Supervisor can approve Fast-Track rounds.');
      err.statusCode = 403;
      throw err;
    }

    round.status = 'APPROVED';
    round.decisionBy = officerUser?.name || officerUser?.role || 'Planning Officer Desk';
    round.decisionAt = new Date();
    round.decisionNotes = decisionNotes || `Approved winning discount of ₹${round.highestBid}/Qtl`;
    await round.save();

    // Update Token with Fast-Track priority
    const token = await Token.findOne({
      $or: [{ tokenNumber: round.tokenNumber }, { id: round.tokenNumber }]
    });

    if (token) {
      token.isFastTrack = true;
      token.fastTrackTier = round.highestBid;
      token.fastTrackDiscountedPrice = round.baseMarketPrice - round.highestBid;
      token.queuePosition = 1; // Jumps to priority front of queue
      await token.save();
    }

    logger.info(`[FastTrack] Round ${round.roundId} APPROVED by ${round.decisionBy}. Token ${round.tokenNumber} elevated to Priority Queue #1.`);

    // Send notifications
    try {
      await notificationService.notify({
        recipientPhone: round.farmerPhone,
        recipientName: round.farmerName,
        recipientRole: 'farmer',
        templateKey: 'FAST_TRACK_APPROVED',
        centreId: round.centreId,
        params: {
          tokenNumber: round.tokenNumber,
          winningDiscount: round.highestBid,
          discountedPrice: round.baseMarketPrice - round.highestBid
        }
      });
    } catch (e) {
      logger.warn(`[FastTrack] Notify approval note: ${e.message}`);
    }

    if (io) {
      io.to(`mandi_${round.centreId}`).emit('FASTTRACK_ROUND_APPROVED', { round, token });
    }

    return { round, token };
  },

  /**
   * Officer Declines Fast-Track Round
   */
  declineRound: async ({ roundId, officerUser, reason, io = null }) => {
    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    if (!round) {
      const err = new Error(`Round '${roundId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const role = officerUser?.role;
    if (role && !['resource_officer', 'supervisor', 'district_admin', 'planning_officer', 'admin'].includes(role)) {
      const err = new Error('Access denied: Officer permissions required to decline Fast-Track rounds.');
      err.statusCode = 403;
      throw err;
    }

    round.status = 'DECLINED';
    round.decisionBy = officerUser?.name || officerUser?.role || 'Planning Officer Desk';
    round.decisionAt = new Date();
    round.decisionNotes = reason || 'Yard congestion limit reached';
    await round.save();

    logger.info(`[FastTrack] Round ${round.roundId} DECLINED by ${round.decisionBy}. Reason: ${round.decisionNotes}`);

    try {
      await notificationService.notify({
        recipientPhone: round.farmerPhone,
        recipientName: round.farmerName,
        recipientRole: 'farmer',
        templateKey: 'FAST_TRACK_DECLINED',
        centreId: round.centreId,
        params: {
          tokenNumber: round.tokenNumber,
          reason: round.decisionNotes
        }
      });
    } catch (e) {
      logger.warn(`[FastTrack] Notify decline note: ${e.message}`);
    }

    if (io) {
      io.to(`mandi_${round.centreId}`).emit('FASTTRACK_ROUND_DECLINED', { round });
    }

    return round;
  },

  /**
   * Get Active Rounds (optionally filtered by centre)
   */
  getActiveRounds: async (filter = {}) => {
    const query = { status: { $in: ['ACTIVE', 'TIMER_EXPIRED'] } };
    if (filter.centreId) query.centreId = filter.centreId;
    if (filter.crop) query.crop = filter.crop;

    const rounds = await FastTrackRound.find(query).sort({ createdAt: -1 });
    return rounds;
  },

  /**
   * Get Single Round Detail
   */
  getRoundById: async (roundId) => {
    const query = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(query);
    return round;
  },

  /**
   * Get Bids for a Round
   */
  getBidsForRound: async (roundId) => {
    const roundQuery = mongoose.Types.ObjectId.isValid(roundId)
      ? { $or: [{ _id: roundId }, { roundId }] }
      : { roundId };

    const round = await FastTrackRound.findOne(roundQuery);
    if (!round) return [];

    const bids = await FastTrackBid.find({ roundId: round._id }).sort({ bidDiscountPerQtl: -1, createdAt: 1 });
    return bids;
  }
};

module.exports = fastTrackAuctionService;
