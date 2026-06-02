// Product Service (business logic)
const Product = require('../models/product.model')
const { AppError } = require('../../../../shared/errorHandler')
const { s3Client } = require('../config/storage')
const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
const logger = require('../../../../shared/logger')

const createProduct = async (productData, files) => {
  // Build images array from uploaded files
  const images = files?.map((file, index) => ({
    url: file.location,          // MinIO public URL
    key: file.key,               // for deletion later
    isPrimary: index === 0       // first image is primary
  })) || []

  const product = await Product.create({ ...productData, images })
  logger.info(`Product created: ${product._id}`)
  return product
}

const getProducts = async (query) => {
  const {
    page = 1,
    limit = 20,
    category,
    brand,
    minPrice,
    maxPrice,
    sort = '-createdAt',
    search
  } = query

  // Build filter object dynamically
  const filter = {}
  if (category) filter.category = category
  if (brand) filter.brand = brand
  if (minPrice || maxPrice) {
    filter.price = {}
    if (minPrice) filter.price.$gte = Number(minPrice)
    if (maxPrice) filter.price.$lte = Number(maxPrice)
  }
  if (search) {
    filter.$text = { $search: search }
  }

  const skip = (page - 1) * limit

  // Run query and count in parallel — faster than sequential
  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .select('-metadata'),      // exclude heavy fields from list view
    Product.countDocuments(filter)
  ])

  return {
    products,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }
}

const getProductById = async (id) => {
  const product = await Product.findById(id)
  if (!product) throw new AppError('Product not found', 404)
  return product
}

const updateProduct = async (id, updateData, files) => {
  const product = await Product.findById(id)
  if (!product) throw new AppError('Product not found', 404)

  // Add new images if uploaded
  if (files?.length > 0) {
    const newImages = files.map((file, index) => ({
      url: file.location,
      key: file.key,
      isPrimary: product.images.length === 0 && index === 0
    }))
    updateData.images = [...product.images, ...newImages]
  }

  const updated = await Product.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }  // return updated doc, run schema validators
  )

  logger.info(`Product updated: ${id}`)
  return updated
}

const deleteProduct = async (id) => {
  const product = await Product.findById(id)
  if (!product) throw new AppError('Product not found', 404)

  // Soft delete — just set isDeleted flag
  await Product.findByIdAndUpdate(id, { isDeleted: true, isActive: false })
  logger.info(`Product soft deleted: ${id}`)
}

const getCategories = async () => {
  // Aggregate distinct categories with product counts
  const categories = await Product.aggregate([
    { $match: { isDeleted: false, isActive: true } },
    { $group: {
      _id: '$category',
      subcategories: { $addToSet: '$subcategory' },
      productCount: { $sum: 1 },
      avgPrice: { $avg: '$price' }
    }},
    { $sort: { productCount: -1 } }
  ])
  return categories
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getCategories
}