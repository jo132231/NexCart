const { Client } = require('@elastic/elasticsearch')
const { logger } = require('../../../../shared/logger')

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  requestTimeout: 30000,
})

const INDEX_NAME = 'nexcart_products'

// Define exactly how our product data is stored and analyzed
const productMapping = {
  mappings: {
    properties: {
      productId: { type: 'keyword' },     // exact match only
      name: {
        type: 'text',                      // full text search
        analyzer: 'standard',
        fields: {
          keyword: { type: 'keyword' },    // also allow exact sort/filter
          suggest: {
            type: 'search_as_you_type'     // powers autocomplete
          }
        }
      },
      description: {
        type: 'text',
        analyzer: 'standard'
      },
      category: {
        type: 'keyword',                   // exact match for filters
        fields: {
          text: { type: 'text' }
        }
      },
      subcategory: { type: 'keyword' },
      brand: {
        type: 'keyword',
        fields: {
          text: { type: 'text' }
        }
      },
      price: { type: 'float' },           // numeric for range queries
      comparePrice: { type: 'float' },
      tags: { type: 'keyword' },
      isActive: { type: 'boolean' },
      ratings: {
        properties: {
          average: { type: 'float' },
          count: { type: 'integer' }
        }
      },
      images: {
        properties: {
          url: { type: 'keyword', index: false },  // stored but not searchable
          isPrimary: { type: 'boolean' }
        }
      },
      createdAt: { type: 'date' }
    }
  },
  settings: {
    number_of_shards: 1,      // single shard fine for development
    number_of_replicas: 0     // no replicas needed locally
  }
}

const initIndex = async () => {
  try {
    // Check if index already exists
    const exists = await client.indices.exists({ index: INDEX_NAME })

    if (!exists) {
      await client.indices.create({
        index: INDEX_NAME,
        ...productMapping
      })
      logger.info(`Elasticsearch index '${INDEX_NAME}' created`)
    } else {
      logger.info(`Elasticsearch index '${INDEX_NAME}' already exists`)
    }
  } catch (err) {
    logger.error('Elasticsearch init failed:', err.message)
    throw err
  }
}

module.exports = { client, INDEX_NAME, initIndex }