const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const {
  getUnreadNotifications,
  markAsRead
} = require('../services/notification.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

router.use(protect)

router.get('/', async (req, res, next) => {
  try {
    const notifications = await getUnreadNotifications(req.user.userId)
    sendSuccess(res, notifications, 'Notifications fetched')
  } catch (err) { next(err) }
})

router.put('/:id/read', async (req, res, next) => {
  try {
    await markAsRead(req.user.userId, req.params.id)
    sendSuccess(res, null, 'Marked as read')
  } catch (err) { next(err) }
})

module.exports = router