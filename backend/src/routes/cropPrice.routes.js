const express = require('express');
const router = express.Router();
const cropPriceController = require('../controllers/cropPrice.controller');

// Public price discovery endpoints
router.get('/', cropPriceController.getAllPrices);
router.get('/centre/:mandiId', cropPriceController.getPricesByMandi);
router.get('/mandi/:mandiId', cropPriceController.getPricesByMandi);
router.get('/:crop', cropPriceController.getPricesByCrop);

module.exports = router;
