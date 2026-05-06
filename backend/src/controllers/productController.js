const Product = require("../models/Product");
const Sale = require("../models/Sale");

// @desc    Add a new product or new batch
// @route   POST /api/products
exports.addProduct = async (req, res) => {
  try {
    const {
      name,
      barcode,
      internalCode,
      category,
      quantity,
      expiryDate,
      price,
      imageUrl,
      hasBarcode,
      isPerishable,
    } = req.body;

    // Get storeId from authenticated user
    const storeId = req.user.storeId;

    if (!storeId && !req.user.isAuthor) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    //Check if product already exists (by barcode or internal code) in this store
    let product = null;
    if (barcode || internalCode) {
      const query = {
        ...req.tenantFilter, // Apply store filter
        $or: [
          ...(barcode ? [{ barcode }] : []),
          ...(internalCode ? [{ internalCode }] : []),
        ],
      };
      product = await Product.findOne(query);
    }

    //Prepare the new batch object
    const newBatch = {
      batchNumber: `BN-${Date.now()}`,
      quantity: Number(quantity),
      price: Number(price) || 0,
    };

    // Only add expiryDate if it's a valid non-empty string
    if (expiryDate && expiryDate.trim() !== "") {
      newBatch.expiryDate = new Date(expiryDate);
    }

    if (product) {
      // SCENARIO A: Product exists, add a new batch to it
      product.batches.push(newBatch);

      // Update metadata if provided
      if (imageUrl) product.imageUrl = imageUrl;
      if (category) product.category = category;

      await product.save();

      return res.status(200).json({
        success: true,
        message: "New batch added to existing product",
        data: product,
      });
    } else {
      // SCENARIO B: New product entirely
      // Use "|| undefined" so MongoDB doesn't save a null key into unique indexes
      const newProduct = await Product.create({
        storeId, // Add storeId to new product
        name,
        barcode: barcode || undefined,
        internalCode: internalCode || undefined,
        category,
        isPerishable: isPerishable === true || isPerishable === "true",
        hasBarcode: hasBarcode ?? !!barcode,
        imageUrl: imageUrl || "https://via.placeholder.com/150",
        batches: [newBatch],
      });

      return res.status(201).json({
        success: true,
        message: "Product and first batch created",
        data: newProduct,
      });
    }
  } catch (error) {
    console.error("AddProduct Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    // Apply tenant filter (empty for author, storeId for admin/staff)
    // Optimize query: select only needed fields, use lean() for faster reads
    const rawProducts = await Product.find(req.tenantFilter)
      .select('name barcode internalCode category imageUrl hasBarcode isPerishable batches createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean(); // Convert to plain JS objects (faster)

    const products = rawProducts.map((p) => {
      // Calculate total quantity
      const totalQuantity = p.batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      
      // FEFO: Find the batch that is expiring soonest
      const sortedBatches = [...p.batches]
        .filter((b) => b.expiryDate)
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

      return {
        ...p,
        id: p._id,
        quantity: totalQuantity,
        expiryDate:
          sortedBatches.length > 0 ? sortedBatches[0].expiryDate : "N/A",
        receivedDate: p.createdAt,
        hasBarcode: p.hasBarcode ?? !!p.barcode,
      };
    });

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error('GetProducts Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single product by ID or Barcode
// @route   GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    let product;

    //Check if the 'id' looks like a MongoDB ObjectID
    const isMongoId = id.match(/^[0-9a-fA-F]{24}$/);

    if (isMongoId) {
      product = await Product.findOne({ _id: id, ...req.tenantFilter });
    }

    //Fallback: Search by Barcode if not found by ID
    if (!product) {
      product = await Product.findOne({ barcode: id, ...req.tenantFilter });
    }

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        ...product._doc,
        quantity: product.totalQuantity,
      },
    });
  } catch (error) {
    console.error("GetProductById Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update product details (name, category, image)
// @route   PATCH /api/products/:id
// @access  Admin
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, imageUrl } = req.body;

    // Find product with store filter
    const product = await Product.findOneAndUpdate(
      { _id: id, ...req.tenantFilter },
      {
        name,
        category,
        imageUrl,
        updatedAt: Date.now(),
      },
      { new: true, runValidators: true },
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error("UpdateProduct Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product. Please try again.",
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Admin
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ ========== DELETE PRODUCT REQUEST ==========');
    console.log('Product ID:', id);
    console.log('User:', req.user ? {
      id: req.user.id,
      role: req.user.role,
      storeId: req.user.storeId,
      isAuthor: req.user.isAuthor
    } : 'UNDEFINED');
    console.log('Tenant filter:', req.tenantFilter);
    console.log('Request headers:', {
      authorization: req.headers.authorization ? 'Bearer ***' : 'MISSING',
      contentType: req.headers['content-type']
    });

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ Invalid product ID format');
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    // Find and delete with store filter
    console.log('🔍 Searching for product with query:', { _id: id, ...req.tenantFilter });
    const product = await Product.findOneAndDelete({ _id: id, ...req.tenantFilter });

    if (!product) {
      console.log('❌ Product not found with ID:', id, 'and tenant filter:', req.tenantFilter);
      return res.status(404).json({
        success: false,
        message: "Product not found or you don't have permission to delete it",
      });
    }

    console.log('✅ Product deleted successfully:', product.name);
    console.log('🗑️ ========== DELETE COMPLETE ==========\n');

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error('❌ ========== DELETE PRODUCT ERROR ==========');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('User at error:', req.user ? {
      id: req.user.id,
      role: req.user.role,
      storeId: req.user.storeId
    } : 'UNDEFINED');
    console.error('Tenant filter at error:', req.tenantFilter);
    console.error('========================================\n');
    
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product. Please try again.",
    });
  }
};

// @desc    Delete specific batch from product
// @route   DELETE /api/products/:id/batches/:batchNumber
// @access  Admin
exports.deleteBatch = async (req, res) => {
  try {
    const { id, batchNumber } = req.params;

    // Find product with store filter
    const product = await Product.findOne({ _id: id, ...req.tenantFilter });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find and remove the batch
    const initialLength = product.batches.length;
    product.batches = product.batches.filter(
      (b) => b.batchNumber !== batchNumber,
    );

    if (product.batches.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Batch deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error("DeleteBatch Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Process a sale (FEFO Stock Deduction)
// @route   POST /api/products/process-sale
exports.processSale = async (req, res) => {
  try {
    const { items } = req.body; // Array of { productId, quantity, price }
    const saleRecords = [];
    const updatedProducts = []; // Track products for prediction updates
    const storeId = req.user.storeId; // Get storeId from authenticated user

    for (const item of items) {
      // Find product with store filter
      const product = await Product.findOne({ _id: item.productId, ...req.tenantFilter });
      if (!product) continue;

      let remainingToDeduct = item.quantity;
      const batchesUsed = []; // Track which batches were used

      // FEFO Logic: Sort batches by expiry date (Oldest/Soonest first)
      product.batches.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate) - new Date(b.expiryDate);
      });

      for (let batch of product.batches) {
        if (remainingToDeduct <= 0) break;

        const quantityFromBatch = Math.min(batch.quantity, remainingToDeduct);
        
        if (quantityFromBatch > 0) {
          batchesUsed.push({
            batchNumber: batch.batchNumber,
            quantity: quantityFromBatch,
            price: batch.price || item.price || 0
          });
        }

        if (batch.quantity >= remainingToDeduct) {
          batch.quantity -= remainingToDeduct;
          remainingToDeduct = 0;
        } else {
          remainingToDeduct -= batch.quantity;
          batch.quantity = 0;
        }
      }

      // Remove batches that hit 0 to keep DB clean
      product.batches = product.batches.filter((b) => b.quantity > 0);
      await product.save();

      // Record the sale for each batch used (for accurate tracking)
      for (const batchUsed of batchesUsed) {
        const saleRecord = new Sale({
          storeId, // Add storeId to sale record
          productId: product._id,
          productName: product.name,
          batchNumber: batchUsed.batchNumber,
          category: product.category,
          quantitySold: batchUsed.quantity,
          priceAtSale: batchUsed.price,
          totalAmount: batchUsed.price * batchUsed.quantity,
          saleDate: new Date(),
          paymentMethod: item.paymentMethod || 'cash',
          soldBy: {
            userId: req.user.id,
            role: req.user.role || 'staff',
          },
        });

        saleRecords.push(saleRecord);
      }

      updatedProducts.push({
        productId: product._id,
        category: product.category,
        saleData: {
          quantitySold: item.quantity,
          saleDate: new Date()
        }
      });
    }

    // Save all sale records
    if (saleRecords.length > 0) {
      await Sale.insertMany(saleRecords);
    }

    // ============================================================================
    // REAL-TIME PREDICTION UPDATES (NEW)
    // ============================================================================
    
    // Update predictions in background (don't block response)
    if (updatedProducts.length > 0) {
      // Import services
      const { updatePredictionAfterSale } = require('../services/predicitveAnalytics');
      const { broadcastPredictionUpdate, broadcastDashboardUpdate } = require('../services/websocketService');
      const cacheService = require('../services/cacheService');
      
      // Process updates asynchronously
      setImmediate(async () => {
        for (const { productId, category, saleData } of updatedProducts) {
          try {
            // Invalidate cache
            cacheService.invalidatePredictionCache(productId, category);
            
            // Update prediction
            const updatedPrediction = await updatePredictionAfterSale(productId, saleData);
            
            if (updatedPrediction) {
              // Broadcast via WebSocket
              broadcastPredictionUpdate(productId, updatedPrediction);
              console.log(`✅ Real-time prediction updated for product ${productId}`);
            }
          } catch (error) {
            console.error(`Failed to update prediction for ${productId}:`, error);
          }
        }
        
        // Broadcast dashboard update
        try {
          const { getQuickInsights } = require('../services/predicitveAnalytics');
          const insights = await getQuickInsights();
          broadcastDashboardUpdate(insights);
        } catch (error) {
          console.error('Failed to broadcast dashboard update:', error);
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Sale processed successfully via FEFO",
      salesRecorded: saleRecords.length
    });
  } catch (error) {
    console.error("ProcessSale Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update generic price for a product
// @route   PUT /api/products/:id/generic-price
// @access  Admin
exports.updateGenericPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { genericPrice } = req.body;

    // Allow null to clear the generic price
    const update = { updatedAt: Date.now() };
    if (genericPrice === null || genericPrice === undefined) {
      update.genericPrice = null;
    } else {
      const priceNum = Number(genericPrice);
      if (isNaN(priceNum) || priceNum < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid genericPrice" });
      }
      update.genericPrice = priceNum;
    }

    // Find and update with store filter
    const product = await Product.findOneAndUpdate(
      { _id: id, ...req.tenantFilter },
      update,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Generic price updated", data: product });
  } catch (error) {
    console.error("UpdateGenericPrice Error:", error);
    res.status(500).json({ success: false, message: "Failed to update price. Please try again." });
  }
};

// @desc    Apply discount to product (reduce price by percentage)
// @route   POST /api/products/:id/discount
// @access  Admin
exports.applyDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { discountPercent } = req.body;

    if (!discountPercent || discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount percentage (must be 0-100)",
      });
    }

    // Find product with store filter
    const product = await Product.findOne({ _id: id, ...req.tenantFilter });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Apply discount to all batches
    product.batches.forEach((batch) => {
      if (batch.price && batch.price > 0) {
        const discountAmount = (batch.price * discountPercent) / 100;
        batch.price = Math.max(0, batch.price - discountAmount);
      }
    });

    // Also apply to generic price if it exists
    if (product.genericPrice && product.genericPrice > 0) {
      const discountAmount = (product.genericPrice * discountPercent) / 100;
      product.genericPrice = Math.max(0, product.genericPrice - discountAmount);
    }

    product.updatedAt = Date.now();
    await product.save();

    res.status(200).json({
      success: true,
      message: `${discountPercent}% discount applied successfully`,
      data: product,
    });
  } catch (error) {
    console.error("ApplyDiscount Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
