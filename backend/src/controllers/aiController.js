import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from 'fs';
import path from 'path';

// Initialize Gemini API with proper error handling
let genAI;
let fileManager;
try {
  if (!process.env.GOOGLE_AI_KEY) {
    throw new Error('GOOGLE_AI_KEY is not configured');
  }
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  fileManager = new GoogleAIFileManager(process.env.GOOGLE_AI_KEY);
} catch (error) {
  console.error('Failed to initialize Gemini API:', error);
}

export const analyzeVideoContent = async (req, res) => {
  try {
    // Check if API is initialized
    if (!genAI || !fileManager) {
      throw new Error('Gemini API not properly initialized');
    }

    const { videoPath } = req.body;
    if (!videoPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'Video path is required' 
      });
    }

    console.log('Starting video analysis for:', videoPath);

    // Check if file exists and is readable
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({
        success: false,
        error: 'Video file not found or not accessible'
      });
    }

    // Read file stats
    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'Video file is empty'
      });
    }

    // Get file mime type
    const ext = path.extname(videoPath).toLowerCase();
    const mimeType = ext === '.mp4' ? 'video/mp4' 
                  : ext === '.webm' ? 'video/webm'
                  : ext === '.mov' ? 'video/quicktime'
                  : ext === '.avi' ? 'video/x-msvideo'
                  : 'video/mp4'; // default to mp4

    console.log('File details:', {
      size: stats.size,
      mimeType,
      path: videoPath
    });

    // Read file as buffer
    const fileBuffer = fs.readFileSync(videoPath);
    
    try {
      // Upload video to Gemini API
      console.log('Uploading to Gemini...');
      const uploadResponse = await fileManager.uploadFile(fileBuffer, {
        mimeType: mimeType,
        displayName: path.basename(videoPath)
      });

      if (!uploadResponse || !uploadResponse.file) {
        throw new Error('Failed to get upload response from Gemini');
      }

      console.log('Upload successful:', uploadResponse.file.name);

      // Wait for video processing
      console.log('Waiting for processing...');
      let file = await fileManager.getFile(uploadResponse.file.name);
      let attempts = 0;
      const maxAttempts = 30; // 1 minute max wait time

      while (file.state === 'PROCESSING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await fileManager.getFile(uploadResponse.file.name);
        attempts++;
        console.log(`Processing attempt ${attempts}, state: ${file.state}`);
      }

      if (file.state !== 'ACTIVE') {
        throw new Error(`Video processing failed - State: ${file.state}`);
      }

      // Get model and analyze video
      console.log('Starting content generation...');
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        generationConfig: {
          temperature: 0.7,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
        },
      });
      
      const prompt = `Analyze this video and provide:
      1. A brief summary of what the video shows (2-3 sentences)
      2. Main topics or subjects covered (bullet points)
      3. Key moments with timestamps in MM:SS format (chronological order)
      4. Any technical concepts or important details mentioned
      5. Notable visual elements or scenes described

      Format the response in a clear, structured way with headings.
      Be specific and detailed but concise.`;

      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri
          }
        },
        { text: prompt }
      ]);

      if (!result || !result.response) {
        throw new Error('No response from Gemini API');
      }

      const analysis = await result.response.text();
      console.log('Analysis completed successfully');

      // Clean up the uploaded file
      try {
        await fileManager.deleteFile(file.name);
        console.log('Cleaned up uploaded file');
      } catch (cleanupError) {
        console.warn('Failed to clean up file:', cleanupError);
      }

      return res.status(200).json({
        success: true,
        analysis: {
          text: analysis,
          videoUri: file.uri,
          timestamp: new Date(),
          type: 'initial-analysis'
        }
      });

    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Gemini API Error: ${error.message}`);
    }

  } catch (error) {
    console.error('Analysis Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Video analysis failed'
    });
  }
};

export const generateResponse = async (req, res) => {
  try {
    if (!genAI) {
      throw new Error('Gemini API not properly initialized');
    }

    const { question, videoUri, chatHistory } = req.body;

    if (!videoUri) {
      return res.status(400).json({
        success: false,
        error: 'Video URI is required'
      });
    }

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    console.log('Generating response for:', {
      question,
      videoUri: videoUri.substring(0, 50) + '...' // Log partial URI for privacy
    });

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.7,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      },
    });

    // Format chat history
    const formattedHistory = chatHistory?.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: msg.text
    })) || [];

    try {
      const prompt = `Based on the video content, answer this question: ${question}

      Consider:
      - If a timestamp (MM:SS) is mentioned, focus on that specific moment
      - For technical questions, provide clear, detailed explanations
      - For visual questions, describe what is shown in detail
      - For summaries, focus on key points and maintain context
      
      Previous conversation:
      ${formattedHistory.map(msg => `${msg.role}: ${msg.parts}`).join('\n')}

      Provide a clear, direct answer that specifically addresses the question.`;

      const result = await model.generateContent([
        {
          fileData: {
            fileUri: videoUri,
            mimeType: 'video/mp4'
          }
        },
        { text: prompt }
      ]);

      if (!result || !result.response) {
        throw new Error('No response from Gemini API');
      }

      const response = await result.response.text();
      console.log('Response generated successfully');

      return res.status(200).json({
        success: true,
        response: {
          text: response,
          timestamp: new Date(),
          type: 'chat-response'
        }
      });

    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Gemini API Error: ${error.message}`);
    }

  } catch (error) {
    console.error('Response Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate response'
    });
  }
}; 