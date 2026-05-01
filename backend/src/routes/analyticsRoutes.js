const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const tenantFilter = require('../middleware/tenantFilter');

const {
  getProductAnalytics,
  getDashboardStats,
  getSalesTrends,
  getCategoryAnalytics,
  recordSale,
  getRecentlySold,
  getRecentlySoldBatches,
  getProductSales,
  getAllSales,
  // New AI prediction endpoints
  getQuickInsightsEndpoint,
  getProductPrediction,
  getCategoryInsightsEndpoint,
  getBatchPredictions,
  getNotifications,
  markNotificationAsRead,
  dismissNotification,
  markAllNotificationsAsRead,
  recalculatePrediction,
  getTensorFlowPredictions,
  getVelocityPredictions,
  getAIStatus
} = require('../controllers/analyticsController');

// Apply authentication and tenant filter to all routes
router.use(authenticate);
router.use(tenantFilter);

// @route   GET /api/analytics/dashboard
// @desc    Get overall dashboard analytics
// @access  Admin
router.get('/dashboard', getDashboardStats);

// @route   GET /api/analytics/product/:productId
// @desc    Get predictive analytics for specific product
// @access  Admin
router.get('/product/:productId', getProductAnalytics);

// @route   GET /api/analytics/sales-trends
// @desc    Get sales trends for charts (query: ?days=30)
// @access  Admin
router.get('/sales-trends', getSalesTrends);

// @route   GET /api/analytics/all-sales
// @desc    Get all sales records (for admin sales history)
// @access  Admin
router.get('/all-sales', getAllSales);

// @route   GET /api/analytics/by-category
// @desc    Get category-wise analytics
// @access  Admin
router.get('/by-category', getCategoryAnalytics);

// @route   GET /api/analytics/recently-sold
// @desc    Get recently sold products
// @access  Admin
router.get('/recently-sold', getRecentlySold);

// @route   GET /api/analytics/recently-sold-batches
// @desc    Get recently sold products with batch breakdown
// @access  Admin
router.get('/recently-sold-batches', getRecentlySoldBatches);

// @route   GET /api/analytics/product-sales/:productId
// @desc    Get sales history for a specific product
// @access  Admin
router.get('/product-sales/:productId', getProductSales);

// @route   POST /api/analytics/record-sale
// @desc    Record a sale transaction
// @access  Staff/Admin
router.post('/record-sale', recordSale);

// ============================================================================
// NEW AI PREDICTION ROUTES
// ============================================================================

// @route   GET /api/analytics/quick-insights
// @desc    Get quick insights for dashboard badge (lightweight)
// @access  Public
router.get('/quick-insights', getQuickInsightsEndpoint);

// @route   GET /api/analytics/product/:id/predictions
// @desc    Get full prediction for a single product
// @access  Public
router.get('/product/:id/predictions', getProductPrediction);

// @route   GET /api/analytics/category/:category/insights
// @desc    Get category-level insights
// @access  Public
router.get('/category/:category/insights', getCategoryInsightsEndpoint);

// @route   POST /api/analytics/batch-predictions
// @desc    Get predictions for multiple products
// @access  Public
router.post('/batch-predictions', getBatchPredictions);

// @route   GET /api/analytics/notifications
// @desc    Get all notifications for user
// @access  Public
router.get('/notifications', getNotifications);

// @route   PATCH /api/analytics/notifications/:id/read
// @desc    Mark notification as read
// @access  Public
router.patch('/notifications/:id/read', markNotificationAsRead);

// @route   PATCH /api/analytics/notifications/:id/dismiss
// @desc    Dismiss notification
// @access  Public
router.patch('/notifications/:id/dismiss', dismissNotification);

// @route   PATCH /api/analytics/notifications/read-all
// @desc    Mark all notifications as read
// @access  Public
router.patch('/notifications/read-all', markAllNotificationsAsRead);

// @route   POST /api/analytics/recalculate/:productId
// @desc    Manually trigger prediction recalculation
// @access  Admin
router.post('/recalculate/:productId', recalculatePrediction);

// @route   GET /api/analytics/tensorflow-predictions
// @desc    Get TensorFlow-based sales predictions
// @access  Admin
router.get('/tensorflow-predictions', getTensorFlowPredictions);

// @route   GET /api/analytics/velocity-predictions
// @desc    Get velocity-based 7-day sales predictions
// @access  Admin
router.get('/velocity-predictions', getVelocityPredictions);

// @route   GET /api/analytics/ai-status
// @desc    Get AI status for onboarding and indicators
// @access  Public
router.get('/ai-status', getAIStatus);

module.exports = router;