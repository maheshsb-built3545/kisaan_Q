const mongoose = require('mongoose');
const { Farmer } = require('../models');
const { inMemoryFarmers } = require('./authService');
const logger = require('../utils/logger');

const farmerService = {
  /**
   * Save or update the farmer's pickup location
   * @param {Object} params
   * @param {string} params.farmerId
   * @param {string} params.phone
   * @param {number|string} params.latitude
   * @param {number|string} params.longitude
   * @param {string} [params.address]
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
      coordinates: [lng, lat], // GeoJSON order: [longitude, latitude]
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
        logger.info(`[Farmer Location] Updated pickup location for ${farmer.phone} to [${lng}, ${lat}] in MongoDB`);
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
   * @param {Object} params
   * @param {string} [params.farmerId]
   * @param {string} [params.phone]
   * @param {string} params.pushToken
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
  }
};

module.exports = farmerService;
