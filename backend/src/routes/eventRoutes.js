import express from 'express'
import { getEvents, createEvent, toggleRegistration, deleteEvent, getEventbriteEvents, refreshEventbriteCache, getExternalEvents, refreshExternalEvents } from '../controllers/eventController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// External-source routes (specific routes BEFORE parameterized ones)
router.get('/external', protect, getExternalEvents)
router.post('/external/refresh', protect, refreshExternalEvents)

// Eventbrite routes (kept for backward compatibility)
router.get('/eventbrite', protect, getEventbriteEvents)
router.post('/eventbrite/refresh', protect, refreshEventbriteCache)

router.get('/', protect, getEvents)
router.post('/', protect, createEvent)
router.put('/:id/register', protect, toggleRegistration)
router.delete('/:id', protect, deleteEvent)

export default router
