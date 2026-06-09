const { client, INDEX_NAME } = require('../config/elasticsearch')
const logger = require('../../../../shared/logger')

const searchProducts = async ({
  q,
  category,
  brand,
  minPrice,
  maxPrice,
  minRating,
  sort = 'relevance',
  page = 1,
  limit = 20
}) => {
  const from = (page - 1) * limit
  const must = []
  const filter = []

  // Full text search across multiple fields with boosting
  // name matches count more than description matches
  if (q) {
    must.push({
      multi_match: {
        query: q,
        fields: [
          'name^3',           // name matches are 3x more important
          'description^1',
          'brand^2',          // brand matches are 2x more important
          'tags^2',
          'category^1'
        ],
        fuzziness: 'AUTO',    // handles typos — "iphon" matches "iPhone"
        operator: 'or'
      }
    })
  } else {
    must.push({ match_all: {} })  // no query = return everything
  }

  // Filters — these don't affect relevance score
  if (category) filter.push({ term: { category } })
  if (brand) filter.push({ term: { brand } })
  if (minPrice || maxPrice) {
    filter.push({
      range: {
        price: {
          ...(minPrice && { gte: Number(minPrice) }),
          ...(maxPrice && { lte: Number(maxPrice) })
        }
      }
    })
  }
  if (minRating) {
    filter.push({
      range: { 'ratings.average': { gte: Number(minRating) } }
    })
  }

  // Always filter out inactive products
  filter.push({ term: { isActive: true } })

  // Sort options
  const sortOptions = {
    relevance: '_score',                           // default — best match first
    price_asc: { price: 'asc' },
    price_desc: { price: 'desc' },
    newest: { createdAt: 'desc' },
    rating: { 'ratings.average': 'desc' }
  }

  const response = await client.search({
    index: INDEX_NAME,
    body: {
      from,
      size: limit,
      query: {
        bool: { must, filter }
      },
      sort: [sortOptions[sort] || '_score'],

      // Aggregations power the filter sidebar
      // These run in parallel with the search query
      aggs: {
        categories: {
          terms: { field: 'category', size: 20 }
        },
        brands: {
          terms: { field: 'brand', size: 20 }
        },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { key: 'Under $50', to: 50 },
              { key: '$50 - $100', from: 50, to: 100 },
              { key: '$100 - $500', from: 100, to: 500 },
              { key: '$500 - $1000', from: 500, to: 1000 },
              { key: 'Over $1000', from: 1000 }
            ]
          }
        },
        avg_price: { avg: { field: 'price' } },
        rating_distribution: {
          terms: { field: 'ratings.average', size: 5 }
        }
      },

      // Highlight matching text in results
      highlight: {
        fields: {
          name: {},
          description: { fragment_size: 150 }
        }
      }
    }
  })

  const hits = response.hits.hits.map(hit => ({
    ...hit._source,
    _score: hit._score,
    _highlight: hit.highlight || {}
  }))

  return {
    products: hits,
    total: response.hits.total.value,
    page: Number(page),
    pages: Math.ceil(response.hits.total.value / limit),
    aggregations: {
      categories: response.aggregations.categories.buckets,
      brands: response.aggregations.brands.buckets,
      priceRanges: response.aggregations.price_ranges.buckets,
      avgPrice: response.aggregations.avg_price.value
    }
  }
}

const autocomplete = async (q) => {
  if (!q || q.length < 2) return { suggestions: [] }

  const response = await client.search({
    index: INDEX_NAME,
    body: {
      size: 8,   // max 8 suggestions
      query: {
        multi_match: {
          query: q,
          type: 'bool_prefix',   // matches as you type
          fields: [
            'name.suggest',
            'name.suggest._2gram',
            'name.suggest._3gram',
            'brand.text',
            'category.text'
          ]
        }
      },
      _source: ['name', 'brand', 'category', 'price', 'images'],
    }
  })

  const suggestions = response.hits.hits.map(hit => ({
    text: hit._source.name,
    brand: hit._source.brand,
    category: hit._source.category,
    price: hit._source.price,
    image: hit._source.images?.find(i => i.isPrimary)?.url
  }))

  return { suggestions, query: q }
}

const getFilters = async () => {
  const response = await client.search({
    index: INDEX_NAME,
    body: {
      size: 0,   // we only want aggregations, not actual documents
      query: {
        term: { isActive: true }
      },
      aggs: {
        all_categories: {
          terms: { field: 'category', size: 50 }
        },
        all_brands: {
          terms: { field: 'brand', size: 100 }
        },
        price_stats: {
          stats: { field: 'price' }   // min, max, avg, count
        },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { key: 'Under $50', to: 50 },
              { key: '$50 - $100', from: 50, to: 100 },
              { key: '$100 - $500', from: 100, to: 500 },
              { key: '$500 - $1000', from: 500, to: 1000 },
              { key: 'Over $1000', from: 1000 }
            ]
          }
        }
      }
    }
  })

  return {
    categories: response.aggregations.all_categories.buckets,
    brands: response.aggregations.all_brands.buckets,
    priceStats: response.aggregations.price_stats,
    priceRanges: response.aggregations.price_ranges.buckets
  }
}

// Index a single product — called when product is created/updated
const indexProduct = async (product) => {
  await client.index({
    index: INDEX_NAME,
    id: product._id || product.productId,
    document: {
      productId: product._id || product.productId,
      name: product.name,
      description: product.description,
      category: product.category,
      subcategory: product.subcategory,
      brand: product.brand,
      price: product.price,
      comparePrice: product.comparePrice,
      tags: product.tags || [],
      isActive: product.isActive !== false,
      ratings: product.ratings || { average: 0, count: 0 },
      images: product.images || [],
      createdAt: product.createdAt || new Date()
    }
  })
  logger.info(`Product indexed: ${product.name}`)
}

// Bulk index many products at once — used for initial seeding
const bulkIndexProducts = async (products) => {
  if (products.length === 0) return

  const operations = products.flatMap(product => [
    { index: { _index: INDEX_NAME, _id: product._id || product.productId } },
    {
      productId: product._id || product.productId,
      name: product.name,
      description: product.description,
      category: product.category,
      subcategory: product.subcategory,
      brand: product.brand,
      price: product.price,
      comparePrice: product.comparePrice,
      tags: product.tags || [],
      isActive: product.isActive !== false,
      ratings: product.ratings || { average: 0, count: 0 },
      images: product.images || [],
      createdAt: product.createdAt || new Date()
    }
  ])

  const result = await client.bulk({ operations })
  logger.info(`Bulk indexed ${products.length} products`)
  return result
}

const deleteProduct = async (productId) => {
  await client.delete({ index: INDEX_NAME, id: productId })
  logger.info(`Product removed from index: ${productId}`)
}

module.exports = {
  searchProducts,
  autocomplete,
  getFilters,
  indexProduct,
  bulkIndexProducts,
  deleteProduct
}