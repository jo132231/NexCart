// MinIO/S3 config
const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const path = require('path')
const { AppError } = require('../../../../shared/errorHandler')

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || 'nexcart',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'nexcart123'
  },
  forcePathStyle: true  // required for MinIO
  
})

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.MINIO_BUCKET || 'nexcart-products',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      // Unique filename: products/timestamp-originalname
      const uniqueName = `products/${Date.now()}-${file.originalname.replace(/\s/g, '-')}`
      cb(null, uniqueName)
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new AppError('Only images are allowed (jpg, png, webp)', 400))
    }
  }
})

module.exports = { s3Client, upload }