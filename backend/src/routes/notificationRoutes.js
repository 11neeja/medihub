import express from 'express'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
} from '../controllers/notificationController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.get('/', protect, getNotifications)
router.get('/unread-count', protect, getUnreadCount)
router.put('/read-all', protect, markAllAsRead)
router.put('/:id/read', protect, markAsRead)
router.delete('/', protect, clearAllNotifications)

export default router
