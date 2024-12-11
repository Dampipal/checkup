import express from 'express';
import { uploadVideo, analyzeVideo, chatWithVideo } from '../controllers/videoController.js';

const router = express.Router();

// Step 1: Handle initial video upload
router.post('/upload', uploadVideo);

// Step 2: Analyze uploaded video with prompt
router.post('/analyze', analyzeVideo);

// Step 3: Chat about the analyzed video
router.post('/chat', chatWithVideo);

export default router; 