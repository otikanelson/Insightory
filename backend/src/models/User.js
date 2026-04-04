const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  loginPin: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}$/.test(v);
      },
      message: 'Login PIN must be exactly 4 digits'
    }
  },
  securityPin: {
    type: String,
    required: function() {
      return this.role === 'admin';
    },
    validate: {
      validator: function(v) {
        return !v || /^\d{4}$/.test(v);
      },
      message: 'Security PIN must be exactly 4 digits'
    }
  },
  role: {
    type: String,
    enum: ['author', 'admin', 'staff', 'viewer'],
    default: 'staff'
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: false,
    default: null
  },
  storeName: {
    type: String,
    required: false,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  permissions: {
    viewInventory: { type: Boolean, default: true },
    addProducts: { type: Boolean, default: true },
    editProducts: { type: Boolean, default: true },
    deleteProducts: { type: Boolean, default: false },
    processSales: { type: Boolean, default: true },
    scanBarcodes: { type: Boolean, default: true },
    viewAnalytics: { type: Boolean, default: false },
    exportData: { type: Boolean, default: false },
    manageCategories: { type: Boolean, default: false },
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

// Create compound index for loginPin, role, and storeId to ensure uniqueness per role per store
userSchema.index({ loginPin: 1, role: 1, storeId: 1 }, { unique: true });

// Index for querying users by store and role
userSchema.index({ storeId: 1, role: 1 });

// Index for querying users by role (for author queries)
userSchema.index({ role: 1 });

// Don't return PINs in JSON responses
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.loginPin;
  delete user.securityPin;
  return user;
};

module.exports = mongoose.model('User', userSchema);
