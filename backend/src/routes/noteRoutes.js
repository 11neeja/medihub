import express from 'express'
import { getNotes, createNote, updateNote, deleteNote, reorderNotes, getSubjects, createSubject, renameSubject, deleteSubject } from '../controllers/noteController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// Subject routes (must come before /:id)
router.get('/subjects', protect, getSubjects)
router.post('/subjects', protect, createSubject)
router.put('/subjects/:name', protect, renameSubject)
router.delete('/subjects/:name', protect, deleteSubject)

router.get('/', protect, getNotes)
router.post('/', protect, createNote)
router.put('/reorder', protect, reorderNotes)
router.put('/:id', protect, updateNote)
router.delete('/:id', protect, deleteNote)

export default router
