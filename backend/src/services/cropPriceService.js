const mongoose = require('mongoose');
const CropPrice = require('../models/CropPrice');
const logger = require('../utils/logger');

// In-memory fallback for testing / offline resilience
const inMemoryCropPrices = new Map();

/**
 * Statutory Minimum Support Price (MSP) Master Rates
 * Matching exact values established in KisanQ (StaffDesk FAQ Standards):
 * - Soybean: ₹4,892/Qtl
 * - Wheat: ₹2,425/Qtl
 * - Onion: ₹1,950/Qtl
 * - Cotton: ₹7,122/Qtl
 */
const STATUTORY_MSP_RATES = {
  Soybean: 4892,
  Wheat: 2425,
  Onion: 1950,
  Cotton: 7122
};

// 6 Official APMC Mandis
const OFFICIAL_MANDIS = ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'];

// Realistic market rate variations per mandi (~1% - 3% premium over MSP)
const MANDI_MARKET_RATES = {
  'KPG-01': {
    Soybean: { today: 4950, yesterday: 4880 },
    Wheat:   { today: 2460, yesterday: 2410 },
    Onion:   { today: 1980, yesterday: 1920 },
    Cotton:  { today: 7250, yesterday: 7110 }
  },
  'SRD-02': {
    Soybean: { today: 4950, yesterday: 4885 },
    Wheat:   { today: 2450, yesterday: 2400 },
    Onion:   { today: 1990, yesterday: 1940 },
    Cotton:  { today: 7210, yesterday: 7090 }
  },
  'RHT-03': {
    Soybean: { today: 4940, yesterday: 4870 },
    Wheat:   { today: 2465, yesterday: 2415 },
    Onion:   { today: 1970, yesterday: 1930 },
    Cotton:  { today: 7240, yesterday: 7120 }
  },
  'VJP-04': {
    Soybean: { today: 4930, yesterday: 4860 },
    Wheat:   { today: 2440, yesterday: 2390 },
    Onion:   { today: 2010, yesterday: 1960 },
    Cotton:  { today: 7280, yesterday: 7150 }
  },
  'SRP-05': {
    Soybean: { today: 4960, yesterday: 4890 },
    Wheat:   { today: 2470, yesterday: 2420 },
    Onion:   { today: 1975, yesterday: 1925 },
    Cotton:  { today: 7260, yesterday: 7130 }
  },
  'LSG-06': {
    Soybean: { today: 4935, yesterday: 4870 },
    Wheat:   { today: 2455, yesterday: 2405 },
    Onion:   { today: 2020, yesterday: 1970 },
    Cotton:  { today: 7230, yesterday: 7100 }
  }
};

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const cropPriceService = {
  /**
   * Seed / Synchronize initial crop price records across all 6 APMC mandis
   */
  seedCropPrices: async () => {
    const today = getTodayDateString();
    const seedRecords = [];

    for (const mandiId of OFFICIAL_MANDIS) {
      const rates = MANDI_MARKET_RATES[mandiId] || MANDI_MARKET_RATES['KPG-01'];
      for (const [crop, mspPrice] of Object.entries(STATUTORY_MSP_RATES)) {
        const marketRates = rates[crop] || { today: Math.round(mspPrice * 1.015), yesterday: mspPrice };
        const record = {
          mandiId,
          crop,
          mspPrice,
          marketPriceToday: marketRates.today,
          marketPriceYesterday: marketRates.yesterday,
          effectiveDate: today,
          updatedBy: 'SYSTEM_SEED'
        };
        seedRecords.push(record);
        inMemoryCropPrices.set(`${mandiId}_${crop}_${today}`, record);
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        for (const doc of seedRecords) {
          await CropPrice.findOneAndUpdate(
            { mandiId: doc.mandiId, crop: doc.crop, effectiveDate: doc.effectiveDate },
            { $set: doc },
            { upsert: true, new: true, runValidators: true }
          );
        }
        logger.info(`[CropPrices] Synchronized ${seedRecords.length} crop price entries across all APMC mandis.`);
      } catch (err) {
        logger.warn(`[CropPrices] Database sync notice: ${err.message}`);
      }
    }

    return seedRecords;
  },

  /**
   * Get all crop prices for a specific mandi
   */
  getPricesByMandi: async (mandiId, date = null) => {
    const effectiveDate = date || getTodayDateString();
    const cleanMandiId = (mandiId || 'KPG-01').toUpperCase().trim();

    try {
      if (mongoose.connection.readyState === 1) {
        let prices = await CropPrice.find({
          mandiId: { $regex: new RegExp(`^${cleanMandiId}`, 'i') },
          effectiveDate
        }).lean();

        if (prices.length === 0) {
          await cropPriceService.seedCropPrices();
          prices = await CropPrice.find({
            mandiId: { $regex: new RegExp(`^${cleanMandiId}`, 'i') },
            effectiveDate
          }).lean();
        }
        return prices;
      }
    } catch (err) {
      logger.warn(`[CropPrices] DB query fallback: ${err.message}`);
    }

    // In-memory fallback
    if (inMemoryCropPrices.size === 0) {
      await cropPriceService.seedCropPrices();
    }

    const results = [];
    inMemoryCropPrices.forEach((val, key) => {
      if (key.startsWith(`${cleanMandiId}_`) && val.effectiveDate === effectiveDate) {
        results.push(val);
      }
    });

    return results.length > 0 ? results : Array.from(inMemoryCropPrices.values()).slice(0, 4);
  },

  /**
   * Get cross-mandi prices for a specific crop
   */
  getPricesByCrop: async (crop, date = null) => {
    const effectiveDate = date || getTodayDateString();
    const cleanCrop = crop.trim();

    try {
      if (mongoose.connection.readyState === 1) {
        let prices = await CropPrice.find({
          crop: { $regex: new RegExp(`^${cleanCrop}`, 'i') },
          effectiveDate
        }).lean();

        if (prices.length === 0) {
          await cropPriceService.seedCropPrices();
          prices = await CropPrice.find({
            crop: { $regex: new RegExp(`^${cleanCrop}`, 'i') },
            effectiveDate
          }).lean();
        }
        return prices;
      }
    } catch (err) {
      logger.warn(`[CropPrices] DB query fallback: ${err.message}`);
    }

    if (inMemoryCropPrices.size === 0) {
      await cropPriceService.seedCropPrices();
    }

    const results = [];
    inMemoryCropPrices.forEach((val) => {
      if (val.crop.toLowerCase() === cleanCrop.toLowerCase() && val.effectiveDate === effectiveDate) {
        results.push(val);
      }
    });

    return results;
  },

  /**
   * Get all current crop prices
   */
  getAllPrices: async (filters = {}) => {
    const effectiveDate = filters.date || getTodayDateString();
    const query = { effectiveDate };

    if (filters.mandiId) {
      query.mandiId = { $regex: new RegExp(`^${filters.mandiId.trim()}`, 'i') };
    }
    if (filters.crop) {
      query.crop = { $regex: new RegExp(`^${filters.crop.trim()}`, 'i') };
    }

    try {
      if (mongoose.connection.readyState === 1) {
        let prices = await CropPrice.find(query).lean();
        if (prices.length === 0) {
          await cropPriceService.seedCropPrices();
          prices = await CropPrice.find(query).lean();
        }
        return prices;
      }
    } catch (err) {
      logger.warn(`[CropPrices] DB query fallback: ${err.message}`);
    }

    if (inMemoryCropPrices.size === 0) {
      await cropPriceService.seedCropPrices();
    }

    const results = [];
    inMemoryCropPrices.forEach((val) => {
      let matches = val.effectiveDate === effectiveDate;
      if (filters.mandiId && !val.mandiId.toLowerCase().includes(filters.mandiId.toLowerCase())) matches = false;
      if (filters.crop && !val.crop.toLowerCase().includes(filters.crop.toLowerCase())) matches = false;
      if (matches) results.push(val);
    });

    return results;
  }
};

module.exports = cropPriceService;
