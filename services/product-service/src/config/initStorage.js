const { s3Client } = require('./storage')
const { CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3')
const { logger } = require('../../../../shared/logger')

const initStorage = async () => {
  const bucket = process.env.MINIO_BUCKET || 'nexcart-products'

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
    logger.info(`MinIO bucket '${bucket}' already exists`)
    return
  } catch (headErr) {
    // Bucket doesn't exist yet — fall through to create it
  }

  try {
    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
    logger.info(`MinIO bucket '${bucket}' created`)
  } catch (createErr) {
    // Race condition or already exists — not a fatal error
    if (createErr.name === 'BucketAlreadyOwnedByYou' || createErr.Code === 'BucketAlreadyOwnedByYou') {
      logger.info(`MinIO bucket '${bucket}' already exists (confirmed via create attempt)`)
    } else {
      logger.error('Failed to create MinIO bucket:', createErr.message)
      throw createErr
    }
  }
}

module.exports = initStorage