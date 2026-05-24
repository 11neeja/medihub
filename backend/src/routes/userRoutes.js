import express from 'express'
import { registerUser, loginUser, getUsers, getMe } from '../controllers/userController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/me', protect, getMe)
router.get('/', protect, getUsers)

export default router
