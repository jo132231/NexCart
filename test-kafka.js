require('dotenv').config()
const { createProducer } = require('./shared/kafkaClient')

async function test() {
  try {
    const producer = await createProducer()
    await producer.send({
      topic: 'test-topic',
      messages: [{ value: 'Hello from NexCart!' }]
    })
    console.log('Kafka is working perfectly!')
    await producer.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Kafka connection failed:', err.message)
    process.exit(1)
  }
}

test()