import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 25 * 1024 * 1024, // 25MB limit
    files: 1 
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, WebM and MOV video files are allowed'));
    }
  }
}).single('video');

// Step 1: Handle video upload only
export const uploadVideo = async (req, res) => {
  try {
    // Handle upload
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      throw new Error('No video file uploaded');
    }

    console.log('✅ Video uploaded successfully:', req.file.filename);

    // Return only file info without analysis
    res.status(200).json({
      success: true,
      file: {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

  } catch (error) {
    console.error('❌ Upload Error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to upload video'
    });
  }
};

// Step 2: Analyze video based on prompt
export const analyzeVideo = async (req, res) => {
  try {
    const { filename, prompt } = req.body;

    if (!filename || !prompt) {
      throw new Error('Video filename and prompt are required');
    }

    const videoPath = path.join(__dirname, '../../uploads', filename);
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    console.log('🎥 Analyzing video:', filename);
    console.log('💭 Prompt:', prompt);

    // Convert video to base64
    const video = fs.readFileSync(videoPath);
    const base64Data = video.toString('base64');

    // Get file mime type
    const ext = path.extname(videoPath).toLowerCase();
    const mimeType = ext === '.mp4' ? 'video/mp4' 
                  : ext === '.webm' ? 'video/webm'
                  : 'video/quicktime';

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 16,
        topP: 0.8,
        maxOutputTokens: 1024,
      }
    });

    // Generate analysis
    const result = await model.generateContent([
      {
        inlineData: { 
          data: base64Data, 
          mimeType: mimeType 
        }
      },
      {
        text: prompt
      }
    ]);

    if (!result?.response) {
      throw new Error('No response from AI model');
    }

    const response = await result.response;
    console.log('✅ Analysis completed');

    res.status(200).json({
      success: true,
      analysis: {
        text: response.text(),
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze video'
    });
  }
};

// Step 3: Chat about the video
export const chatWithVideo = async (req, res) => {
  try {
    const { filename, question, chatHistory } = req.body;

    if (!filename || !question) {
      throw new Error('Video filename and question are required');
    }

    const videoPath = path.join(__dirname, '../../uploads', filename);
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    console.log('💬 Processing chat:', { filename, question });

    // Convert video to base64
    const video = fs.readFileSync(videoPath);
    const base64Data = video.toString('base64');

    // Initialize model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 16,
        topP: 0.8,
        maxOutputTokens: 1024,
      }
    });

    // Keep only recent chat history
    const recentHistory = (chatHistory || [])
      .filter(msg => msg.sender !== 'system')
      .slice(-5)
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: msg.text
      }));

    // Generate response
    const result = await model.generateContent([
      {
        inlineData: { 
          data: base64Data, 
          mimeType: 'video/mp4'
        }
      },
      {
        text: `${question}\n\nBased on the video content, provide a clear and direct answer.`
      }
    ]);

    if (!result?.response) {
      throw new Error('No response from AI model');
    }

    const response = await result.response;
    console.log('✅ Chat response generated');
    
    res.status(200).json({
      success: true,
      response: {
        text: response.text(),
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Chat Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat request'
    });
  }
};