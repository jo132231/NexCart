const { Kafka } = require('kafkajs')
const logger = require('./logger')

const kafka = new Kafka({
  clientId: process.env.SERVICE_NAME || 'nexcart',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
})

const createProducer = async () => {
  const producer = kafka.producer()
  await producer.connect()
  logger.info('Kafka producer connected')
  return producer
}

const createConsumer = async (groupId) => {
  const consumer = kafka.consumer({ groupId })
  await consumer.connect()
  logger.info(`Kafka consumer connected — group: ${groupId}`)
  return consumer
}

module.exports = { kafka, createProducer, createConsumer }
 