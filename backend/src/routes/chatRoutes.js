import express from 'express'
import {
  getConversations,
  getMessages,
  sendMessage,
  sendFileMessage,
  createPrivateConversation,
  createGroupConversation,
  togglePinConversation,
  deleteConversation,
  addGroupMembers,
  removeGroupMember,
  searchUsers,
  getSharedFiles,
  requestJoinGroup,
  handleJoinRequest,
  getPendingJoinRequests,
} from '../controllers/chatController.js'
import { protect } from '../middleware/auth.js'
import { createMemoryUpload } from '../utils/upload.js'

const router = express.Router()
const upload = createMemoryUpload(50 * 1024 * 1024) // 50 MB max

// Conversations
router.get('/conversations', protect, getConversations)
router.post('/conversations/private', protect, createPrivateConversation)
router.post('/conversations/group', protect, createGroupConversation)
router.put('/conversations/:id/pin', protect, togglePinConversation)
router.delete('/conversations/:id', protect, deleteConversation)

// Group members
router.post('/conversations/:id/members', protect, addGroupMembers)
router.delete('/conversations/:id/members/:userId', protect, removeGroupMember)

// Messages
router.get('/conversations/:id/messages', protect, getMessages)
router.post('/conversations/:id/messages', protect, sendMessage)
router.post('/conversations/:id/files', protect, upload.single('file'), sendFileMessage)

// Shared files
router.get('/conversations/:id/files', protect, getSharedFiles)

// User search
router.get('/users/search', protect, searchUsers)

// Join requests
router.get('/join-requests', protect, getPendingJoinRequests)
router.post('/conversations/:id/join-request', protect, requestJoinGroup)
router.put('/join-requests/:id', protect, handleJoinRequest)

export default router
