/**
 * KisanQ SMS Policy Configuration
 * Single source of truth for SMS dispatch eligibility and budgets.
 */
const SMS_POLICY = {
  // Key Farmer Journey Events (eligible for SMS delivery)
  booking_confirmed: true,
  leave_by_alert: true,
  turn_near: true,
  slot_warning: false, // in-app priority, SMS only if noSmartphone
  slot_released: true,
  slot_gone: true,
  waitlist_offer: true,
  payout_ready: true,
  payout_paid: true,
  payout_settled: true,
  fast_track_won: true,
  fast_track_approved: true,
  fast_track_declined: true,
  otp_auth: true,
  redirect_offer: true,
  complaint_resolved: true,
  exception_raised: true,

  // Secondary events (in-app only unless noSmartphone)
  gate_checkin: false,
  quality_assayed: false,
  weighbridge_done: false,
  procurement_recorded: false,
  fast_track_round_opened: false,
  fast_track_bid_placed: false,
  fast_track_outbid: false,
  complaint_received: false,
};

const DEFAULT_SMS_BUDGET_PER_FARMER = 5;

module.exports = {
  SMS_POLICY,
  DEFAULT_SMS_BUDGET_PER_FARMER,
};
