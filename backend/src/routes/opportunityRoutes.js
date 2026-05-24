import express from 'express'
import {
  getOpportunities,
  createOpportunity,
  deleteOpportunity,
  applyToOpportunity,
  getMyApplications,
  getFilterOptions,
} from '../controllers/opportunityController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.get('/', protect, getOpportunities)
router.post('/', protect, createOpportunity)
router.get('/filters', protect, getFilterOptions)
router.get('/applications', protect, getMyApplications)
router.post('/:id/apply', protect, applyToOpportunity)
router.delete('/:id', protect, deleteOpportunity)

export default router
