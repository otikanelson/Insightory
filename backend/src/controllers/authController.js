const User = require('../models/User');
const Store = require('../models/Store');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Author login with secret key
exports.authorLogin = async (req, res) => {
  try {
    const { secretKey } = req.body;

    if (!secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key is required'
      });
    }

    // Hardcoded author password for simplicity
    const validSecretKey = 'RADson29';
    
    if (secretKey !== validSecretKey) {
      console.log('Invalid secret key provided');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token for author
    const sessionToken = jwt.sign(
      { 
        userId: 'author',
        role: 'author'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: 'author',
          name: 'Author',
          role: 'author'
        },
        sessionToken
      }
    });
  } catch (error) {
    console.error('Author login error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    const { pin, role, storeName } = req.body;
    console.log('🔐 Login data:', { pin: pin ? '****' : 'missing', role, storeName });

    if (!pin || !role) {
      console.log('❌ Missing pin or role');
      return res.status(400).json({
        success: false,
        error: 'PIN and role are required'
      });
    }

    // Build query - use loginPin for authentication
    const query = { loginPin: pin, role, isActive: true };
    
    // For admin login, optionally filter by storeName if provided
    if (role === 'admin' && storeName) {
      query.storeName = storeName;
    }

    console.log('🔍 Searching for user with query:', { ...query, loginPin: '****' });

    // Find user by loginPin and role
    const user = await User.findOne(query);
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    console.log('✅ User found:', user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT session token
    const sessionToken = jwt.sign(
      { 
        userId: user._id.toString(),
        role: user.role,
        storeId: user.storeId ? user.storeId.toString() : null
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Prepare response data
    const responseData = {
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
        storeName: user.storeName,
        permissions: user.permissions || {}
      },
      sessionToken
    };

    // Include Security PIN for admin users (needed for app functionality)
    if (user.role === 'admin' && user.securityPin) {
      responseData.user.securityPin = user.securityPin;
    }

    console.log('✅ Login successful for user:', user.name);
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};
// Create admin user (first-time setup)
exports.setupAdmin = async (req, res) => {
  try {
    console.log('=== SETUP ADMIN REQUEST RECEIVED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { name, loginPin, securityPin, storeName } = req.body;

    console.log('Extracted data:', { 
      name, 
      loginPin: loginPin ? '****' : 'missing', 
      securityPin: securityPin ? '****' : 'missing',
      storeName 
    });

    if (!name || !loginPin || !securityPin || !storeName) {
      console.log('❌ Validation failed: Missing name, Login PIN, Security PIN, or store name');
      return res.status(400).json({
        success: false,
        error: 'Name, Login PIN, Security PIN, and store name are required'
      });
    }

    if (loginPin.length !== 4 || !/^\d{4}$/.test(loginPin)) {
      console.log('❌ Validation failed: Invalid Login PIN format');
      return res.status(400).json({
        success: false,
        error: 'Login PIN must be exactly 4 digits'
      });
    }

    if (securityPin.length !== 4 || !/^\d{4}$/.test(securityPin)) {
      console.log('❌ Validation failed: Invalid Security PIN format');
      return res.status(400).json({
        success: false,
        error: 'Security PIN must be exactly 4 digits'
      });
    }

    if (loginPin === securityPin) {
      console.log('⚠️ Warning: Login PIN and Security PIN are the same (not recommended but allowed)');
    }

    if (!storeName.trim()) {
      console.log('❌ Validation failed: Empty store name');
      return res.status(400).json({
        success: false,
        error: 'Store name cannot be empty'
      });
    }

    console.log('✅ Validation passed, checking for existing store...');

    // Check if store name already exists (case-insensitive)
    const existingStore = await Store.findOne({
      name: { $regex: new RegExp(`^${storeName.trim()}$`, 'i') }
    });

    if (existingStore) {
      console.log('❌ Store name already exists:', existingStore._id);
      return res.status(400).json({
        success: false,
        error: 'Store name already exists'
      });
    }

    // Check if Login PIN is already in use by any admin
    const existingAdmin = await User.findOne({ 
      loginPin: loginPin, 
      role: 'admin'
    });
    
    if (existingAdmin) {
      console.log('❌ Login PIN already in use by another admin:', existingAdmin._id);
      return res.status(400).json({
        success: false,
        error: 'This Login PIN is already in use. Please choose a different PIN.'
      });
    }

    console.log('✅ Store name and Login PIN available, creating admin and store...');

    // Use a transaction-like approach: create admin first, then store, then update admin
    // This avoids the unique constraint issue with null storeId
    
    // Step 1: Create admin user with a temporary storeId placeholder
    const tempStoreId = new mongoose.Types.ObjectId(); // Generate a temporary ID
    
    const admin = new User({
      name,
      loginPin: loginPin,
      securityPin: securityPin, // Store SEPARATE Security PIN
      role: 'admin',
      storeId: tempStoreId,
      storeName: storeName.trim()
    });

    console.log('Admin object created (before save):', {
      name: admin.name,
      role: admin.role,
      storeName: admin.storeName,
      hasLoginPin: !!admin.loginPin,
      hasSecurityPin: !!admin.securityPin
    });

    const savedAdmin = await admin.save();
    console.log('✅ Admin saved successfully:', savedAdmin._id);

    // Step 2: Create store with the admin's ID as ownerId
    const store = new Store({
      name: storeName.trim(),
      ownerId: savedAdmin._id
    });

    const savedStore = await store.save();
    console.log('✅ Store created:', savedStore._id);

    // Step 3: Update admin with the actual storeId
    savedAdmin.storeId = savedStore._id;
    await savedAdmin.save();
    console.log('✅ Admin updated with actual storeId');

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: savedAdmin._id,
          name: savedAdmin.name,
          role: savedAdmin.role,
          storeId: savedAdmin.storeId,
          storeName: savedAdmin.storeName
        },
        store: {
          id: savedStore._id,
          name: savedStore.name
        }
      }
    });
  } catch (error) {
    console.error('❌ SETUP ADMIN ERROR:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Handle duplicate store name error from pre-save hook
    if (error.code === 'DUPLICATE_STORE_NAME') {
      return res.status(400).json({
        success: false,
        error: 'Store name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create admin user and store'
    });
  }
};
// Create staff user
exports.createStaff = async (req, res) => {
  try {
    console.log('=== CREATE STAFF REQUEST RECEIVED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request user:', req.user);
    
    const { name, pin, permissions } = req.body;

    // Validate admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can create staff members'
      });
    }

    console.log('Extracted data:', { name, pin: pin ? '****' : 'missing', permissions });

    if (!name || !pin) {
      console.log('❌ Validation failed: Missing name or PIN');
      return res.status(400).json({
        success: false,
        error: 'Name and PIN are required'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      console.log('❌ Validation failed: Invalid PIN format');
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    console.log('✅ Validation passed, checking for existing user...');

    // Check if PIN is already in use in this store
    const existingUser = await User.findOne({ 
      loginPin: pin, 
      storeId: req.user.storeId,
      role: 'staff'
    });
    
    if (existingUser) {
      console.log('❌ PIN already in use by user:', existingUser._id);
      return res.status(400).json({
        success: false,
        error: 'This PIN is already in use. Please choose a different PIN.'
      });
    }

    console.log('✅ PIN is available, creating new staff user...');

    // Create staff user with admin's store information and permissions
    const staff = new User({
      name,
      loginPin: pin,
      role: 'staff',
      storeId: req.user.storeId,
      storeName: req.user.storeName,
      createdBy: req.user.id,
      permissions: permissions || {
        viewProducts: true,      // Always true, compulsory
        scanProducts: true,
        registerProducts: true,
        addProducts: true,
        processSales: true,
      }
    });

    console.log('Staff object created (before save):', {
      name: staff.name,
      role: staff.role,
      storeId: staff.storeId,
      storeName: staff.storeName,
      permissions: staff.permissions
    });

    const savedStaff = await staff.save();
    
    console.log('✅ Staff saved successfully!');
    console.log('Saved staff ID:', savedStaff._id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: savedStaff._id,
          name: savedStaff.name,
          role: savedStaff.role,
          storeId: savedStaff.storeId,
          storeName: savedStaff.storeName,
          createdBy: savedStaff.createdBy,
          permissions: savedStaff.permissions
        }
      }
    });
  } catch (error) {
    console.error('❌ CREATE STAFF ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create staff user'
    });
  }
};
// Check if setup is complete
exports.checkSetup = async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' });

    res.json({
      success: true,
      data: {
        setupComplete: !!admin
      }
    });
  } catch (error) {
    console.error('Check setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check setup status'
    });
  }
};

// Verify admin PIN for a specific store (used by staff to access admin pages)
exports.verifyAdminPin = async (req, res) => {
  try {
    const { pin, storeId } = req.body;

    if (!pin || !storeId) {
      return res.status(400).json({
        success: false,
        error: 'PIN and store ID are required'
      });
    }

    // Find admin user for this store
    const admin = await User.findOne({ 
      role: 'admin', 
      storeId: storeId,
      isActive: true 
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found for this store'
      });
    }

    // Verify Security PIN (not Login PIN)
    if (admin.securityPin === pin) {
      res.json({
        success: true,
        message: 'Admin Security PIN verified'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Incorrect admin Security PIN'
      });
    }
  } catch (error) {
    console.error('Verify admin PIN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify admin PIN'
    });
  }
};

// Verify admin Security PIN for sensitive operations (used by staff for product registration/deletion)
exports.verifyAdminSecurityPin = async (req, res) => {
  try {
    const { pin, storeId } = req.body;

    console.log('🔐 verifyAdminSecurityPin — storeId:', storeId, 'pin length:', pin?.length);

    if (!pin || !storeId) {
      return res.status(400).json({
        success: false,
        error: 'PIN and store ID are required'
      });
    }

    // Find admin user for this store
    const admin = await User.findOne({ 
      role: 'admin', 
      storeId: storeId,
      isActive: true 
    });

    console.log('🔐 verifyAdminSecurityPin — admin found:', admin ? admin._id : 'NOT FOUND', 'hasSecurityPin:', !!(admin?.securityPin));

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found for this store'
      });
    }

    // Verify Security PIN
    console.log('🔐 verifyAdminSecurityPin — pin match:', admin.securityPin === pin);
    if (admin.securityPin === pin) {
      res.json({
        success: true,
        message: 'Admin Security PIN verified'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Incorrect Admin Security PIN'
      });
    }
  } catch (error) {
    console.error('Verify admin Security PIN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify admin Security PIN'
    });
  }
};

// Get admin info by store ID (used by staff to display admin name when accessing admin dashboard)
exports.getAdminInfo = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    // Find admin user for this store
    const admin = await User.findOne({ 
      role: 'admin', 
      storeId: storeId,
      isActive: true 
    }).select('name storeId storeName');

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found for this store'
      });
    }

    res.json({
      success: true,
      data: {
        name: admin.name,
        storeId: admin.storeId,
        storeName: admin.storeName
      }
    });
  } catch (error) {
    console.error('Get admin info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get admin info'
    });
  }
};

// Check if admin has security PIN set (used by staff to check before registering products)
exports.checkAdminSecurityPin = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    // Find admin user for this store
    const admin = await User.findOne({ 
      role: 'admin', 
      storeId: storeId,
      isActive: true 
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found for this store'
      });
    }

    res.json({
      success: true,
      data: {
        hasSecurityPin: !!(admin.securityPin && admin.securityPin.length === 4),
        securityPin: admin.securityPin // Return PIN so staff can cache it
      }
    });
  } catch (error) {
    console.error('Check admin security PIN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check security PIN'
    });
  }
};
// Verify store + admin PIN (used before staff registration to confirm access)
exports.verifyStore = async (req, res) => {
  try {
    const { storeName, adminLoginPin } = req.body;

    if (!storeName || !adminLoginPin) {
      return res.status(400).json({ success: false, error: 'Store name and admin PIN are required' });
    }

    const store = await Store.findOne({
      name: { $regex: new RegExp(`^${storeName.trim()}$`, 'i') },
      isActive: { $ne: false }
    });

    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found. Check the store name.' });
    }

    const admin = await User.findOne({ role: 'admin', storeId: store._id, loginPin: adminLoginPin, isActive: true });

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid admin PIN for this store.' });
    }

    res.json({ success: true, data: { storeName: store.name, storeId: store._id } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
};

// Join existing store (staff registration with store name + admin login PIN)
exports.joinStore = async (req, res) => {
  try {
    console.log('=== JOIN STORE REQUEST RECEIVED ===');
    
    const { name, pin, storeName, adminLoginPin } = req.body;

    if (!name || !pin || !storeName || !adminLoginPin) {
      return res.status(400).json({
        success: false,
        error: 'Name, PIN, store name, and admin login PIN are required'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    // Find store by name (case-insensitive)
    const store = await Store.findOne({
      name: { $regex: new RegExp(`^${storeName.trim()}$`, 'i') },
      isActive: { $ne: false }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found. Check the store name and try again.'
      });
    }

    // Verify admin login PIN for this store
    const admin = await User.findOne({
      role: 'admin',
      storeId: store._id,
      loginPin: adminLoginPin,
      isActive: true
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin PIN for this store.'
      });
    }

    // Check if staff PIN is already in use in this store
    const existingUser = await User.findOne({ loginPin: pin, storeId: store._id });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'This PIN is already in use in this store. Choose a different PIN.'
      });
    }

    const staff = new User({
      name,
      loginPin: pin,
      role: 'staff',
      storeId: store._id,
      storeName: store.name,
      createdBy: admin._id,
      permissions: {
        viewProducts: true,
        scanProducts: true,
        registerProducts: true,
        addProducts: true,
        processSales: true,
      }
    });

    const savedStaff = await staff.save();

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: savedStaff._id,
          name: savedStaff.name,
          role: savedStaff.role,
          storeId: savedStaff.storeId,
          storeName: savedStaff.storeName
        }
      }
    });
  } catch (error) {
    console.error('❌ JOIN STORE ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to join store'
    });
  }
};

// Get all staff members
exports.getStaff = async (req, res) => {
  try {
    // Build query based on user role
    let query = { role: 'staff' };
    
    // If not author, filter by store
    if (!req.user.isAuthor) {
      query.storeId = req.user.storeId;
    }

    const staff = await User.find(query)
      .select('-loginPin -securityPin -pin')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff members'
    });
  }
};

// Update staff member
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, pin, isActive } = req.body;

    const staff = await User.findOne({ _id: id, role: 'staff' });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    if (name) staff.name = name;
    if (isActive !== undefined) staff.isActive = isActive;
    
    if (pin) {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          success: false,
          error: 'PIN must be exactly 4 digits'
        });
      }

      // Check if new PIN is already in use by another user in the same store
      const existingUser = await User.findOne({ 
        loginPin: pin, 
        storeId: staff.storeId,
        _id: { $ne: id } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'This PIN is already in use in your store. Please choose a different PIN.'
        });
      }

      staff.loginPin = pin;
    }

    await staff.save();

    res.json({
      success: true,
      data: {
        user: {
          id: staff._id,
          name: staff.name,
          role: staff.role,
          isActive: staff.isActive
        }
      }
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update staff member'
    });
  }
};

// Get individual staff member by ID (admin only)
exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view staff details'
      });
    }

    // Find staff member
    const staff = await User.findOne({
      _id: id,
      storeId: req.user.storeId,
      role: 'staff'
    }).select('-loginPin -__v');

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: staff._id,
        name: staff.name,
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive,
        lastLogin: staff.lastLogin,
        createdAt: staff.createdAt
      }
    });
  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get staff details'
    });
  }
};

// Update staff permissions (admin only)
exports.updateStaffPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    // Validate admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can update staff permissions'
      });
    }

    // Find staff user
    const staff = await User.findOne({ 
      _id: id, 
      role: 'staff',
      storeId: req.user.storeId 
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    // Update permissions
    staff.permissions = {
      ...staff.permissions,
      ...permissions
    };

    await staff.save();

    console.log('✅ Staff permissions updated:', staff._id);

    res.json({
      success: true,
      message: 'Permissions updated successfully',
      data: {
        id: staff._id,
        name: staff.name,
        permissions: staff.permissions
      }
    });
  } catch (error) {
    console.error('Update staff permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update permissions'
    });
  }
};

// Delete staff member
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can delete staff members'
      });
    }

    const staff = await User.findOne({ _id: id, role: 'staff' });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    // Verify staff belongs to admin's store
    if (staff.storeId.toString() !== req.user.storeId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this store'
      });
    }

    await User.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete staff member'
    });
  }
};

// Get staff activity monitoring data
exports.getStaffActivity = async (req, res) => {
  try {
    // Validate admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view staff activity'
      });
    }

    const { staffId } = req.params;
    const { days = 7 } = req.query; // Default to last 7 days

    // Find the staff member
    const staff = await User.findOne({ 
      _id: staffId, 
      role: 'staff',
      storeId: req.user.storeId 
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get activity data (you can expand this based on your needs)
    const activityData = {
      staffInfo: {
        id: staff._id,
        name: staff.name,
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive,
        lastLogin: staff.lastLogin,
        createdAt: staff.createdAt
      },
      period: {
        startDate,
        endDate,
        days: parseInt(days)
      },
      // Add more activity metrics as needed
      summary: {
        totalLogins: 0, // You can implement login tracking
        lastActivity: staff.lastLogin,
        status: staff.isActive ? 'Active' : 'Inactive'
      }
    };

    console.log('✅ Staff activity data retrieved for:', staff.name);

    res.json({
      success: true,
      data: activityData
    });
  } catch (error) {
    console.error('❌ Get staff activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve staff activity'
    });
  }
};

// Update admin PIN
exports.updateAdminPin = async (req, res) => {
  try {
    const { oldPin, newPin, pinType } = req.body; // pinType: 'login' or 'security'

    // oldPin is optional for security PIN first-time setup (when no PIN exists yet)
    if (!newPin || !pinType) {
      return res.status(400).json({
        success: false,
        error: 'New PIN and PIN type are required'
      });
    }

    // Login PIN always requires oldPin
    if (pinType === 'login' && !oldPin) {
      return res.status(400).json({
        success: false,
        error: 'Current Login PIN is required'
      });
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        error: 'New PIN must be exactly 4 digits'
      });
    }

    // Find admin user
    const admin = await User.findOne({ _id: req.user.id, role: 'admin' });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    // Verify old PIN based on type
    if (pinType === 'login') {
      if (admin.loginPin !== oldPin) {
        return res.status(401).json({
          success: false,
          error: 'Invalid current Login PIN'
        });
      }

      // Check if new PIN is already in use by another user in the same store
      const existingUser = await User.findOne({ 
        loginPin: newPin, 
        storeId: admin.storeId,
        _id: { $ne: admin._id } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'This PIN is already in use in your store. Please choose a different PIN.'
        });
      }

      // Update Login PIN
      admin.loginPin = newPin;
      await admin.save();

      res.json({
        success: true,
        message: 'Login PIN updated successfully'
      });
    } else if (pinType === 'security') {
      const hasExistingPin = admin.securityPin && admin.securityPin.length === 4;

      console.log('🔐 updateAdminPin — security — hasExistingPin:', hasExistingPin, 'oldPin provided:', !!oldPin);

      if (hasExistingPin) {
        // Existing PIN — require old PIN to verify
        if (!oldPin) {
          return res.status(400).json({
            success: false,
            error: 'Current Security PIN is required to update it'
          });
        }
        if (admin.securityPin !== oldPin) {
          return res.status(401).json({
            success: false,
            error: 'Invalid current Security PIN'
          });
        }
      }
      // No existing PIN — first-time setup, no verification needed

      // Update Security PIN
      admin.securityPin = newPin;
      await admin.save();

      res.json({
        success: true,
        message: hasExistingPin ? 'Security PIN updated successfully' : 'Security PIN created successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid PIN type. Must be "login" or "security"'
      });
    }
  } catch (error) {
    console.error('Update admin PIN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin PIN'
    });
  }
};

// Remove admin security PIN (sets it to null in DB)
exports.removeAdminSecurityPin = async (req, res) => {
  try {
    const { currentPin } = req.body;

    const admin = await User.findOne({ _id: req.user.id, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }

    // Verify current PIN before removing
    if (admin.securityPin && admin.securityPin !== currentPin) {
      return res.status(401).json({ success: false, error: 'Incorrect current Security PIN' });
    }

    admin.securityPin = null;
    await admin.save();

    console.log('🔐 removeAdminSecurityPin — PIN cleared for admin:', admin._id);

    res.json({ success: true, message: 'Security PIN removed successfully' });
  } catch (error) {
    console.error('Remove admin security PIN error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove security PIN' });
  }
};

// Delete admin account (admin deletes their own account)
exports.deleteAdminAccount = async (req, res) => {
  try {
    const { pin } = req.body;

    // Validate admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can delete their own account'
      });
    }

    // Find admin user
    const admin = await User.findOne({ _id: req.user.id, role: 'admin' });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    // Verify Security PIN
    if (admin.securityPin !== pin) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect Security PIN'
      });
    }

    const storeId = admin.storeId;

    // Delete all staff members in this store
    await User.deleteMany({ storeId: storeId, role: 'staff' });

    // Delete the store
    await Store.deleteOne({ _id: storeId });

    // Delete the admin account
    await User.deleteOne({ _id: admin._id });

    console.log('✅ Admin account and store deleted:', admin._id);

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete admin account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
};

// Delete staff account (staff deletes their own account)
exports.deleteStaffAccount = async (req, res) => {
  try {
    const { pin } = req.body;

    // Validate staff role
    if (!req.user || req.user.role !== 'staff') {
      return res.status(403).json({
        success: false,
        error: 'Only staff can delete their own account'
      });
    }

    // Find staff user
    const staff = await User.findOne({ _id: req.user.id, role: 'staff' });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff user not found'
      });
    }

    // Verify Login PIN
    if (staff.loginPin !== pin) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect PIN'
      });
    }

    // Delete the staff account
    await User.deleteOne({ _id: staff._id });

    console.log('✅ Staff account deleted:', staff._id);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete staff account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
};