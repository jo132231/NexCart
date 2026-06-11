const { Kafka, Partitioners, logLevel } = require('kafkajs')
const logger = require('./logger')

const kafka = new Kafka({
  clientId: process.env.SERVICE_NAME || 'nexcart',
  brokers: [process.env.KAFKA_BROKER || '127.0.0.1:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 10,
    multiplier: 2,
    maxRetryTime: 30000
  },
  logLevel: logLevel.ERROR
})

// ─── TOPIC DEFINITIONS ───────────────────────────────────────────
const TOPICS = {
  PRODUCT_EVENTS: 'product-events',
  ORDER_EVENTS: 'order-events',
  INVENTORY_EVENTS: 'inventory-events',
  NOTIFICATION_EVENTS: 'notification-events',

  PRODUCT_EVENTS_DLQ: 'product-events-dlq',
  ORDER_EVENTS_DLQ: 'order-events-dlq',
  INVENTORY_EVENTS_DLQ: 'inventory-events-dlq'
}

// ─── EVENT TYPES ────────────────────────────────────────────────
const EVENT_TYPES = {
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',

  ORDER_PLACED: 'order.placed',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',

  STOCK_RESERVED: 'inventory.stock.reserved',
  STOCK_RELEASED: 'inventory.stock.released',
  STOCK_LOW: 'inventory.stock.low',
  STOCK_DEPLETED: 'inventory.stock.depleted',

  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  NOTIFY_EMAIL: 'notification.email',
  NOTIFY_SMS: 'notification.sms',
  NOTIFY_PUSH: 'notification.push'
}

// ─── CREATE TOPICS ───────────────────────────────────────────────
const createTopics = async () => {
  const admin = kafka.admin()

  try {
    await admin.connect()

    const topicsToCreate = [
      { topic: TOPICS.PRODUCT_EVENTS, numPartitions: 3, replicationFactor: 1 },
      { topic: TOPICS.ORDER_EVENTS, numPartitions: 3, replicationFactor: 1 },
      { topic: TOPICS.INVENTORY_EVENTS, numPartitions: 3, replicationFactor: 1 },
      { topic: TOPICS.NOTIFICATION_EVENTS, numPartitions: 3, replicationFactor: 1 },

      { topic: TOPICS.PRODUCT_EVENTS_DLQ, numPartitions: 1, replicationFactor: 1 },
      { topic: TOPICS.ORDER_EVENTS_DLQ, numPartitions: 1, replicationFactor: 1 },
      { topic: TOPICS.INVENTORY_EVENTS_DLQ, numPartitions: 1, replicationFactor: 1 }
    ]

    await admin.createTopics({
      topics: topicsToCreate,
      waitForLeaders: true
    })

    logger.info('Kafka topics created/verified')
  } catch (err) {
    logger.error('Failed to create Kafka topics:', err.message)
    throw err
  } finally {
    await admin.disconnect()
  }
}

// ─── PRODUCER ─────────────────────────────────────────────────────
const createProducer = async () => {
  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
    allowAutoTopicCreation: false,
    transactionTimeout: 30000
  })

  await producer.connect()
  logger.info('Kafka producer connected')

  const publish = async (topic, eventType, data, key = null) => {
    const message = {
      eventType,
      eventId: generateEventId(),
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'nexcart',
      data
    }

    await producer.send({
      topic,
      messages: [{
        key: key || eventType,
        value: JSON.stringify(message),
        headers: {
          eventType,
          timestamp: message.timestamp
        }
      }]
    })

    logger.info(`Event published: ${eventType} → ${topic}`)
    return message.eventId
  }

  return { producer, publish }
}

// ─── CONSUMER ─────────────────────────────────────────────────────
const createConsumer = async (groupId, topics, handlers, options = {}) => {
  const consumer = kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000
  })

  await consumer.connect()

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false })
  }

  const dlqProducer = await createProducer()
  const maxRetries = options.maxRetries || 3

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let event
      let attempts = 0

      try {
        event = JSON.parse(message.value.toString())
        const handler = handlers[event.eventType]

        if (!handler) {
          logger.info(`No handler for event: ${event.eventType}`)
          return
        }

        while (attempts < maxRetries) {
          try {
            await handler(event)
            logger.info(`Event processed: ${event.eventType}`)
            return
          } catch (err) {
            attempts++
            logger.error(`Handler failed (attempt ${attempts}): ${err.message}`)

            if (attempts < maxRetries) {
              await sleep(Math.pow(2, attempts - 1) * 1000)
            }
          }
        }

        logger.error(`Moving to DLQ: ${event.eventType}`)

        // FIX: use publish, not producer.publish
        await dlqProducer.publish(
          `${topic}-dlq`,
          'dlq.message',
          {
            originalEvent: event,
            topic,
            partition,
            error: 'Max retries exceeded'
          }
        )

      } catch (parseError) {
        logger.error('Failed to parse Kafka message:', parseError.message)
      }
    }
  })

  logger.info(`Kafka consumer started: ${groupId}`)
  return consumer
}

// ─── HELPERS ──────────────────────────────────────────────────────
const generateEventId = () => {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

module.exports = {
  kafka,
  TOPICS,
  EVENT_TYPES,
  createTopics,
  createProducer,
  createConsumer
}