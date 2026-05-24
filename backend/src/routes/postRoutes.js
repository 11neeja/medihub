import express from 'express'
import {
  getPosts, createPost, toggleLike, deletePost,
  addComment, deleteComment, repost, toggleBookmark,
  postImageUpload,
} from '../controllers/postController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.get('/', protect, getPosts)
router.post('/', protect, postImageUpload.single('image'), createPost)
router.put('/:id/like', protect, toggleLike)
router.put('/:id/bookmark', protect, toggleBookmark)
router.post('/:id/comments', protect, addComment)
router.delete('/:postId/comments/:commentId', protect, deleteComment)
router.post('/:id/repost', protect, repost)
router.delete('/:id', protect, deletePost)

export default router
