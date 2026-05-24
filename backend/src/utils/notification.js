import prisma from '../config/prisma.js'

/**
 * Create a notification and emit it via socket.
 * @param {object} io - Socket.IO server instance
 * @param {object} data - Notification data { userId, type, title, message, link, metadata? }
 * @returns {Promise<object>} The created notification
 */
export async function createAndEmitNotification(io, { userId, type, title, message, link, metadata }) {
  const notif = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link,
      ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
    },
  })
  io.to(`user_${userId}`).emit('new_notification', notif)
  return notif
}
