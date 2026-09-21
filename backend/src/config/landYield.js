/**
 * Land Yield & Season Configuration
 * Rule-based estimates for Maharashtra APMC commodities.
 * All yields are marked as source: 'assumed' with a 1.5 tolerance multiplier.
 */

const LAND_YIELD_CONFIG = {
  // Default tolerance multiplier (1.5 = 150% of assumed yield)
  defaultToleranceMultiplier: 1.5,

  // Season Definitions (Maharashtra Agro-Climatic Zones)
  // Kharif: June 1 to October 31 (Months: 6, 7, 8, 9, 10)
  // Rabi: November 1 to May 31 (Months: 11, 12, 1, 2, 3, 4, 5)
  seasons: {
    kharif: {
      name: 'Kharif',
      nameMarathi: 'खरीप',
      nameHindi: 'खरीफ',
      startMonth: 6, // June
      startDay: 1,
      endMonth: 10,  // October
      endDay: 31
    },
    rabi: {
      name: 'Rabi',
      nameMarathi: 'रब्बी',
      nameHindi: 'रबी',
      startMonth: 11, // November
      startDay: 1,
      endMonth: 5,   // May (next calendar year)
      endDay: 31
    }
  },

  // Crop Yield Estimates (Quintals per Acre)
  // Source is always 'assumed'
  crops: {
    soybean: {
      canonicalName: 'Soybean',
      nameMarathi: 'सोयाबीन',
      nameHindi: 'सोयाबीन',
      yieldPerAcre: 8, // 8 Quintals/Acre
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    cotton: {
      canonicalName: 'Cotton',
      nameMarathi: 'कापूस',
      nameHindi: 'कपास',
      yieldPerAcre: 7, // 7 Quintals/Acre
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    wheat: {
      canonicalName: 'Wheat',
      nameMarathi: 'गहू',
      nameHindi: 'गेहूं',
      yieldPerAcre: 15, // 15 Quintals/Acre
      source: 'assumed',
      season: 'rabi',
      toleranceMultiplier: 1.5
    },
    onion: {
      canonicalName: 'Onion',
      nameMarathi: 'कांदा',
      nameHindi: 'प्याज',
      yieldPerAcre: 100, // 100 Quintals/Acre
      source: 'assumed',
      season: 'kharif', // Also grown in Rabi/Late Kharif
      toleranceMultiplier: 1.5
    },
    red_onion: {
      canonicalName: 'Red Onion',
      nameMarathi: 'लाल कांदा',
      nameHindi: 'लाल प्याज',
      yieldPerAcre: 100,
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    maize: {
      canonicalName: 'Maize',
      nameMarathi: 'मका',
      nameHindi: 'मक्का',
      yieldPerAcre: 18, // 18 Quintals/Acre
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    yellow_maize: {
      canonicalName: 'Yellow Maize',
      nameMarathi: 'पिवळी मका',
      nameHindi: 'पीला मक्का',
      yieldPerAcre: 18,
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    gram: {
      canonicalName: 'Gram (Chana)',
      nameMarathi: 'हरभरा / चणा',
      nameHindi: 'चना',
      yieldPerAcre: 6, // 6 Quintals/Acre
      source: 'assumed',
      season: 'rabi',
      toleranceMultiplier: 1.5
    },
    chana: {
      canonicalName: 'Chana',
      nameMarathi: 'हरभरा',
      nameHindi: 'चना',
      yieldPerAcre: 6,
      source: 'assumed',
      season: 'rabi',
      toleranceMultiplier: 1.5
    },
    tur: {
      canonicalName: 'Tur (Arhar)',
      nameMarathi: 'तूर',
      nameHindi: 'अरहर / तुअर',
      yieldPerAcre: 5, // 5 Quintals/Acre
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    paddy: {
      canonicalName: 'Paddy / Rice',
      nameMarathi: 'भात / तांदूळ',
      nameHindi: 'धान / चावल',
      yieldPerAcre: 16, // 16 Quintals/Acre
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    bajra: {
      canonicalName: 'Bajra',
      nameMarathi: 'बाजरी',
      nameHindi: 'बाजरा',
      yieldPerAcre: 10,
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    },
    jowar: {
      canonicalName: 'Jowar',
      nameMarathi: 'ज्वारी',
      nameHindi: 'ज्वार',
      yieldPerAcre: 10,
      source: 'assumed',
      season: 'rabi',
      toleranceMultiplier: 1.5
    },
    sugarcane: {
      canonicalName: 'Sugarcane',
      nameMarathi: 'ऊस',
      nameHindi: 'गन्ना',
      yieldPerAcre: 350, // 350 Quintals/Acre
      source: 'assumed',
      season: 'annual',
      toleranceMultiplier: 1.5
    },
    default: {
      canonicalName: 'Other Commodity',
      nameMarathi: 'इतर कृषी उत्पन्न',
      nameHindi: 'अन्य कृषि उपज',
      yieldPerAcre: 10,
      source: 'assumed',
      season: 'kharif',
      toleranceMultiplier: 1.5
    }
  }
};

/**
 * Normalize crop string to config key
 */
function normalizeCropKey(cropName) {
  if (!cropName || typeof cropName !== 'string') return 'default';
  const clean = cropName.trim().toLowerCase().replace(/[\s\-_/()]+/g, '_');
  
  if (clean.includes('soybean') || clean.includes('soya')) return 'soybean';
  if (clean.includes('cotton') || clean.includes('kapas') || clean.includes('kapus')) return 'cotton';
  if (clean.includes('wheat') || clean.includes('gehu') || clean.includes('gahu')) return 'wheat';
  if (clean.includes('red_onion') || (clean.includes('red') && clean.includes('onion'))) return 'red_onion';
  if (clean.includes('onion') || clean.includes('kanda') || clean.includes('pyaj')) return 'onion';
  if (clean.includes('yellow_maize') || (clean.includes('yellow') && clean.includes('maize'))) return 'yellow_maize';
  if (clean.includes('maize') || clean.includes('maka') || clean.includes('makka')) return 'maize';
  if (clean.includes('gram') || clean.includes('chana') || clean.includes('harbhara')) return 'gram';
  if (clean.includes('tur') || clean.includes('arhar') || clean.includes('toor')) return 'tur';
  if (clean.includes('paddy') || clean.includes('rice') || clean.includes('dhan') || clean.includes('bhat')) return 'paddy';
  if (clean.includes('bajra') || clean.includes('bajri')) return 'bajra';
  if (clean.includes('jowar') || clean.includes('jwari')) return 'jowar';
  if (clean.includes('sugarcane') || clean.includes('us') || clean.includes('ganna')) return 'sugarcane';
  
  return LAND_YIELD_CONFIG.crops[clean] ? clean : 'default';
}

/**
 * Get crop yield configuration
 */
function getCropYieldConfig(cropName) {
  const key = normalizeCropKey(cropName);
  return LAND_YIELD_CONFIG.crops[key] || LAND_YIELD_CONFIG.crops.default;
}

/**
 * Get current season date bounds
 * @param {Date} [targetDate] 
 * @returns {{ seasonKey: string, seasonName: string, startDate: Date, endDate: Date }}
 */
function getCurrentSeasonBounds(targetDate = new Date()) {
  const date = new Date(targetDate);
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  // Kharif: June (6) through October (10)
  if (month >= 6 && month <= 10) {
    return {
      seasonKey: 'kharif',
      seasonName: 'Kharif',
      startDate: new Date(year, 5, 1, 0, 0, 0, 0), // June 1
      endDate: new Date(year, 9, 31, 23, 59, 59, 999) // October 31
    };
  }

  // Rabi: November (11) through May (5)
  if (month >= 11) {
    return {
      seasonKey: 'rabi',
      seasonName: 'Rabi',
      startDate: new Date(year, 10, 1, 0, 0, 0, 0), // November 1
      endDate: new Date(year + 1, 4, 31, 23, 59, 59, 999) // May 31 next year
    };
  } else {
    // January through May belongs to the Rabi season that started in November of prior year
    return {
      seasonKey: 'rabi',
      seasonName: 'Rabi',
      startDate: new Date(year - 1, 10, 1, 0, 0, 0, 0), // November 1 prev year
      endDate: new Date(year, 4, 31, 23, 59, 59, 999) // May 31 this year
    };
  }
}

/**
 * Calculate expected max yield in Quintals
 * expected max = areaAcres * yieldPerAcre * toleranceMultiplier
 */
function calculateExpectedMaxYield(cropName, areaAcres, customTolerance = null) {
  const area = Number(areaAcres) || 0;
  if (area <= 0) return 0;

  const cfg = getCropYieldConfig(cropName);
  const tolerance = customTolerance !== null ? Number(customTolerance) : (cfg.toleranceMultiplier || LAND_YIELD_CONFIG.defaultToleranceMultiplier);
  const baseYield = cfg.yieldPerAcre || 10;

  const expectedMax = Math.round(area * baseYield * tolerance * 100) / 100;
  return {
    cropKey: normalizeCropKey(cropName),
    cropName: cfg.canonicalName,
    areaAcres: area,
    yieldPerAcre: baseYield,
    toleranceMultiplier: tolerance,
    expectedMax,
    source: cfg.source || 'assumed'
  };
}

module.exports = {
  LAND_YIELD_CONFIG,
  normalizeCropKey,
  getCropYieldConfig,
  getCurrentSeasonBounds,
  calculateExpectedMaxYield
};
