const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  sku: { type: String, default: '' },
  category: { type: String, default: 'General' },
  quantity: { type: Number, default: 0 },
  minQuantity: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  sellPrice: { type: Number, default: 0 },
  location: { type: String, default: '' },
  vendor: { type: String, default: '' },
  manufacturer: { type: String, default: '' },
  description: { type: String, default: '' },
  // Van stock: which tech has this in their vehicle
  vanTechId: { type: String, default: null },
  // P21 / ERP sync fields
  p21ItemId: { type: String, default: null },
  lastSyncedAt: { type: Date, default: null },
  // Status
  status: { type: String, default: 'active' }, // active, discontinued, backordered
}, { timestamps: true });

// Compound index for fast company+category queries
inventorySchema.index({ companyId: 1, category: 1 });
inventorySchema.index({ companyId: 1, sku: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
