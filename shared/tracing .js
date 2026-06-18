const { NodeSDK } = require('@opentelemetry/sdk-node')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http')
const { Resource } = require('@opentelemetry/resources')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')

const initTracing = (serviceName) => {
  if (process.env.NODE_ENV === 'test') return

  const exporter = new OTLPTraceExporter({
    // Jaeger accepts OTLP on this endpoint
    url: process.env.JAEGER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
  })

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || 'development'
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-mongoose': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true }
      })
    ]
  })

  sdk.start()

  process.on('SIGTERM', () => {
    sdk.shutdown().then(() => process.exit(0))
  })

  console.log(`Tracing initialized for: ${serviceName}`)
}

module.exports = { initTracing }