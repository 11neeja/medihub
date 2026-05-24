import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getCommunities,
  createCommunity,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  getMembers,
  addMembers,
  removeMember,
  getThreads,
  createThread,
  voteThread,
  togglePinThread,
  getReplies,
  createReply,
  getResources,
  uploadResource,
  downloadResource,
  resourceUpload,
} from '../controllers/groupController.js';

const router = express.Router();

// Communities
router.get('/', protect, getCommunities);
router.post('/', protect, createCommunity);
router.put('/:id', protect, updateCommunity);
router.post('/:id/join', protect, joinCommunity);
router.delete('/:id/leave', protect, leaveCommunity);
router.get('/:id/members', protect, getMembers);
router.post('/:id/members', protect, addMembers);
router.delete('/:id/members/:userId', protect, removeMember);

// Threads
router.get('/:id/threads', protect, getThreads);
router.post('/:id/threads', protect, createThread);
router.put('/threads/:threadId/vote', protect, voteThread);
router.put('/threads/:threadId/pin', protect, togglePinThread);

// Replies
router.get('/threads/:threadId/replies', protect, getReplies);
router.post('/threads/:threadId/replies', protect, createReply);

// Resources
router.get('/:id/resources', protect, getResources);
router.post('/:id/resources', protect, resourceUpload.single('file'), uploadResource);
router.put('/resources/:resourceId/download', protect, downloadResource);

export default router;
