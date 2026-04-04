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
    const { pin, role, storeName } = req.body;

    if (!pin || !role) {
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

    // Find user by loginPin and role
    const user = await User.findOne(query);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

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
        storeName: user.storeName
      },
      sessionToken
    };

    // Include Security PIN for admin users (needed for app functionality)
    if (user.role === 'admin' && user.securityPin) {
      responseData.user.securityPin = user.securityPin;
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
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
      console.log('âŒ Validation failed: Missing name, Login PIN, Security PIN, or store name');
      return res.status(400).json({
        success: false,
        error: 'Name, Login PIN, Security PIN, and store name are required'
      });
    }

    if (loginPin.length !== 4 || !/^\d{4}$/.test(loginPin)) {
      console.log('âŒ Validation failed: Invalid Login PIN format');
      return res.status(400).json({
        success: false,
        error: 'Login PIN must be exactly 4 digits'
      });
    }

    if (securityPin.length !== 4 || !/^\d{4}$/.test(securityPin)) {
      console.log('âŒ Validation failed: Invalid Security PIN format');
      return res.status(400).json({
        success: false,
        error: 'Security PIN must be exactly 4 digits'
      });
    }

    if (loginPin === securityPin) {
      console.log('âš ï¸ Warning: Login PIN and Security PIN are the same (not recommended but allowed)');
    }

    if (!storeName.trim()) {
      console.log('âŒ Validation failed: Empty store name');
      return res.status(400).json({
        success: false,
        error: 'Store name cannot be empty'
      });
    }

    console.log('âœ… Validation passed, checking for existing store...');

    // Check if store name already exists (case-insensitive)
    const existingStore = await Store.findOne({
      name: { $regex: new RegExp(`^${storeName.trim()}$`, 'i') }
    });

    if (existingStore) {
      console.log('âŒ Store name already exists:', existingStore._id);
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
      console.log('âŒ Login PIN already in use by another admin:', existingAdmin._id);
      return res.status(400).json({
        success: false,
        error: 'This Login PIN is already in use. Please choose a different PIN.'
      });
    }

    console.log('âœ… Store name and Login PIN available, creating admin and store...');

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
    console.log('âœ… Admin saved successfully:', savedAdmin._id);

    // Step 2: Create store with the admin's ID as ownerId
    const store = new Store({
      name: storeName.trim(),
      ownerId: savedAdmin._id
    });

    const savedStore = await store.save();
    console.log('âœ… Store created:', savedStore._id);

    // Step 3: Update admin with the actual storeId
    savedAdmin.storeId = savedStore._id;
    await savedAdmin.save();
    console.log('âœ… Admin updated with actual storeId');

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
    console.error('âŒ SETUP ADMIN ERROR:', error);
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
};$`, 'i') }
    });

    if (existingStore) {
      console.log('âŒ Store name already exists:', existingStore._id);
      return res.status(400).json({
        success: false,
        error: 'Store name already exists'
      });
    }

    // Check if PIN is already in use by any admin
    const existingAdmin = await User.findOne({ 
      loginPin: pin, 
      role: 'admin'
    });
    
    if (existingAdmin) {
      console.log('âŒ PIN already in use by another admin:', existingAdmin._id);
      return res.status(400).json({
        success: false,
        error: 'This PIN is already in use. Please choose a different PIN.'
      });
    }

    console.log('âœ… Store name and PIN available, creating admin and store...');

    // Use a transaction-like approach: create admin first, then store, then update admin
    // This avoids the unique constraint issue with null storeId
    
    // Step 1: Create admin user with a temporary storeId placeholder
    const tempStoreId = new mongoose.Types.ObjectId(); // Generate a temporary ID
    
    const admin = new User({
      name,
      loginPin: pin,
      securityPin: pin, // For admin, both PINs are initially the same
      role: 'admin',
      storeId: tempStoreId,
      storeName: storeName.trim()
    });

    console.log('Admin object created (before save):', {
      name: admin.name,
      role: admin.role,
      storeName: admin.storeName
    });

    const savedAdmin = await admin.save();
    console.log('âœ… Admin saved successfully:', savedAdmin._id);

    // Step 2: Create store with the admin's ID as ownerId
    const store = new Store({
      name: storeName.trim(),
      ownerId: savedAdmin._id
    });

    const savedStore = await store.save();
    console.log('âœ… Store created:', savedStore._id);

    // Step 3: Update admin with the actual storeId
    savedAdmin.storeId = savedStore._id;
    await savedAdmin.save();
    console.log('âœ… Admin updated with actual storeId');

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
    console.error('âŒ SETUP ADMIN ERROR:', error);
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
      console.log('âŒ Validation failed: Missing name or PIN');
      return res.status(400).json({
        success: false,
        error: 'Name and PIN are required'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      console.log('âŒ Validation failed: Invalid PIN format');
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    console.log('âœ… Validation passed, checking for existing user...');

    // Check if PIN is already in use in this store
    const existingUser = await User.findOne({ 
      loginPin: pin, 
      storeId: req.user.storeId,
      role: 'staff'
    });
    
    if (existingUser) {
      console.log('âŒ PIN already in use by user:', existingUser._id);
      return res.status(400).json({
        success: false,
        error: 'This PIN is already in use. Please choose a different PIN.'
      });
    }

    console.log('âœ… PIN is available, creating new staff user...');

    // Create staff user with admin's store information and permissions
    const staff = new User({
      name,
      loginPin: pin,
      role: 'staff',
      storeId: req.user.storeId,
      storeName: req.user.storeName,
      createdBy: req.user.id,
      permissions: permissions || {
        viewInventory: true,
        addProducts: true,
        editProducts: true,
        deleteProducts: false,
        processSales: true,
        scanBarcodes: true,
        viewAnalytics: false,
        exportData: false,
        manageCategories: false,
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
    
    console.log('âœ… Staff saved successfully!');
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
    console.error('âŒ CREATE STAFF ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create staff user'
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

// Update staff permissions
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

    // Update permissions
    staff.permissions = {
      ...staff.permissions,
      ...permissions
    };

    await staff.save();

    res.json({
      success: true,
      data: {
        user: {
          id: staff._id,
          name: staff.name,
          role: staff.role,
          permissions: staff.permissions
        }
      }
    });
  } catch (error) {
    console.error('Update staff permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update staff permissions'
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

// Update admin PIN
exports.updateAdminPin = async (req, res) => {
  try {
    const { oldPin, newPin, pinType } = req.body; // pinType: 'login' or 'security'

    if (!oldPin || !newPin || !pinType) {
      return res.status(400).json({
        success: false,
        error: 'Old PIN, new PIN, and PIN type are required'
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
      if (admin.securityPin !== oldPin) {
        return res.status(401).json({
          success: false,
          error: 'Invalid current Security PIN'
        });
      }

      // Update Security PIN
      admin.securityPin = newPin;
      await admin.save();

      res.json({
        success: true,
        message: 'Security PIN updated successfully'
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

    // Verify Security PIN
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

// Admin impersonate staff (login as staff) - VIEW ONLY MODE
exports.impersonateStaff = async (req, res) => {
  try {
    const { staffId } = req.params;

    console.log('ðŸŽ­ Impersonate staff request:', { adminId: req.user.id, staffId });

    // Validate admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can impersonate staff members'
      });
    }

    // Find the staff member
    const staff = await User.findOne({ _id: staffId, role: 'staff' });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    // Verify staff belongs to admin's store
    const staffStoreId = staff.storeId ? staff.storeId.toString() : null;
    const adminStoreId = req.user.storeId ? req.user.storeId.toString() : null;
    
    if (staffStoreId !== adminStoreId) {
      console.log('âŒ Store mismatch:', { staffStoreId, adminStoreId });
      return res.status(403).json({
        success: false,
        error: 'Access denied to this store'
      });
    }

    // Generate JWT session token for VIEW-ONLY mode
    // This token will have a special flag indicating it's view-only
    const sessionToken = jwt.sign(
      { 
        userId: staff._id.toString(),
        role: staff.role,
        storeId: staff.storeId ? staff.storeId.toString() : null,
        isViewOnly: true, // VIEW-ONLY FLAG
        impersonatedBy: req.user.id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('âœ… Admin viewing staff account (VIEW-ONLY):', staff.name);

    res.json({
      success: true,
      data: {
        user: {
          id: staff._id,
          name: staff.name,
          role: staff.role,
          storeId: staff.storeId,
          storeName: staff.storeName,
          permissions: staff.permissions || {},
          isViewOnly: true // VIEW-ONLY FLAG
        },
        sessionToken
      }
    });
  } catch (error) {
    console.error('âŒ Impersonate staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to impersonate staff member'
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


// Staff join existing store
exports.joinStore = async (req, res) => {
  try {
    console.log('=== JOIN STORE REQUEST RECEIVED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { name, pin, storeId } = req.body;

    console.log('Extracted data:', { name, pin: pin ? '****' : 'missing', storeId });

    if (!name || !pin || !storeId) {
      console.log('âŒ Validation failed: Missing name, PIN, or store ID');
      return res.status(400).json({
        success: false,
        error: 'Name, PIN, and store ID are required'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      console.log('âŒ Validation failed: Invalid PIN format');
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    console.log('âœ… Validation passed, checking for existing store...');

    // Verify store exists
    const store = await Store.findById(storeId);
    if (!store) {
      console.log('âŒ Store not found:', storeId);
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    console.log('âœ… Store found:', store.name);

    // Check if PIN is already in use in this store
    const existingUser = await User.findOne({ 
      loginPin: pin, 
      storeId: storeId
    });
    
    if (existingUser) {
      console.log('âŒ PIN already in use by user:', existingUser._id);
      return res.status(400).json({
        success: false,
        error: 'This PIN is already in use in this store. Please choose a different PIN.'
      });
    }

    console.log('âœ… PIN is available, creating new staff user...');

    // Create staff user
    const staff = new User({
      name,
      loginPin: pin,
      role: 'staff',
      storeId: store._id,
      storeName: store.name
    });

    console.log('Staff object created (before save):', {
      name: staff.name,
      role: staff.role,
      storeId: staff.storeId,
      storeName: staff.storeName
    });

    const savedStaff = await staff.save();
    
    console.log('âœ… Staff saved successfully!');
    console.log('Saved staff ID:', savedStaff._id);

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
    console.error('âŒ JOIN STORE ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to join store'
    });
  }
};

