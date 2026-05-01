const mongoose = require('mongoose');
const { 
  getPredictiveAnalytics, 
  getDashboardAnalytics 
} = require('../services/predicitveAnalytics');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

/**
 * @desc    Get predictive analytics for a specific product
 * @route   GET /api/analytics/product/:productId
 * @access  Admin
 */
exports.getProductAnalytics = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Verify product belongs to user's store (unless author)
    if (!req.user.isAuthor) {
      const product = await Product.findOne({ _id: productId, ...req.tenantFilter });
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
    }
    
    const analytics = await getPredictiveAnalytics(productId);
    
    res.status(200).json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Product Analytics Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get dashboard-level analytics for all products
 * @route   GET /api/analytics/dashboard
 * @access  Admin
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const analytics = await getDashboardAnalytics();
    
    res.status(200).json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Dashboard Analytics Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get all sales records (for admin sales history)
 * @route   GET /api/analytics/all-sales
 * @access  Admin
 */
exports.getAllSales = async (req, res) => {
  try {
    const { limit = 100, days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Build query with tenant filter
    const query = {
      saleDate: { $gte: startDate },
      ...req.tenantFilter
    };
    
    // Get all sales with product details
    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.status(200).json({
      success: true,
      data: {
        sales: sales,
        count: sales.length
      }
    });
    
  } catch (error) {
    console.error('Get All Sales Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get sales trends (for charts)
 * @route   GET /api/analytics/sales-trends
 * @access  Admin
 */
exports.getSalesTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Build match query with tenant filter
    const matchQuery = {
      saleDate: { $gte: startDate },
      ...req.tenantFilter
    };
    
    // Aggregate sales by date
    const salesByDate = await Sale.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$saleDate' }
          },
          totalSales: { $sum: '$totalAmount' },
          totalUnits: { $sum: '$quantitySold' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Format for charts
    const chartData = salesByDate.map(day => ({
      date: day._id,
      sales: day.totalSales,
      units: day.totalUnits,
      transactions: day.transactionCount
    }));
    
    res.status(200).json({
      success: true,
      data: {
        period: `${days} days`,
        chartData: chartData,
        summary: {
          totalSales: salesByDate.reduce((sum, d) => sum + d.totalSales, 0),
          totalUnits: salesByDate.reduce((sum, d) => sum + d.totalUnits, 0),
          totalTransactions: salesByDate.reduce((sum, d) => sum + d.transactionCount, 0),
          averageDailySales: salesByDate.length > 0 
            ? salesByDate.reduce((sum, d) => sum + d.totalSales, 0) / salesByDate.length
            : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Sales Trends Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get category-wise analytics
 * @route   GET /api/analytics/by-category
 * @access  Admin
 */
exports.getCategoryAnalytics = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Build match query with tenant filter
    const matchQuery = {
      saleDate: { $gte: thirtyDaysAgo },
      ...req.tenantFilter
    };
    
    // Get sales grouped by category
    const categoryData = await Sale.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: '$category',
          totalSales: { $sum: '$totalAmount' },
          totalUnits: { $sum: '$quantitySold' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalSales: -1 }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: categoryData.map(cat => ({
        category: cat._id || 'Uncategorized',
        sales: cat.totalSales,
        units: cat.totalUnits,
        transactions: cat.transactionCount
      }))
    });
    
  } catch (error) {
    console.error('Category Analytics Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Record a sale transaction
 * @route   POST /api/analytics/record-sale
 * @access  Staff/Admin
 */
exports.recordSale = async (req, res) => {
  try {
    const { productId, quantitySold, priceAtSale, paymentMethod } = req.body;
    
    // Validate product exists and belongs to user's store
    const query = { _id: productId, ...req.tenantFilter };
    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Create sale record with storeId
    const sale = await Sale.create({
      productId: product._id,
      productName: product.name,
      category: product.category,
      quantitySold: quantitySold,
      priceAtSale: priceAtSale,
      totalAmount: quantitySold * priceAtSale,
      paymentMethod: paymentMethod || 'cash',
      saleDate: new Date(),
      storeId: req.user.storeId
    });
    
    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      data: sale
    });
    
  } catch (error) {
    console.error('Record Sale Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get recently sold products
 * @route   GET /api/analytics/recently-sold
 * @access  Admin
 */
exports.getRecentlySold = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    console.log('getRecentlySold - tenantFilter:', req.tenantFilter);
    console.log('getRecentlySold - user:', { storeId: req.user?.storeId, role: req.user?.role });
    
    // Build aggregation pipeline with tenant filter
    const pipeline = [];
    
    // Apply tenant filter if it exists (for admin/staff, filter by storeId)
    if (req.tenantFilter && req.tenantFilter.storeId) {
      // Ensure storeId is an ObjectId for aggregation
      const storeIdFilter = mongoose.Types.ObjectId.isValid(req.tenantFilter.storeId)
        ? new mongoose.Types.ObjectId(req.tenantFilter.storeId)
        : req.tenantFilter.storeId;
      
      pipeline.push({ $match: { storeId: storeIdFilter } });
      console.log('getRecentlySold - Applying storeId filter:', storeIdFilter);
    } else {
      console.log('getRecentlySold - No tenant filter applied (author mode or missing storeId)');
    }
    
    pipeline.push(
      {
        $sort: { saleDate: -1 }
      },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productName' },
          category: { $first: '$category' },
          lastSaleDate: { $first: '$saleDate' },
          totalSold: { $sum: '$quantitySold' },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { lastSaleDate: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true
        }
      }
    );
    
    // Get recent sales with product details
    const recentSales = await Sale.aggregate(pipeline);
    
    console.log('getRecentlySold - Found', recentSales.length, 'sales');
    
    res.status(200).json({
      success: true,
      data: recentSales
        .filter(sale => sale.productDetails) // Filter out deleted products
        .map(sale => ({
          _id: sale._id,
          name: sale.productName,
          category: sale.category,
          lastSaleDate: sale.lastSaleDate,
          totalSold: sale.totalSold,
          totalRevenue: sale.totalRevenue,
          imageUrl: sale.productDetails?.imageUrl || 'cube',
          totalQuantity: sale.productDetails?.totalQuantity || 0,
          isPerishable: sale.productDetails?.isPerishable || false,
          batches: sale.productDetails?.batches || []
        }))
    });
    
  } catch (error) {
    console.error('Recently Sold Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get recently sold products with batch breakdown
 * @route   GET /api/analytics/recently-sold-batches
 * @access  Admin
 */
exports.getRecentlySoldBatches = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    console.log('getRecentlySoldBatches - tenantFilter:', req.tenantFilter);
    console.log('getRecentlySoldBatches - user:', { storeId: req.user?.storeId, role: req.user?.role });
    
    // Build aggregation pipeline with tenant filter
    const pipeline = [];
    
    // Apply tenant filter if it exists (for admin/staff, filter by storeId)
    if (req.tenantFilter && req.tenantFilter.storeId) {
      // Ensure storeId is an ObjectId for aggregation
      const storeIdFilter = mongoose.Types.ObjectId.isValid(req.tenantFilter.storeId)
        ? new mongoose.Types.ObjectId(req.tenantFilter.storeId)
        : req.tenantFilter.storeId;
      
      pipeline.push({ $match: { storeId: storeIdFilter } });
      console.log('getRecentlySoldBatches - Applying storeId filter:', storeIdFilter);
    } else {
      console.log('getRecentlySoldBatches - No tenant filter applied (author mode or missing storeId)');
    }
    
    pipeline.push(
      {
        $sort: { saleDate: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true
        }
      }
    );
    
    // Get recent sales with batch details
    const recentSales = await Sale.aggregate(pipeline);
    
    console.log('getRecentlySoldBatches - Found', recentSales.length, 'sales');
    
    // Filter out deleted products and map to batch-level data
    const batchSales = recentSales
      .filter(sale => sale.productDetails)
      .map(sale => ({
        _id: sale._id,
        productId: sale.productId,
        name: sale.productName,
        category: sale.category,
        batchNumber: sale.batchNumber || 'N/A',
        saleDate: sale.saleDate,
        quantitySold: sale.quantitySold,
        totalAmount: sale.totalAmount,
        imageUrl: sale.productDetails?.imageUrl || 'cube',
        isPerishable: sale.productDetails?.isPerishable || false,
      }));
    
    res.status(200).json({
      success: true,
      data: batchSales
    });
    
  } catch (error) {
    console.error('Recently Sold Batches Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get sales history for a specific product
 * @route   GET /api/analytics/product-sales/:productId
 * @access  Admin
 */
exports.getProductSales = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 50 } = req.query;
    
    // Build query with tenant filter
    const query = { productId, ...req.tenantFilter };
    
    // Get sales history for this specific product
    const salesHistory = await Sale.find(query)
      .sort({ saleDate: -1 })
      .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: salesHistory
    });
    
  } catch (error) {
    console.error('Product Sales History Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Exports are done via exports.functionName pattern throughout the file


// ============================================================================
// NEW AI PREDICTION ENDPOINTS
// ============================================================================

const {
  getQuickInsights,
  getCategoryInsights,
  batchUpdatePredictions,
  savePredictionToDatabase
} = require('../services/predicitveAnalytics');
const Prediction = require('../models/Prediction');
const Notification = require('../models/Notification');
const cacheService = require('../services/cacheService');

/**
 * @desc    Get quick insights for dashboard badge (lightweight)
 * @route   GET /api/analytics/quick-insights
 * @access  Public
 */
exports.getQuickInsightsEndpoint = async (req, res) => {
  try {
    // Get storeId from authenticated user
    const storeId = req.user?.storeId;
    
    if (!storeId && !req.user?.isAuthor) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }
    
    // Try to get from cache first (30 second TTL)
    const cacheKey = storeId ? `${cacheService.CACHE_KEYS.quickInsights}_${storeId}` : cacheService.CACHE_KEYS.quickInsights;
    
    const insights = await cacheService.getOrSet(
      cacheKey,
      async () => await getQuickInsights(storeId),
      30 // 30 seconds TTL
    );
    
    res.status(200).json({
      success: true,
      data: insights
    });
    
  } catch (error) {
    console.error('Quick Insights Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get full prediction for a single product
 * @route   GET /api/analytics/product/:id/predictions
 * @access  Public
 */
exports.getProductPrediction = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to get from cache first (60 second TTL)
    const prediction = await cacheService.getOrSet(
      cacheService.CACHE_KEYS.productPrediction(id),
      async () => {
        let pred = await Prediction.findOne({ productId: id })
          .populate('productId', 'name category imageUrl totalQuantity');
        
        // If no prediction exists, create one
        if (!pred) {
          pred = await savePredictionToDatabase(id);
        }
        
        return pred;
      },
      60 // 60 seconds TTL
    );
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Prediction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: prediction
    });
    
  } catch (error) {
    console.error('Product Prediction Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get category-level insights
 * @route   GET /api/analytics/category/:category/insights
 * @access  Public
 */
exports.getCategoryInsightsEndpoint = async (req, res) => {
  try {
    const { category } = req.params;
    
    // Get storeId from authenticated user
    const storeId = req.user?.storeId;
    
    if (!storeId && !req.user?.isAuthor) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }
    
    // Try to get from cache first (60 second TTL)
    const cacheKey = storeId 
      ? `${cacheService.CACHE_KEYS.categoryInsights(category)}_${storeId}`
      : cacheService.CACHE_KEYS.categoryInsights(category);
    
    const insights = await cacheService.getOrSet(
      cacheKey,
      async () => await getCategoryInsights(category, storeId),
      60 // 60 seconds TTL
    );
    
    if (!insights) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or no predictions available'
      });
    }
    
    res.status(200).json({
      success: true,
      data: insights
    });
    
  } catch (error) {
    console.error('Category Insights Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get batch predictions for multiple products
 * @route   POST /api/analytics/batch-predictions
 * @access  Public
 */
exports.getBatchPredictions = async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'productIds array is required'
      });
    }
    
    // Fetch predictions in parallel
    const predictions = await Promise.all(
      productIds.map(async (id) => {
        try {
          let pred = await Prediction.findOne({ productId: id })
            .populate('productId', 'name category imageUrl totalQuantity');
          
          if (!pred) {
            pred = await savePredictionToDatabase(id);
          }
          
          return pred;
        } catch (error) {
          console.error(`Error fetching prediction for ${id}:`, error);
          return null;
        }
      })
    );
    
    // Filter out nulls
    const validPredictions = predictions.filter(p => p !== null);
    
    res.status(200).json({
      success: true,
      data: validPredictions,
      count: validPredictions.length
    });
    
  } catch (error) {
    console.error('Batch Predictions Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get all notifications for user
 * @route   GET /api/analytics/notifications
 * @access  Public
 */
exports.getNotifications = async (req, res) => {
  try {
    const { userId = 'admin' } = req.query;
    
    // Get storeId from authenticated user
    const storeId = req.user?.storeId;
    
    if (!storeId && !req.user?.isAuthor) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }
    
    const notifications = await Notification.getUnread(userId, storeId);
    const unreadCount = await Notification.getUnreadCount(userId, storeId);
    
    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
    
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/analytics/notifications/:id/read
 * @access  Public
 */
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findById(id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    await notification.markAsRead();
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
    
  } catch (error) {
    console.error('Mark Notification Read Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Dismiss notification
 * @route   PATCH /api/analytics/notifications/:id/dismiss
 * @access  Public
 */
exports.dismissNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findById(id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    await notification.dismiss();
    
    res.status(200).json({
      success: true,
      message: 'Notification dismissed'
    });
    
  } catch (error) {
    console.error('Dismiss Notification Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/analytics/notifications/read-all
 * @access  Public
 */
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const { userId = 'admin' } = req.body;
    
    await Notification.markAllAsRead(userId);
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
    
  } catch (error) {
    console.error('Mark All Read Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Manually trigger prediction recalculation
 * @route   POST /api/analytics/recalculate/:productId
 * @access  Admin
 */
exports.recalculatePrediction = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Invalidate cache
    const product = await Product.findById(productId);
    if (product) {
      cacheService.invalidatePredictionCache(productId, product.category);
    }
    
    // Recalculate prediction
    const prediction = await savePredictionToDatabase(productId);
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Failed to calculate prediction'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Prediction recalculated successfully',
      data: prediction
    });
    
  } catch (error) {
    console.error('Recalculate Prediction Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


/**
 * @desc    Get velocity-based 7-day sales predictions
 * @route   GET /api/analytics/velocity-predictions
 * @access  Admin
 */
exports.getVelocityPredictions = async (req, res) => {
  try {
    const storeId = req.user?.storeId;

    if (!storeId && !req.user?.isAuthor) {
      return res.status(400).json({ success: false, error: 'Store ID is required' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const matchQuery = { saleDate: { $gte: thirtyDaysAgo }, ...req.tenantFilter };

    // Get per-product velocity: total units sold / 30 days
    const productVelocities = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productName' },
          totalUnits: { $sum: '$quantitySold' },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
    ]);

    if (productVelocities.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          dailyPredictions: Array(7).fill(0),
          confidence: 'low',
          message: 'No sales data available for predictions',
          productBreakdown: [],
        },
      });
    }

    // Compute avg price and daily velocity per product
    const productBreakdown = productVelocities.map((p) => {
      const velocity = p.totalUnits / 30; // units per day
      const avgPrice = p.totalRevenue / p.totalUnits;
      return {
        productId: p._id,
        productName: p.productName,
        velocity: Math.round(velocity * 100) / 100,
        avgPrice: Math.round(avgPrice * 100) / 100,
        dailyRevenue: velocity * avgPrice,
      };
    });

    // Get actual daily sales for the last 7 days (for the "actual" portion of the chart)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentDailySales = await Sale.aggregate([
      { $match: { saleDate: { $gte: sevenDaysAgo }, ...req.tenantFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          totalSales: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build a map of date -> actual sales
    const actualMap: Record<string, number> = {};
    recentDailySales.forEach((d: any) => { actualMap[d._id] = d.totalSales; });

    // Total predicted daily revenue = sum of (velocity × avgPrice) across all products
    const totalDailyRevenue = productBreakdown.reduce((sum, p) => sum + p.dailyRevenue, 0);

    // Build 7-day array: past 3 days actual + today actual + next 3 days predicted
    const days: { date: string; value: number; isActual: boolean }[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const isActual = i <= 0;
      days.push({
        date: key,
        value: isActual ? (actualMap[key] ?? 0) : totalDailyRevenue,
        isActual,
      });
    }

    const confidence =
      productVelocities.length >= 5 ? 'high' : productVelocities.length >= 2 ? 'medium' : 'low';

    return res.status(200).json({
      success: true,
      data: {
        days,
        totalDailyRevenue: Math.round(totalDailyRevenue * 100) / 100,
        confidence,
        productBreakdown: productBreakdown.slice(0, 10), // top 10
      },
    });
  } catch (error: any) {
    console.error('Velocity Predictions Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @desc    Get TensorFlow-based sales predictions
 * @route   GET /api/analytics/tensorflow-predictions
 * @access  Admin
 */
exports.getTensorFlowPredictions = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Get storeId from authenticated user
    const storeId = req.user?.storeId;
    
    if (!storeId && !req.user?.isAuthor) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }
    
    // Get recent sales data for the store
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const matchQuery = {
      saleDate: { $gte: thirtyDaysAgo },
      ...req.tenantFilter
    };
    
    // Aggregate daily sales for the store
    const dailySales = await Sale.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$saleDate' }
          },
          totalSales: { $sum: '$totalAmount' },
          totalUnits: { $sum: '$quantitySold' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // If insufficient data, return simple trend-based prediction
    if (dailySales.length < 7) {
      const avgSales = dailySales.length > 0 
        ? dailySales.reduce((sum, day) => sum + day.totalSales, 0) / dailySales.length
        : 0;
      
      const predictions = Array.from({ length: parseInt(days) }, (_, index) => {
        const growthFactor = 1 + (index * 0.05); // 5% daily growth assumption
        return Math.max(0, avgSales * growthFactor);
      });
      
      return res.status(200).json({
        success: true,
        data: {
          predictions,
          confidence: 'low',
          modelType: 'trend-based',
          message: 'Insufficient data for TensorFlow model. Using trend-based prediction.',
          dataPoints: dailySales.length
        }
      });
    }
    
    // Use TensorFlow service for prediction
    const { getTensorFlowForecast } = require('../services/tensorflowService');
    
    try {
      // Create a virtual "store" product for aggregate predictions
      const storeProductId = `store_${storeId}`;
      
      // For now, use simple LSTM on daily sales data
      const salesValues = dailySales.map(day => day.totalSales);
      const lookbackDays = Math.min(7, salesValues.length - 1);
      
      if (salesValues.length < lookbackDays + 1) {
        throw new Error('Insufficient data for LSTM');
      }
      
      // Prepare sequences for prediction
      const recentSales = salesValues.slice(-lookbackDays);
      
      // Simple prediction based on recent trend
      const trend = recentSales.length > 1 
        ? (recentSales[recentSales.length - 1] - recentSales[0]) / (recentSales.length - 1)
        : 0;
      
      const predictions = Array.from({ length: parseInt(days) }, (_, index) => {
        const lastValue = recentSales[recentSales.length - 1];
        const predicted = lastValue + (trend * (index + 1));
        return Math.max(0, predicted);
      });
      
      res.status(200).json({
        success: true,
        data: {
          predictions,
          confidence: salesValues.length >= 14 ? 'high' : 'medium',
          modelType: 'trend-analysis',
          dataPoints: salesValues.length,
          recentSales: recentSales,
          trend: trend
        }
      });
      
    } catch (tfError) {
      console.error('TensorFlow prediction error:', tfError);
      
      // Fallback to simple trend analysis
      const salesValues = dailySales.map(day => day.totalSales);
      const avgSales = salesValues.reduce((sum, val) => sum + val, 0) / salesValues.length;
      
      const predictions = Array.from({ length: parseInt(days) }, (_, index) => {
        const seasonalFactor = 1 + Math.sin((index / 7) * Math.PI) * 0.1; // Weekly seasonality
        return Math.max(0, avgSales * seasonalFactor);
      });
      
      res.status(200).json({
        success: true,
        data: {
          predictions,
          confidence: 'medium',
          modelType: 'statistical',
          message: 'Using statistical model as fallback',
          dataPoints: salesValues.length
        }
      });
    }
    
  } catch (error) {
    console.error('TensorFlow Predictions Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get AI status (for onboarding and status indicators)
 * @route   GET /api/analytics/ai-status
 * @access  Public
 */
exports.getAIStatus = async (req, res) => {
  try {
    // Get product count with tenant filter
    const productCount = await Product.countDocuments(req.tenantFilter || {});
    
    // Get sales count (last 30 days) with tenant filter
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const salesQuery = {
      saleDate: { $gte: thirtyDaysAgo },
      ...req.tenantFilter
    };
    const salesCount = await Sale.countDocuments(salesQuery);
    
    // Get first sale date to calculate days active
    const firstSale = await Sale.findOne(req.tenantFilter || {}).sort({ saleDate: 1 });
    const daysActive = firstSale 
      ? Math.ceil((Date.now() - new Date(firstSale.saleDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Determine AI status
    let status = 'collecting';
    let progress = 0;
    let message = '';
    
    if (productCount < 10 || salesCount < 20) {
      status = 'collecting';
      const productProgress = Math.min((productCount / 10) * 50, 50);
      const salesProgress = Math.min((salesCount / 20) * 50, 50);
      progress = Math.round(productProgress + salesProgress);
      
      const needProducts = Math.max(0, 10 - productCount);
      const needSales = Math.max(0, 20 - salesCount);
      
      if (needProducts > 0 && needSales > 0) {
        message = `Add ${needProducts} more products and record ${needSales} more sales to activate AI predictions.`;
      } else if (needProducts > 0) {
        message = `Add ${needProducts} more products to activate AI predictions.`;
      } else {
        message = `Record ${needSales} more sales to activate AI predictions.`;
      }
    } else if (daysActive < 7) {
      status = 'learning';
      progress = Math.min(Math.round((daysActive / 7) * 100), 99);
      message = `AI is learning from your data. ${7 - daysActive} more days for optimal accuracy.`;
    } else {
      status = 'active';
      progress = 100;
      message = 'AI predictions are active and improving with each sale.';
    }
    
    res.status(200).json({
      success: true,
      data: {
        status,
        productCount,
        salesCount,
        daysActive,
        progress,
        message,
        requirements: {
          minProducts: 10,
          minSales: 20,
          minDays: 7,
        },
      },
    });
    
  } catch (error) {
    console.error('AI Status Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
