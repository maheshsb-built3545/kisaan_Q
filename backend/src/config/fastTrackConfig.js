/**
 * KisanQ Fast-Track Bidding & Auction Configuration (PRD Section 2.5)
 * 
 * Rule-based auction engine with human approval.
 */

const fastTrackConfig = {
  reserveFee: Number(process.env.FAST_TRACK_RESERVE_FEE) || 200, // Today's flat fee (150-250)
  bidStep: Number(process.env.FAST_TRACK_BID_STEP) || 10,       // Minimum increment per bid
  bidCeiling: Number(process.env.FAST_TRACK_BID_CEILING) || 500, // Maximum bid ceiling
  capPerHour: Number(process.env.FAST_TRACK_CAP_PER_HOUR) || 2,  // Maximum fast-track slots per hour per centre
  countdownSeconds: Number(process.env.FAST_TRACK_COUNTDOWN_SEC) || 100, // 100s server countdown timer
  officerTimeoutMinutes: Number(process.env.FAST_TRACK_OFFICER_TIMEOUT_MIN) || 10, // 10-minute officer approval timeout
  minQuorum: 5, // 5 participants automatically triggers LIVE status
  joiningWindowMinutesBeforeSlot: 30
};

module.exports = fastTrackConfig;
