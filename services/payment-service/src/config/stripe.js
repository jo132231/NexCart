const Stripe = require('stripe')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  timeout: 10000,
  maxNetworkRetries: 2   // Stripe SDK retries network failures automatically
})

module.exports = stripe