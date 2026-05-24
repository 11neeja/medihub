import express from 'express'
import {
  getDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
} from '../controllers/documentController.js'
import { protect } from '../middleware/auth.js'
import { createUpload } from '../utils/upload.js'

const router = express.Router()
const upload = createUpload('doc')

router.get('/', protect, getDocuments)
router.post('/', protect, upload.single('file'), uploadDocument)
router.get('/:id/download', protect, downloadDocument)
router.delete('/:id', protect, deleteDocument)

export default router
