const Store = require('../models/Store');
const User = require('../models/User');
const Product = require('../models/Product');

// Create a new store (internal use during admin setup)
exports.createStore = async (req, res) => {
  try {
    const { name, ownerId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Store name is required'
      });
    }

    // Check if store name already exists (case-insensitive)
    const existingStore = await Store.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingStore) {
      return res.status(400).json({
        success: false,
        error: 'Store name already exists'
      });
    }

    const store = new Store({
      name: name.trim(),
      ownerId: ownerId || null
    });

    const savedStore = await store.save();

    res.status(201).json({
      success: true,
      data: {
        id: savedStore._id,
        name: savedStore.name,
        ownerId: savedStore.ownerId,
        createdAt: savedStore.createdAt
      }
    });
  } catch (error) {
    console.error('Create store error:', error);
    
    if (error.code === 'DUPLICATE_STORE_NAME') {
      return res.status(400).json({
        success: false,
        error: 'Store name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create store'
    });
  }
};

// Get store by ID
exports.getStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: store._id,
        name: store.name,
        ownerId: store.ownerId,
        createdAt: store.createdAt
      }
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store'
    });
  }
};

// Get all stores (public - for staff registration)
exports.getAllStores = async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true })
      .select('_id name')
      .sort({ name: 1 });

    const formattedStores = stores.map(store => ({
      id: store._id,
      name: store.name
    }));

    res.json({
      success: true,
      data: formattedStores
    });
  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores'
    });
  }
};

// Get store details with admins, staff, and stats (author only)
exports.getStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Verify author role
    if (!req.user || !req.user.isAuthor) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Get admins for this store
    const admins = await User.find({ 
      storeId: store._id, 
      role: 'admin',
      isActive: true 
    }).select('-pin');

    // Get staff for this store
    const staff = await User.find({ 
      storeId: store._id, 
      role: 'staff',
      isActive: true 
    }).select('-pin');

    // Get statistics
    const totalProducts = await Product.countDocuments({ storeId: store._id });

    res.json({
      success: true,
      data: {
        store: {
          id: store._id,
          name: store.name,
          createdAt: store.createdAt
        },
        admins: admins.map(admin => ({
          id: admin._id,
          name: admin.name,
          lastLogin: admin.lastLogin
        })),
        staff: staff.map(s => ({
          id: s._id,
          name: s.name,
          createdBy: s.createdBy,
          lastLogin: s.lastLogin
        })),
        stats: {
          totalProducts,
          totalSales: 0, // TODO: Implement when sales are filtered
          totalRevenue: 0 // TODO: Implement when sales are filtered
        }
      }
    });
  } catch (error) {
    console.error('Get store details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store details'
    });
  }
};

module.exports = exports;


// Get all stores with details (author only)
exports.getAllStoresDetailed = async (req, res) => {
  try {
    // Verify author role
    if (!req.user || !req.user.isAuthor) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const stores = await Store.find({ isActive: true })
      .populate('ownerId', 'name')
      .sort({ createdAt: -1 });

    // Get counts for each store
    const storesWithCounts = await Promise.all(
      stores.map(async (store) => {
        const adminCount = await User.countDocuments({ 
          storeId: store._id, 
          role: 'admin',
          isActive: true 
        });
        
        const staffCount = await User.countDocuments({ 
          storeId: store._id, 
          role: 'staff',
          isActive: true 
        });
        
        const productCount = await Product.countDocuments({ 
          storeId: store._id 
        });

        return {
          id: store._id,
          name: store.name,
          ownerId: store.ownerId?._id,
          ownerName: store.ownerId?.name,
          adminCount,
          staffCount,
          productCount,
          createdAt: store.createdAt
        };
      })
    );

    res.json({
      success: true,
      data: storesWithCounts
    });
  } catch (error) {
    console.error('Get all stores detailed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores'
    });
  }
};
