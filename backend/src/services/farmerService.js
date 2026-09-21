const mongoose = require('mongoose');
const { Farmer, AuditLog } = require('../models');
const { inMemoryFarmers } = require('./authService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

const farmerService = {
  /**
   * Save or update the farmer's pickup location
   */
  updatePickupLocation: async ({ farmerId, phone, latitude, longitude, address }) => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      const err = new Error('Valid latitude (-90 to 90) and longitude (-180 to 180) are required');
      err.statusCode = 400;
      throw err;
    }

    const pickupLocation = {
      type: 'Point',
      coordinates: [lng, lat],
      address: address || 'Saved Pickup Location'
    };

    const rawPhone = (phone || '').toString().trim().replace(/\D/g, '');
    let farmer = null;

    if (mongoose.connection.readyState === 1) {
      if (farmerId && mongoose.Types.ObjectId.isValid(farmerId)) {
        farmer = await Farmer.findById(farmerId);
      }
      if (!farmer && rawPhone) {
        farmer = await Farmer.findOne({ phone: rawPhone });
      }

      if (farmer) {
        farmer.pickupLocation = pickupLocation;
        await farmer.save();
        logger.info(`[Farmer Location] Updated pickup location for ${farmer.phone} in MongoDB`);
      }
    }

    // In-memory fallback / cache update
    const memKey = rawPhone || (farmer ? farmer.phone : null);
    if (memKey && inMemoryFarmers && inMemoryFarmers.has(memKey)) {
      const memFarmer = inMemoryFarmers.get(memKey);
      memFarmer.pickupLocation = pickupLocation;
      inMemoryFarmers.set(memKey, memFarmer);
      if (!farmer) farmer = memFarmer;
      logger.info(`[Farmer Location] Updated pickup location in-memory for ${memKey}`);
    } else if (memKey && inMemoryFarmers) {
      const newMem = {
        _id: farmer?._id || new mongoose.Types.ObjectId(),
        phone: memKey,
        name: farmer?.name || `Farmer ${memKey.slice(-4)}`,
        pickupLocation
      };
      inMemoryFarmers.set(memKey, newMem);
      if (!farmer) farmer = newMem;
    }

    if (!farmer) {
      const err = new Error('Farmer record not found');
      err.statusCode = 404;
      throw err;
    }

    return {
      pickupLocation: farmer.pickupLocation,
      user: {
        id: farmer._id,
        phone: farmer.phone,
        name: farmer.name,
        preferredLanguage: farmer.preferredLanguage,
        pickupLocation: farmer.pickupLocation
      }
    };
  },

  /**
   * Save or update the farmer's Expo push token
   */
  updatePushToken: async ({ farmerId, phone, pushToken }) => {
    if (!pushToken || typeof pushToken !== 'string' || !pushToken.trim()) {
      const err = new Error('A valid push token string is required');
      err.statusCode = 400;
      throw err;
    }

    const tokenStr = pushToken.trim();
    const rawPhone = (phone || '').toString().trim().replace(/\D/g, '');
    let farmer = null;

    if (mongoose.connection.readyState === 1) {
      if (farmerId && mongoose.Types.ObjectId.isValid(farmerId)) {
        farmer = await Farmer.findById(farmerId);
      }
      if (!farmer && rawPhone) {
        farmer = await Farmer.findOne({ phone: rawPhone });
      }

      if (farmer) {
        farmer.pushToken = tokenStr;
        await farmer.save();
        logger.info(`[Push Token] Updated push token for ${farmer.phone} in MongoDB`);
      }
    }

    // In-memory fallback / cache update
    const memKey = rawPhone || (farmer ? farmer.phone : null);
    if (memKey && inMemoryFarmers && inMemoryFarmers.has(memKey)) {
      const memFarmer = inMemoryFarmers.get(memKey);
      memFarmer.pushToken = tokenStr;
      inMemoryFarmers.set(memKey, memFarmer);
      if (!farmer) farmer = memFarmer;
      logger.info(`[Push Token] Updated push token in-memory for ${memKey}`);
    } else if (memKey && inMemoryFarmers) {
      const newMem = {
        _id: farmer?._id || new mongoose.Types.ObjectId(),
        phone: memKey,
        name: farmer?.name || `Farmer ${memKey.slice(-4)}`,
        pushToken: tokenStr
      };
      inMemoryFarmers.set(memKey, newMem);
      if (!farmer) farmer = newMem;
    }

    if (!farmer) {
      const err = new Error('Farmer record not found');
      err.statusCode = 404;
      throw err;
    }

    return {
      pushToken: tokenStr,
      user: {
        id: farmer._id,
        phone: farmer.phone,
        name: farmer.name,
        preferredLanguage: farmer.preferredLanguage,
        pushToken: tokenStr
      }
    };
  },

  /**
   * Save or update farmer's Land Record
   * Identity comes from authenticated farmer JWT only.
   */
  updateLandRecord: async ({ farmerId, phone, landData }) => {
    const {
      surveyNumber,
      gatNumber,
      village,
      taluka,
      district,
      areaAcres,
      ownershipType = 'owner',
      ownerNameOn712,
      source = 'self'
    } = landData || {};

    const area = Number(areaAcres);
    if (isNaN(area) || area <= 0) {
      const err = new Error('Land area must be a valid positive decimal number greater than 0.');
      err.statusCode = 400;
      throw err;
    }

    const validOwnerships = ['owner', 'co_owner', 'tenant', 'family_holding'];
    if (ownershipType && !validOwnerships.includes(ownershipType)) {
      const err = new Error(`Invalid ownershipType '${ownershipType}'. Must be one of: ${validOwnerships.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const landRecord = {
      surveyNumber: (surveyNumber || '').toString().trim(),
      gatNumber: (gatNumber || '').toString().trim(),
      village: (village || '').toString().trim(),
      taluka: (taluka || '').toString().trim(),
      district: (district || '').toString().trim(),
      areaAcres: Math.round(area * 100) / 100,
      ownershipType,
      ownerNameOn712: (ownerNameOn712 || '').toString().trim(),
      source: ['self', 'auto_filled'].includes(source) ? source : 'self',
      verificationStatus: 'pending', // Self-declared, pending verification
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: null
    };

    const rawPhone = (phone || '').toString().trim().replace(/\D/g, '');
    let farmer = null;

    if (mongoose.connection.readyState === 1) {
      if (farmerId && mongoose.Types.ObjectId.isValid(farmerId)) {
        farmer = await Farmer.findById(farmerId);
      }
      if (!farmer && rawPhone) {
        farmer = await Farmer.findOne({ phone: rawPhone });
      }

      if (farmer) {
        farmer.landRecord = landRecord;
        if (village) farmer.village = village;
        if (district) farmer.district = district;
        farmer.landArea = area;
        await farmer.save();
        logger.info(`[Land Record] Updated land record for ${farmer.phone} in MongoDB (${area} acres)`);
      }
    }

    // In-memory fallback / cache update
    const memKey = rawPhone || (farmer ? farmer.phone : null);
    if (memKey && inMemoryFarmers && inMemoryFarmers.has(memKey)) {
      const memFarmer = inMemoryFarmers.get(memKey);
      memFarmer.landRecord = landRecord;
      memFarmer.landArea = area;
      inMemoryFarmers.set(memKey, memFarmer);
      if (!farmer) farmer = memFarmer;
    } else if (memKey && inMemoryFarmers) {
      const newMem = {
        _id: farmer?._id || new mongoose.Types.ObjectId(),
        phone: memKey,
        name: farmer?.name || `Farmer ${memKey.slice(-4)}`,
        landRecord,
        landArea: area
      };
      inMemoryFarmers.set(memKey, newMem);
      if (!farmer) farmer = newMem;
    }

    if (!farmer) {
      const err = new Error('Farmer record not found');
      err.statusCode = 404;
      throw err;
    }

    // Audit Log entry
    try {
      if (mongoose.connection.readyState === 1) {
        await AuditLog.create({
          actorId: farmer._id,
          actorRole: 'farmer',
          action: 'LAND_RECORD_UPDATED',
          targetId: farmer._id,
          reason: `Farmer updated declared land details: ${area} acres, ${ownershipType}`,
          timestamp: new Date()
        });
      }
    } catch (auditErr) {
      logger.warn(`[Land Record] Audit log notice: ${auditErr.message}`);
    }

    return {
      landRecord: farmer.landRecord,
      user: {
        id: farmer._id,
        phone: farmer.phone,
        name: farmer.name,
        preferredLanguage: farmer.preferredLanguage,
        landRecord: farmer.landRecord
      }
    };
  },

  /**
   * Get land record for a farmer
   */
  getLandRecord: async ({ farmerId, phone }) => {
    const rawPhone = (phone || '').toString().trim().replace(/\D/g, '');
    let farmer = null;

    if (mongoose.connection.readyState === 1) {
      if (farmerId && mongoose.Types.ObjectId.isValid(farmerId)) {
        farmer = await Farmer.findById(farmerId);
      }
      if (!farmer && rawPhone) {
        farmer = await Farmer.findOne({ phone: rawPhone });
      }
    }

    if (!farmer && inMemoryFarmers) {
      const memKey = rawPhone || (farmerId ? farmerId.toString() : null);
      if (memKey && inMemoryFarmers.has(memKey)) {
        farmer = inMemoryFarmers.get(memKey);
      }
    }

    if (!farmer) {
      const err = new Error('Farmer record not found');
      err.statusCode = 404;
      throw err;
    }

    return farmer.landRecord || {
      surveyNumber: '',
      gatNumber: '',
      village: farmer.village || '',
      taluka: '',
      district: farmer.district || '',
      areaAcres: farmer.landArea || 0,
      ownershipType: 'owner',
      ownerNameOn712: '',
      source: 'self',
      verificationStatus: 'pending',
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: null
    };
  },

  /**
   * Supervisor or Resource Officer verifies or rejects farmer land record
   */
  verifyLandRecord: async ({ farmerId, staffUser, status, reason }) => {
    if (!status || !['verified', 'rejected'].includes(status)) {
      const err = new Error("Verification status must be either 'verified' or 'rejected'.");
      err.statusCode = 400;
      throw err;
    }

    if (status === 'rejected' && (!reason || typeof reason !== 'string' || !reason.trim())) {
      const err = new Error('A detailed reason is mandatory when rejecting a land record.');
      err.statusCode = 400;
      throw err;
    }

    // Role check: Only supervisor or resource_officer (or admin) can verify
    const allowedRoles = ['supervisor', 'resource_officer', 'admin'];
    if (!allowedRoles.includes(staffUser?.role)) {
      const err = new Error('Access denied: Only Mandi Supervisor or Resource Officer can verify or reject land records.');
      err.statusCode = 403;
      throw err;
    }

    let farmer = null;
    if (mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(farmerId)) {
        farmer = await Farmer.findById(farmerId);
      }
      if (!farmer) {
        farmer = await Farmer.findOne({ $or: [{ phone: farmerId }, { kisanId: farmerId }] });
      }
    }

    if (!farmer && inMemoryFarmers) {
      if (inMemoryFarmers.has(farmerId)) {
        farmer = inMemoryFarmers.get(farmerId);
      } else {
        for (const [, f] of inMemoryFarmers.entries()) {
          if (f._id?.toString() === farmerId?.toString() || f.phone === farmerId) {
            farmer = f;
            break;
          }
        }
      }
    }

    if (!farmer) {
      const err = new Error(`Farmer ${farmerId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (!farmer.landRecord) {
      farmer.landRecord = {
        surveyNumber: '',
        gatNumber: '',
        village: farmer.village || '',
        taluka: '',
        district: farmer.district || '',
        areaAcres: farmer.landArea || 1,
        ownershipType: 'owner',
        ownerNameOn712: '',
        source: 'self'
      };
    }

    farmer.landRecord.verificationStatus = status;
    farmer.landRecord.verifiedBy = staffUser.name || staffUser.phone || staffUser.id || 'Supervisor Desk';
    farmer.landRecord.verifiedAt = new Date();
    farmer.landRecord.rejectionReason = status === 'rejected' ? reason.trim() : null;

    if (mongoose.connection.readyState === 1 && farmer.save) {
      await farmer.save();
      logger.info(`[Land Verification] Farmer ${farmer.phone} land marked as ${status} by ${staffUser.role} in MongoDB`);
    }

    // Audit Log
    const auditAction = status === 'verified' ? 'LAND_VERIFIED' : 'LAND_REJECTED';
    try {
      if (mongoose.connection.readyState === 1) {
        await AuditLog.create({
          actorId: staffUser.id || staffUser.phone || 'STAFF',
          actorRole: staffUser.role || 'supervisor',
          action: auditAction,
          targetId: farmer._id || farmerId,
          reason: status === 'rejected' ? reason.trim() : `Land record verified by ${staffUser.name || staffUser.role}`,
          timestamp: new Date()
        });
      }
    } catch (auditErr) {
      logger.warn(`[Land Verification] Audit log notice: ${auditErr.message}`);
    }

    // Notification to Farmer
    try {
      const farmerIdStr = (farmer._id || farmer.phone || farmerId).toString();
      notificationService.notify(
        { id: farmerIdStr, type: 'farmer' },
        'land_verification_update',
        {
          status,
          verifiedBy: staffUser.name || 'Mandi Supervisor',
          reason: status === 'rejected' ? reason.trim() : null,
          message: status === 'verified'
            ? 'Your declared land details have been verified by the Mandi Supervisor.'
            : `Your declared land details were rejected. Reason: ${reason.trim()}`
        },
        { dedupeKey: `${farmerIdStr}_land_verification_${Date.now()}` }
      ).catch((e) => logger.warn(`[Land Verification] Farmer notification notice: ${e.message}`));
    } catch (notifErr) {
      logger.warn(`[Land Verification] Notification error: ${notifErr.message}`);
    }

    return {
      success: true,
      farmerId: farmer._id,
      landRecord: farmer.landRecord,
      message: `Land record successfully marked as ${status}.`
    };
  },

  /**
   * Get read-only counts of pending, verified, and rejected land records (for District Admin)
   */
  getLandVerificationCounts: async (centreId = null) => {
    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      const counts = await Farmer.aggregate([
        {
          $group: {
            _id: '$landRecord.verificationStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      counts.forEach((c) => {
        if (c._id === 'verified') verified = c.count;
        else if (c._id === 'rejected') rejected = c.count;
        else pending += c.count; // null, undefined, or 'pending'
      });

      total = pending + verified + rejected;
    } else if (inMemoryFarmers) {
      for (const [, f] of inMemoryFarmers.entries()) {
        const st = f.landRecord?.verificationStatus || 'pending';
        if (st === 'verified') verified++;
        else if (st === 'rejected') rejected++;
        else pending++;
        total++;
      }
    }

    return {
      centreId: centreId || 'ALL',
      pending,
      verified,
      rejected,
      total
    };
  }
};

module.exports = farmerService;
