import express from 'express'
import cors from 'cors'
import path from 'path'
import http from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import prisma from './config/prisma.js'
import userRoutes from './routes/userRoutes.js'
import postRoutes from './routes/postRoutes.js'
import noteRoutes from './routes/noteRoutes.js'
import taskRoutes from './routes/taskRoutes.js'
import eventRoutes from './routes/eventRoutes.js'
import documentRoutes from './routes/documentRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import newsRoutes from './routes/newsRoutes.js'
import opportunityRoutes from './routes/opportunityRoutes.js'
import groupRoutes from './routes/groupRoutes.js'
import seedDatabase from './utils/seed.js'

const app = express()
const PORT = process.env.PORT || 5000

// Create HTTP server and attach Socket.IO
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Make io accessible to routes
app.set('io', io)

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map()

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('Authentication error'))
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) return next(new Error('User not found'))
    socket.user = user
    next()
  } catch (err) {
    next(new Error('Authentication error'))
  }
})

io.on('connection', (socket) => {
  const userId = socket.user.id
  console.log(`User connected: ${socket.user.name} (${userId})`)

  // Track online status
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set())
  }
  onlineUsers.get(userId).add(socket.id)

  // Join personal notification room
  socket.join(`user_${userId}`)

  // Broadcast online status
  io.emit('user_online', { userId })

  // Join user's conversation rooms
  const joinRooms = async () => {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    })
    memberships.forEach(m => socket.join(`conv_${m.conversationId}`))
  }
  joinRooms()

  // Handle joining a specific conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conv_${conversationId}`)
  })

  // Auto-join new conversation room when added
  socket.on('join_new_conversation', ({ conversationId }) => {
    socket.join(`conv_${conversationId}`)
  })

  // Handle typing indicator
  socket.on('typing', ({ conversationId }) => {
    socket.to(`conv_${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      userName: socket.user.name,
    })
  })

  socket.on('stop_typing', ({ conversationId }) => {
    socket.to(`conv_${conversationId}`).emit('user_stop_typing', {
      conversationId,
      userId,
    })
  })

  // Get online users list
  socket.on('get_online_users', () => {
    socket.emit('online_users_list', Array.from(onlineUsers.keys()))
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.name}`)
    const sockets = onlineUsers.get(userId)
    if (sockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) {
        onlineUsers.delete(userId)
        io.emit('user_offline', { userId })
      }
    }
  })
})

// Connect to PostgreSQL and seed data
const startServer = async () => {
  try {
    await prisma.$connect()
    console.log('PostgreSQL connected via Prisma')
  } catch (error) {
    console.error('Database connection failed:', error.message)
    process.exit(1)
  }

  await seedDatabase()

  // Middleware
  app.use(cors())
  app.use(express.json({ limit: '250mb' }))
  app.use(express.urlencoded({ extended: true, limit: '250mb' }))

  // Serve uploads directory as static files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  // Health check endpoint (no auth required)
  app.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({
        status: 'ok',
        server: true,
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    } catch {
      res.json({
        status: 'error',
        server: true,
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      })
    }
  })

  // Routes
  app.get('/', (req, res) => {
    res.json({ message: 'Medihub API Server' })
  })

  app.use('/api/users', userRoutes)
  app.use('/api/posts', postRoutes)
  app.use('/api/notes', noteRoutes)
  app.use('/api/tasks', taskRoutes)
  app.use('/api/events', eventRoutes)
  app.use('/api/documents', documentRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/chat', chatRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/news', newsRoutes)
  app.use('/api/opportunities', opportunityRoutes)
  app.use('/api/groups', groupRoutes)

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ message: 'Something went wrong!', error: err.message })
  })

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

startServer()
