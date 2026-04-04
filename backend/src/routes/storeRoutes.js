const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authenticate = require('../middleware/authenticate');
const validateStoreAccess = require('../middleware/validateStoreAccess');

// All store routes require authentication except GET /api/stores
// GET /api/stores - Get all stores (public for staff registration)
router.get('/', storeController.getAllStores);

router.use(authenticate);

// POST /api/stores - Create store (internal use during setup)
router.post('/', storeController.createStore);

// GET /api/stores/detailed - Get all stores with details (author only)
router.get('/detailed', storeController.getAllStoresDetailed);

// GET /api/stores/:storeId - Get store by ID
router.get('/:storeId', validateStoreAccess, storeController.getStore);

// GET /api/stores/:storeId/details - Get store details (author only)
router.get('/:storeId/details', storeController.getStoreDetails);

module.exports = router;
