'use strict';

/**
 * cropRates.js — Centralized Crop Pricing & Statutory MSP Reference
 *
 * Source Note:
 * - Statutory MSP Rates: Commission for Agricultural Costs and Prices (CACP) / Ministry of Agriculture & Farmers Welfare (2025-26 Season).
 * - Mandi Market Rates: Maharashtra State Agricultural Marketing Board (MSAMB) / APMC Daily Market Intelligence.
 * - Non-MSP Crops: Crops such as Onion & Red Onion do not have statutory MSP; pricing is determined purely by APMC daily open market arrivals.
 */

const CROP_RATES = {
  Soybean: {
    crop: 'Soybean',
    msp: 4892, // ₹/Quintal (CACP MSP 2025-26)
    marketPriceToday: 4950,
    marketPriceYesterday: 4910,
    hasMsp: true,
    sourceNote: 'CACP Statutory MSP (Soybean Yellow) 2025-26 + APMC Kopargaon Daily Market Rate'
  },
  Wheat: {
    crop: 'Wheat',
    msp: 2275, // ₹/Quintal (CACP MSP 2025-26)
    marketPriceToday: 2320,
    marketPriceYesterday: 2310,
    hasMsp: true,
    sourceNote: 'CACP Statutory MSP (Wheat RMS) 2025-26 + APMC Kopargaon Daily Market Rate'
  },
  Cotton: {
    crop: 'Cotton',
    msp: 7122, // ₹/Quintal (CACP MSP Long Staple)
    marketPriceToday: 7280,
    marketPriceYesterday: 7240,
    hasMsp: true,
    sourceNote: 'CACP Statutory MSP (Cotton Medium/Long Staple) + Daily Mandi Spot Rate'
  },
  Maize: {
    crop: 'Maize',
    msp: 2090, // ₹/Quintal (CACP MSP 2025-26)
    marketPriceToday: 2140,
    marketPriceYesterday: 2110,
    hasMsp: true,
    sourceNote: 'CACP Statutory MSP (Maize Hybrid) + Daily Mandi Spot Rate'
  },
  Onion: {
    crop: 'Onion',
    msp: null, // No Statutory MSP for Onion (Open market mechanism only)
    marketPriceToday: 2150,
    marketPriceYesterday: 2100,
    hasMsp: false,
    sourceNote: 'APMC Lasalgaon/Kopargaon Daily Open Market Rate (No Statutory MSP for Onion)'
  },
  'Red Onion': {
    crop: 'Red Onion',
    msp: null, // No Statutory MSP for Red Onion
    marketPriceToday: 2280,
    marketPriceYesterday: 2220,
    hasMsp: false,
    sourceNote: 'APMC Lasalgaon/Kopargaon Daily Open Market Rate (No Statutory MSP for Onion)'
  }
};

/**
 * Helper to compute payout amount from net weight in Quintals and crop name
 * @param {string} crop 
 * @param {number} netWeightQuintals 
 * @returns {number} Payout amount in Rupees (rounded to integer)
 */
function computePayout(crop, netWeightQuintals) {
  const rateObj = CROP_RATES[crop] || CROP_RATES['Soybean'];
  const effectiveRate = rateObj.msp || rateObj.marketPriceToday;
  return Math.round(netWeightQuintals * effectiveRate);
}

module.exports = {
  CROP_RATES,
  computePayout
};
