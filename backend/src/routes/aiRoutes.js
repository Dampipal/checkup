import express from 'express';
import { analyzeVideoContent, generateResponse } from '../controllers/aiController.js';

const router = express.Router();

router.post('/analyze', analyzeVideoContent);
router.post('/chat', generateResponse);

export default router; 