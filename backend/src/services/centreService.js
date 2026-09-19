const mongoose = require('mongoose');
const { Centre, Booking } = require('../models');
const logger = require('../utils/logger');

// In-memory fallback for centres when DB is in testing/mock mode
const inMemoryCentres = new Map();

// Official 6 Reference APMC Centres Master Data
const OFFICIAL_CENTRES = [
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
    code: 'KPG-01',
    name: 'APMC Kopargaon',
    nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Kopargaon, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.4829, 19.8370] // [lng, lat]
    },
    cropsHandled: ['Wheat', 'Soybean', 'Onion', 'Cotton'],
    workingHours: { start: '08:00', end: '18:00' },
    capacityConfig: [
      { crop: 'Wheat', maxDailySlots: 60, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 3, durationMinutes: 30 },
      { crop: 'Soybean', maxDailySlots: 40, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ],
    currentStatus: 'Green'
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d2'),
    code: 'SRD-02',
    name: 'APMC Shirdi',
    nameMarathi: 'शिर्डी कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Shirdi, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.4754, 19.7668] // [lng, lat]
    },
    cropsHandled: ['Wheat', 'Soybean', 'Onion'],
    workingHours: { start: '08:00', end: '18:00' },
    capacityConfig: [
      { crop: 'Wheat', maxDailySlots: 50, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ],
    currentStatus: 'Amber'
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d3'),
    code: 'RHT-03',
    name: 'APMC Rahata',
    nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Rahata, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.4800, 19.7171] // [lng, lat]
    },
    cropsHandled: ['Wheat', 'Cotton', 'Soybean'],
    workingHours: { start: '08:00', end: '18:00' },
    capacityConfig: [
      { crop: 'Wheat', maxDailySlots: 40, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ],
    currentStatus: 'Green'
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d4'),
    code: 'VJP-04',
    name: 'APMC Vaijapur',
    nameMarathi: 'वैजापूर कृषी उत्पन्न बाजार समिती',
    district: 'Chhatrapati Sambhajinagar',
    locationName: 'Vaijapur, Chhatrapati Sambhajinagar',
    location: {
      type: 'Point',
      coordinates: [74.8332, 19.9489] // [lng, lat]
    },
    cropsHandled: ['Onion', 'Wheat', 'Soybean'],
    workingHours: { start: '08:00', end: '18:00' },
    capacityConfig: [
      { crop: 'Onion', maxDailySlots: 50, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ],
    currentStatus: 'Amber'
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d5'),
    code: 'SRP-05',
    name: 'APMC Shrirampur',
    nameMarathi: 'श्रीरामपूर कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Shrirampur, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.7007, 19.6420] // [lng, lat]
    },
    cropsHandled: ['Soybean', 'Cotton', 'Wheat'],
    workingHours: { start: '08:00', end: '18:00' },
    capacityConfig: [
      { crop: 'Soybean', maxDailySlots: 45, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ],
    currentStatus: 'Red'
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d6'),
    code: 'LSG-06',
    name: 'APMC Lasalgaon',
    nameMarathi: 'लासलगाव कांदा बाजार समिती',
    district: 'Nashik',
    locationName: 'Lasalgaon, Niphad, Nashik',
    location: {
      type: 'Point',
      coordinates: [74.2378, 20.1427] // [lng, lat]
    },
    cropsHandled: ['Red Onion', 'Wheat', 'Maize'],
    workingHours: { start: '08:00', end: '18:00' },
    capacityConfig: [
      { crop: 'Red Onion', maxDailySlots: 70, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 4, durationMinutes: 20 }
    ],
    currentStatus: 'Green'
  }
];

const centreService = {
  /**
   * Safe migration & upsert ensuring all 6 official APMC centres exist
   * and purging any legacy placeholder ("Nagpur" / "Central Hub").
   */
  ensureOfficialCentres: async () => {
    // 1. Prime in-memory store
    OFFICIAL_CENTRES.forEach((c) => {
      inMemoryCentres.set(c._id.toString(), c);
      inMemoryCentres.set(c.code, c);
    });

    if (mongoose.connection.readyState === 1) {
      try {
        // 2. Remove legacy placeholder centre if present
        await Centre.deleteMany({
          $or: [
            { name: /Nagpur|Central Hub/i },
            { name: { $regex: 'APMC Central Hub - Nagpur', $options: 'i' } }
          ]
        });

        // 3. Upsert each official centre by unique code
        for (const centreData of OFFICIAL_CENTRES) {
          await Centre.findOneAndUpdate(
            { $or: [{ code: centreData.code }, { name: centreData.name }] },
            { $set: centreData },
            { upsert: true, new: true, runValidators: true }
          );
        }
        logger.info(`[Centres] Verified and synchronized all ${OFFICIAL_CENTRES.length} official APMC centres in MongoDB.`);
      } catch (err) {
        logger.warn(`[Centres] Sync warning (falling back to memory): ${err.message}`);
      }
    }
  },

  /**
   * List all centres with computed live traffic load status (Green / Amber / Red)
   */
  getAllCentres: async (filters = {}) => {
    let centres = [];
    const query = {};

    if (filters.crop) {
      query.cropsHandled = { $in: [filters.crop] };
    }

    try {
      if (mongoose.connection.readyState === 1) {
        // Check if all 6 official codes exist in database
        const existingCodes = await Centre.distinct('code');
        const expectedCodes = OFFICIAL_CENTRES.map(c => c.code);
        const hasAll = expectedCodes.every(code => existingCodes.includes(code));

        if (!hasAll) {
          await centreService.ensureOfficialCentres();
        }

        centres = await Centre.find(query).lean();
      } else {
        if (inMemoryCentres.size === 0) {
          await centreService.ensureOfficialCentres();
        }
        // Extract unique centres by _id from inMemoryCentres map
        const uniqueMap = new Map();
        inMemoryCentres.forEach(c => uniqueMap.set(c._id.toString(), c));
        centres = Array.from(uniqueMap.values());
      }
    } catch (err) {
      logger.warn(`Fallback to memory for centres: ${err.message}`);
      if (inMemoryCentres.size === 0) {
        await centreService.ensureOfficialCentres();
      }
      const uniqueMap = new Map();
      inMemoryCentres.forEach(c => uniqueMap.set(c._id.toString(), c));
      centres = Array.from(uniqueMap.values());
    }

    // Compute live capacity and load for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const enrichedCentres = await Promise.all(
      centres.map(async (centre) => {
        let activeBookingsCount = 0;
        try {
          if (mongoose.connection.readyState === 1) {
            activeBookingsCount = await Booking.countDocuments({
              centreId: centre._id,
              status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
              arrivalWindowStart: { $gte: todayStart, $lte: todayEnd }
            });
          }
        } catch (e) {
          activeBookingsCount = 0;
        }

        // Sum max daily slots across capacityConfig
        const totalCapacity =
          centre.capacityConfig?.reduce((sum, c) => sum + (c.maxDailySlots || 50), 0) || 100;

        const utilizationPercent = Math.min(100, Math.round((activeBookingsCount / totalCapacity) * 100));

        // Traffic Light Logic: Green (<70%), Amber (70-90%), Red (>90%)
        let computedStatus = 'Green';
        if (utilizationPercent > 90) {
          computedStatus = 'Red';
        } else if (utilizationPercent >= 70) {
          computedStatus = 'Amber';
        }

        return {
          ...centre,
          currentStatus: computedStatus,
          activeBookingsCount,
          totalCapacity,
          utilizationPercent
        };
      })
    );

    return enrichedCentres;
  },

  /**
   * Get single centre details
   */
  getCentreById: async (id) => {
    let centre = null;
    try {
      if (mongoose.connection.readyState === 1) {
        centre = await Centre.findById(id);
      } else if (inMemoryCentres.has(id.toString())) {
        centre = inMemoryCentres.get(id.toString());
      }
    } catch (err) {
      if (inMemoryCentres.has(id.toString())) {
        centre = inMemoryCentres.get(id.toString());
      }
    }

    if (!centre) {
      throw new Error(`Centre with ID ${id} not found`);
    }

    return centre;
  },

  /**
   * Compute available arrival windows for a specific crop and date
   */
  getCentreAvailability: async (centreId, { crop, quantityBand, date }) => {
    const centre = await centreService.getCentreById(centreId);

    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Find capacity config for the crop
    const cropConfig = centre.capacityConfig?.find((c) => c.crop.toLowerCase() === (crop || '').toLowerCase()) ||
      centre.capacityConfig?.[0] || {
        crop: crop || 'General',
        maxDailySlots: 50,
        lanes: 2,
        durationMinutes: 30
      };

    const durationMinutes = cropConfig.durationMinutes || 30;
    const workingHours = centre.workingHours || { start: '08:00', end: '18:00' };

    const [startHour, startMin] = workingHours.start.split(':').map(Number);
    const [endHour, endMin] = workingHours.end.split(':').map(Number);

    const startTime = new Date(dateStr);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(dateStr);
    endTime.setHours(endHour, endMin, 0, 0);

    // Calculate slots per window based on total lanes and daily slots
    const totalMinutes = (endTime - startTime) / (1000 * 60);
    const totalWindows = Math.max(1, Math.floor(totalMinutes / durationMinutes));
    const slotsPerWindow = Math.max(2, Math.ceil((cropConfig.maxDailySlots || 50) / totalWindows));

    const windows = [];
    let currentWindowStart = new Date(startTime);

    while (currentWindowStart < endTime) {
      const currentWindowEnd = new Date(currentWindowStart.getTime() + durationMinutes * 60 * 1000);
      if (currentWindowEnd > endTime) break;

      // Count booked slots in this arrival window
      let bookedSlots = 0;
      try {
        if (mongoose.connection.readyState === 1) {
          bookedSlots = await Booking.countDocuments({
            centreId: centre._id,
            crop: cropConfig.crop,
            status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
            arrivalWindowStart: { $lt: currentWindowEnd },
            arrivalWindowEnd: { $gt: currentWindowStart }
          });
        }
      } catch (err) {
        bookedSlots = 0;
      }

      const availableSlots = Math.max(0, slotsPerWindow - bookedSlots);
      const isAvailable = availableSlots > 0;

      const formatTime = (d) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      windows.push({
        windowStart: currentWindowStart.toISOString(),
        windowEnd: currentWindowEnd.toISOString(),
        timeLabel: `${formatTime(currentWindowStart)} - ${formatTime(currentWindowEnd)}`,
        maxSlots: slotsPerWindow,
        bookedSlots,
        availableSlots,
        isAvailable
      });

      currentWindowStart = currentWindowEnd;
    }

    return {
      centreId: centre._id,
      centreName: centre.name,
      date: dateStr,
      crop: cropConfig.crop,
      quantityBand: quantityBand || '0-5q',
      durationMinutes,
      totalWindows: windows.length,
      windows
    };
  },

  /**
   * Create a new Centre (Admin / Supervisor)
   */
  createCentre: async (centreData) => {
    let centre = null;
    try {
      if (mongoose.connection.readyState === 1) {
        centre = await Centre.create(centreData);
      }
    } catch (err) {
      logger.warn(`Direct DB create bypassed: ${err.message}`);
    }

    if (!centre) {
      centre = {
        _id: new mongoose.Types.ObjectId(),
        ...centreData,
        currentStatus: 'Green'
      };
      inMemoryCentres.set(centre._id.toString(), centre);
    }

    return centre;
  }
};

module.exports = centreService;
