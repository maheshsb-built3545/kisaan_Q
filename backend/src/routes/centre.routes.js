const express = require('express');
const router = express.Router();
const centreController = require('../controllers/centre.controller');
const cropPriceController = require('../controllers/cropPrice.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// Public centre discovery routes
router.get('/', centreController.getAllCentres);
router.get('/:id', centreController.getCentreById);
router.get('/:id/availability', centreController.getAvailability);
router.get('/:id/prices', cropPriceController.getPricesByMandi);
router.get('/:mandiId/prices', cropPriceController.getPricesByMandi);

// Administrative centre creation route
router.post('/', authenticate, checkRole('supervisor', 'district_admin'), centreController.createCentre);

module.exports = router;
