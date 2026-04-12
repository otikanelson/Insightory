const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const tenantFilter = require('../middleware/tenantFilter');

// Log when routes are loaded
console.log('🔐 Auth routes module loaded');

// Public routes (no authentication required)
// Author login
router.post('/author/login', authController.authorLogin);

// Login
router.post('/login', (req, res, next) => {
  console.log('🔐 Login route hit!');
  authController.login(req, res, next);
});

// Setup admin (first-time)
router.post('/setup', authController.setupAdmin);

// Check if setup is complete
router.get('/setup/status', authController.checkSetup);

// Verify admin PIN for a specific store (used by staff to access admin pages)
router.post('/verify-admin-pin', authController.verifyAdminPin);

// Verify admin Security PIN for sensitive operations (product registration/deletion)
router.post('/verify-admin-security-pin', authController.verifyAdminSecurityPin);

// Get admin info by store ID (used by staff to display admin name)
router.get('/admin-info/:storeId', authController.getAdminInfo);

// Check if admin has security PIN set (used by staff before registering products)
router.get('/check-admin-security-pin/:storeId', authController.checkAdminSecurityPin);

// Staff management
router.post('/staff', authenticate, tenantFilter, authController.createStaff);
router.post('/staff/join', authController.joinStore); // Public - staff joining existing store
router.post('/staff/verify-store', authController.verifyStore); // Public - verify store + admin PIN
router.get('/staff', authenticate, tenantFilter, authController.getStaff);
router.get('/staff/:id', authenticate, tenantFilter, authController.getStaffById);
router.put('/staff/:id', authenticate, tenantFilter, authController.updateStaff);
router.patch('/staff/:id/permissions', authenticate, tenantFilter, authController.updateStaffPermissions);
router.delete('/staff/:id', authenticate, tenantFilter, authController.deleteStaff);

// Admin impersonate staff
router.get('/staff/:staffId/activity', authenticate, tenantFilter, authController.getStaffActivity);

// Update admin PIN
router.put('/admin/pin', authenticate, authController.updateAdminPin);

// Delete accounts
router.delete('/admin/account', authenticate, authController.deleteAdminAccount);
router.delete('/staff/account', authenticate, authController.deleteStaffAccount);

module.exports = router;
