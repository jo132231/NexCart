const { createTopics } = require('./kafkaClient')
const logger = require('./logger')

const initKafka = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await createTopics()
      return
    } catch (err) {
      logger.warn(`Kafka not ready, retrying (${i + 1}/${retries})...`)
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  throw new Error('Could not connect to Kafka after multiple retries')
}

module.exports = initKafka