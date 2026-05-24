import prisma from '../config/prisma.js'

// @desc    Get all notifications for the logged-in user
// @route   GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(notifications.map(n => ({ ...n, _id: n.id })))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    })
    res.json({ count })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    })
    res.json({ message: 'Marked as read' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    })
    res.json({ message: 'All marked as read' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Delete all notifications
// @route   DELETE /api/notifications
export const clearAllNotifications = async (req, res) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.user.id },
    })
    res.json({ message: 'All notifications cleared' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
