import express from 'express'
import { getTasks, createTask, toggleTask, deleteTask } from '../controllers/taskController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.get('/', protect, getTasks)
router.post('/', protect, createTask)
router.put('/:id/toggle', protect, toggleTask)
router.delete('/:id', protect, deleteTask)

export default router
