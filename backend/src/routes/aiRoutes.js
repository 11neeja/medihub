import express from 'express'
import {
  chatWithAI,
  summarizeDocument,
  getSuggestedQuestions,
  extractDocumentText,
  getAiChatMessages,
  saveAiChatMessage,
  clearAiChatMessages,
} from '../controllers/aiController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.post('/chat', protect, chatWithAI)
router.post('/summarize', protect, summarizeDocument)
router.post('/suggestions', protect, getSuggestedQuestions)
router.post('/extract-text', protect, extractDocumentText)
router.get('/messages', protect, getAiChatMessages)
router.post('/messages', protect, saveAiChatMessage)
router.delete('/messages', protect, clearAiChatMessages)

export default router
