import express from 'express'
import { getNews, refreshNewsCache, getTrendingTopics } from '../controllers/newsController.js'

const router = express.Router()

// GET  /api/news              — list articles (query: specialty, search, sort)
router.get('/', getNews)

// POST /api/news/refresh      — force 24hr cache refresh
router.post('/refresh', refreshNewsCache)

// GET  /api/news/trending     — top trending topic names
router.get('/trending', getTrendingTopics)

export default router
