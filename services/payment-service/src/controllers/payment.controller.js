const paymentService = require('../services/payment.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

const createPaymentIntent = async (req, res, next) => {
  try {
    const { orderId, amount, currency } = req.body
    const result = await paymentService.createPaymentIntent({
      orderId,
      userId: req.user.userId,
      amount,
      currency
    })
    sendSuccess(res, result, 'Payment intent created', 201)
  } catch (err) { next(err) }
}

const getPaymentStatus = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentByOrder(req.params.orderId)
    sendSuccess(res, payment, 'Payment fetched')
  } catch (err) { next(err) }
}

const refund = async (req, res, next) => {
  try {
    const result = await paymentService.processRefund(
      req.params.orderId,
      req.body.amount
    )
    sendSuccess(res, result, 'Refund processed')
  } catch (err) { next(err) }
}

// Webhook — raw body needed for Stripe signature verification
const webhook = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature']
    // req.rawBody is set by express.raw() middleware on this route
    const result = await paymentService.handleWebhook(req.rawBody, signature)
    res.json(result)
  } catch (err) { next(err) }
}

module.exports = { createPaymentIntent, getPaymentStatus, refund, webhook }