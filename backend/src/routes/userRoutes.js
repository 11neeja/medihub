import express from 'express'
import { registerUser, loginUser, googleAuth, forgotPassword, resetPassword, getUsers, getMe, sendMailDiagnostic, submitContactMessage } from '../controllers/userController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/google', googleAuth)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/contact', submitContactMessage)
router.post('/test-email', protect, sendMailDiagnostic)
router.get('/me', protect, getMe)
router.get('/', protect, getUsers)

export default router
