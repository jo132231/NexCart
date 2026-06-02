// Create the MinIO bucket on startup
const { s3Client } = require('./storage')
const { CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3')
const logger = require('../../../../shared/logger')

const initStorage = async () => {
  const bucket = process.env.MINIO_BUCKET || 'nexcart-products'
  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
    logger.info(`MinIO bucket '${bucket}' already exists`)
  } catch {
    // Create it if not
    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
    logger.info(`MinIO bucket '${bucket}' created`)
  }
}

module.exports = initStorage