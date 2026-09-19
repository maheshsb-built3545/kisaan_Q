const mongoose = require('mongoose');
const adminService = require('../services/adminService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const Token = require('../models/Token');
const Farmer = require('../models/Farmer');
const Booking = require('../models/Booking');
const QueueState = require('../models/QueueState');
const ProcurementRecord = require('../models/ProcurementRecord');
const Exception = require('../models/Exception');
const tokenRoutes = require('../routes/token.routes');

const DEFAULT_DEMO_FARMERS = [
  {
    name: 'Mahesh Borde',
    phone: '9876543210',
    preferredLanguage: 'mr',
    registeredVia: 'manual_admin',
    village: 'Kopargaon (Station Road)',
    crop: 'Wheat',
    landArea: 3.5,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-KPG-2026-0811',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Suresh Patil',
    phone: '9876543211',
    preferredLanguage: 'hi',
    registeredVia: 'manual_admin',
    village: 'Shirdi (Nimgaon)',
    crop: 'Soybean',
    landArea: 4.2,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-SRD-2026-0422',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Ganesh Deshmukh',
    phone: '9876543212',
    preferredLanguage: 'mr',
    registeredVia: 'manual_admin',
    village: 'Rahata (Sakori)',
    crop: 'Onion',
    landArea: 2.8,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-RHT-2026-0933',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Ramesh Jadhav',
    phone: '9876543213',
    preferredLanguage: 'mr',
    registeredVia: 'manual_admin',
    village: 'Vaijapur (Shivaji Nagar)',
    crop: 'Cotton',
    landArea: 5.5,
    district: 'Chhatrapati Sambhajinagar',
    state: 'Maharashtra',
    kisanId: 'MH-VJP-2026-0155',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Prakash Shinde',
    phone: '9876543214',
    preferredLanguage: 'en',
    registeredVia: 'manual_admin',
    village: 'Shrirampur (Belapur Road)',
    crop: 'Wheat',
    landArea: 3.0,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-SRP-2026-0788',
    pendingDues: 0,
    cancellationHistory: []
  }
];

// In-memory fallback farmer registry
const inMemoryFarmersMap = new Map();
DEFAULT_DEMO_FARMERS.forEach((f) => inMemoryFarmersMap.set(f.phone, { ...f, createdAt: new Date() }));

const adminController = {
  /**
   * GET /api/admin/dashboard-stats
   */
  getDashboardStats: async (req, res) => {
    try {
      const stats = await adminService.getDashboardStats();
      return successResponse(res, stats, 'District admin dashboard statistics retrieved successfully', 200);
    } catch (error) {
      return errorResponse(res, error.message || 'Failed to retrieve admin dashboard stats', 500);
    }
  },

  /**
   * POST /api/admin/reset-data
   * Purges all dynamic tokens, queues, procurement records, dues and re-seeds standard demo farmers
   */
  resetData: async (req, res) => {
    try {
      let tokensDeleted = 0;
      let bookingsDeleted = 0;
      let queuesDeleted = 0;
      let recordsDeleted = 0;

      // Clear in-memory token and dues stores
      if (typeof tokenRoutes.inMemoryResetAll === 'function') {
        tokenRoutes.inMemoryResetAll();
      }

      // Reset in-memory farmers map to defaults
      inMemoryFarmersMap.clear();
      DEFAULT_DEMO_FARMERS.forEach((f) => inMemoryFarmersMap.set(f.phone, { ...f, createdAt: new Date() }));

      if (mongoose.connection.readyState === 1) {
        const tDel = await Token.deleteMany({});
        tokensDeleted = tDel.deletedCount;

        try {
          const bDel = await Booking.deleteMany({});
          bookingsDeleted = bDel.deletedCount;
        } catch (e) {}

        try {
          const qDel = await QueueState.deleteMany({});
          queuesDeleted = qDel.deletedCount;
        } catch (e) {}

        try {
          const pDel = await ProcurementRecord.deleteMany({});
          recordsDeleted = pDel.deletedCount;
        } catch (e) {}

        try {
          await Exception.deleteMany({});
        } catch (e) {}

        // Reset farmer dues & cancellation history
        await Farmer.updateMany({}, {
          $set: {
            pendingDues: 0,
            cancellationHistory: []
          }
        });

        // Re-seed standard regional farmers
        for (const farmerData of DEFAULT_DEMO_FARMERS) {
          await Farmer.findOneAndUpdate(
            { phone: farmerData.phone },
            { $set: farmerData },
            { upsert: true, new: true }
          );
        }
      }

      return successResponse(
        res,
        {
          purged: {
            tokens: tokensDeleted,
            bookings: bookingsDeleted,
            queues: queuesDeleted,
            procurementRecords: recordsDeleted
          },
          farmersReady: DEFAULT_DEMO_FARMERS.length,
          farmers: DEFAULT_DEMO_FARMERS
        },
        'KisanQ Database and operational queues reset successfully. Demo state re-seeded.',
        200
      );
    } catch (error) {
      return errorResponse(res, error.message || 'Failed to reset database', 500);
    }
  },

  /**
   * GET /api/admin/farmers
   * Lists all registered farmers with dues, villages, crops, and active token status
   */
  getFarmers: async (req, res) => {
    try {
      let farmers = [];

      if (mongoose.connection.readyState === 1) {
        farmers = await Farmer.find({}).sort({ updatedAt: -1 }).lean();
      }

      if (!farmers || farmers.length === 0) {
        farmers = Array.from(inMemoryFarmersMap.values());
      }

      // Populate active token for each farmer if any
      const enriched = await Promise.all(
        farmers.map(async (farmer) => {
          let activeToken = null;
          if (mongoose.connection.readyState === 1) {
            activeToken = await Token.findOne({
              $or: [{ farmerPhone: farmer.phone }, { phone: farmer.phone }],
              status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
            }).lean();
          }
          return {
            ...farmer,
            activeToken: activeToken
              ? {
                  tokenNumber: activeToken.tokenNumber,
                  mandiName: activeToken.mandiName,
                  crop: activeToken.crop,
                  status: activeToken.status,
                  slotDate: activeToken.slotDate,
                  slotTime: activeToken.slotTime || activeToken.slotLabel
                }
              : null
          };
        })
      );

      return successResponse(res, { count: enriched.length, farmers: enriched }, 'Farmers retrieved successfully', 200);
    } catch (error) {
      return errorResponse(res, error.message || 'Failed to fetch farmers', 500);
    }
  },

  /**
   * POST /api/admin/farmers
   * Manually register or provision a farmer profile
   */
  createFarmer: async (req, res) => {
    try {
      const {
        name,
        phone,
        village = 'Kopargaon',
        crop = 'Wheat',
        landArea = 2.5,
        district = 'Ahmednagar',
        state = 'Maharashtra',
        preferredLanguage = 'mr'
      } = req.body;

      if (!name || !phone) {
        return errorResponse(res, 'Farmer name and 10-digit mobile number are required', 400);
      }

      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        return errorResponse(res, 'Please provide a valid 10-digit Indian phone number', 400);
      }

      const kisanId = `MH-${village.slice(0, 3).toUpperCase()}-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const farmerPayload = {
        name: name.trim(),
        phone: cleanPhone,
        village: village.trim(),
        crop: crop.trim(),
        landArea: Number(landArea) || 2.5,
        district: district.trim(),
        state: state.trim(),
        preferredLanguage,
        kisanId,
        registeredVia: 'manual_admin',
        pendingDues: 0,
        cancellationHistory: []
      };

      let savedFarmer = null;

      if (mongoose.connection.readyState === 1) {
        savedFarmer = await Farmer.findOneAndUpdate(
          { phone: cleanPhone },
          { $set: farmerPayload },
          { upsert: true, new: true }
        );
      } else {
        inMemoryFarmersMap.set(cleanPhone, { ...farmerPayload, createdAt: new Date() });
        savedFarmer = inMemoryFarmersMap.get(cleanPhone);
      }

      return successResponse(res, { farmer: savedFarmer }, `Farmer ${savedFarmer.name} registered successfully with ID ${kisanId}`, 201);
    } catch (error) {
      return errorResponse(res, error.message || 'Failed to register farmer', 500);
    }
  }
};

module.exports = adminController;

