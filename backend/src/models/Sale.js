const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'Store ID is required']
  },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true }, // Denormalized for faster queries
  batchNumber: { type: String, required: true },
  category: { type: String },
  quantitySold: { type: Number, required: true },
  priceAtSale: { type: Number, required: true },
  totalAmount: { type: Number, required: true }, // quantitySold * priceAtSale
  saleDate: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer'], default: 'cash' },
  soldBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  },
}, { timestamps: true });

// Indexes for multi-tenant analytics queries
SaleSchema.index({ storeId: 1, saleDate: -1 });
SaleSchema.index({ storeId: 1, productId: 1, saleDate: -1 });
SaleSchema.index({ storeId: 1, category: 1, saleDate: -1 });

module.exports = mongoose.model('Sale', SaleSchema);