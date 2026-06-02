// Product Model
// This is the most important file in this service. Create src/models/product.model.js:
const mongoose = require('mongoose')

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },   // e.g. "Size", "Color"
  options: [{ type: String }]               // e.g. ["S", "M", "L", "XL"]
})

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    index: true                             // index for faster search
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  comparePrice: {
    type: Number,               // original price before discount
    default: null
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    index: true
  },
  subcategory: {
    type: String,
    default: null
  },
  brand: {
    type: String,
    default: null,
    index: true
  },
  images: [{
    url: { type: String },
    key: { type: String },       // S3/MinIO key for deletion
    isPrimary: { type: Boolean, default: false }
  }],
  variants: [variantSchema],
  tags: [{ type: String }],
  sku: {
    type: String,
    unique: true,
    sparse: true                 // allows multiple null SKUs
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false               // soft delete — never hard delete products
  },
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  metadata: {
    type: Map,
    of: String                   // flexible key-value for extra attributes
    // e.g. { "material": "cotton", "weight": "200g" }
  }
}, {
  timestamps: true               // auto adds createdAt, updatedAt
})

// Compound index — speeds up filtered + sorted queries dramatically
productSchema.index({ category: 1, price: 1 })
productSchema.index({ isDeleted: 1, isActive: 1 })
productSchema.index({ name: 'text', description: 'text', tags: 'text' })

// Never return deleted products unless explicitly asked
productSchema.pre('find', function () {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: false })
  }
})

module.exports = mongoose.model('Product', productSchema)