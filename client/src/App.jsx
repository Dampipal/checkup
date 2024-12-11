import { useState, useEffect, useRef } from 'react'

const BACKEND_URL = 'http://localhost:5000'

// Example prompts for video analysis
const EXAMPLE_PROMPTS = [
  "Describe what's happening in this video",
  "What are the main objects or people shown?",
  "What's the overall mood or tone?",
  "Are there any text or captions visible?",
  "What actions or movements do you see?"
]

function App() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('') // New state for upload status
  const chatContainerRef = useRef(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  const handleVideoUpload = async (file) => {
    try {
      console.log('🎥 Starting video upload:', {
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + 'MB',
        fileType: file.type
      });

      // Validate file type
      if (!file.type.startsWith('video/')) {
        throw new Error('Please select a valid video file');
      }

      setUploadStatus('Uploading video...')
      setUploadProgress(0)
      setIsAnalyzing(true)

      const formData = new FormData()
      formData.append('video', file)

      console.log('📤 Sending request to server...');
      const response = await fetch(`${BACKEND_URL}/api/video/upload`, {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100
          setUploadProgress(Math.round(progress))
          console.log(`📊 Upload progress: ${Math.round(progress)}%`);
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Upload failed:', errorData);
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      console.log('✅ Upload successful:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      setSelectedVideo(URL.createObjectURL(file))
      setMessages([
        {
          text: "✨ Video uploaded successfully!",
          sender: 'system',
          timestamp: new Date().toISOString()
        },
        {
          text: data.file.analysis.text,
          sender: 'ai',
          timestamp: new Date().toISOString()
        }
      ])

    } catch (error) {
      console.error('❌ Error during upload:', error);
      setMessages([{
        text: `❌ ${error.message}`,
        sender: 'system',
        timestamp: new Date().toISOString()
      }])
      setSelectedVideo(null)
    } finally {
      setIsAnalyzing(false)
      setUploadProgress(0)
      setUploadStatus('')
      console.log('🏁 Upload process completed');
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) handleVideoUpload(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('video/')) {
      handleVideoUpload(file)
    }
  }

  const handleExamplePrompt = (prompt) => {
    setNewMessage(prompt)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (newMessage.trim() && selectedVideo && !isAnalyzing) {
      console.log('💬 Sending message:', newMessage);
      
      const userMessage = {
        text: newMessage,
        sender: 'user',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, userMessage])
      setNewMessage('')
      setIsAnalyzing(true)

      try {
        console.log('📤 Sending chat request to server...');
        const response = await fetch(`${BACKEND_URL}/api/video/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoUri: selectedVideo,
            question: userMessage.text,
            chatHistory: messages
          })
        })

        if (!response.ok) {
          console.error('❌ Chat request failed:', response.status, response.statusText);
          throw new Error('Failed to get response')
        }

        const data = await response.json()
        console.log('✅ Received AI response:', data);
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to get response')
        }

        setMessages(prev => [...prev, {
          text: data.response.text,
          sender: 'ai',
          timestamp: new Date().toISOString()
        }])

      } catch (error) {
        console.error('❌ Chat Error:', error);
        setMessages(prev => [...prev, {
          text: `❌ Error: ${error.message}`,
          sender: 'system',
          timestamp: new Date().toISOString()
        }])
      } finally {
        setIsAnalyzing(false)
        console.log('🏁 Chat request completed');
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#343541]">
      <div className="flex h-screen">
        {/* Video Section - Left Side */}
        <div className="w-1/2 p-4 border-r border-gray-600 bg-[#202123]">
          <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4">Video Analysis</h2>
            
            {/* Video Upload/Display Area */}
            <div 
              className={`flex-1 bg-[#2A2B32] rounded-lg overflow-hidden relative ${
                isDragging ? 'border-2 border-purple-500' : 'border border-gray-600'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedVideo ? (
                <video 
                  className="w-full h-full object-contain bg-black"
                  src={selectedVideo}
                  controls
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-lg mb-2">Drag & drop your video here</p>
                  <p className="text-gray-400 mb-4">or</p>
                  <label className="cursor-pointer">
                    <span className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl">
                      Choose Video File
                    </span>
                    <input 
                      type="file" 
                      accept="video/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <p className="text-gray-500 text-sm mt-4">Supports MP4, WebM, MOV, AVI and other formats</p>
                </div>
              )}

              {/* Upload Progress */}
              {(uploadProgress > 0 || uploadStatus) && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4">
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                  <p className="text-center text-sm">
                    {uploadStatus || `${uploadProgress}% Uploaded`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Section - Right Side */}
        <div className="w-1/2 flex flex-col bg-[#343541]">
          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message, index) => (
              <div 
                key={index}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} ${
                  message.sender === 'system' ? 'justify-center' : ''
                }`}
              >
                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.sender === 'user'
                    ? 'bg-purple-500 text-white'
                    : message.sender === 'ai'
                    ? 'bg-[#444654] text-gray-100'
                    : 'bg-[#2A2B32] text-gray-300 text-center'
                }`}>
                  {message.sender === 'ai' && (
                    <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                      </svg>
                      AI Assistant
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans text-sm">{message.text}</pre>
                  <div className="text-xs opacity-50 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isAnalyzing && (
              <div className="flex justify-center">
                <div className="bg-[#444654] rounded-lg px-6 py-3 text-white">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <div>Processing your request...</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Example Prompts */}
          {selectedVideo && !isAnalyzing && messages.length < 3 && (
            <div className="px-4 py-3 bg-[#2A2B32]">
              <p className="text-gray-400 text-sm mb-2">Try asking about:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleExamplePrompt(prompt)}
                    className="text-sm px-3 py-1 rounded-full bg-[#444654] text-gray-300 hover:bg-[#40414F] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="p-4 border-t border-gray-600 bg-[#343541]">
            <form onSubmit={handleSendMessage} className="flex space-x-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={selectedVideo ? "Ask anything about the video..." : "Upload a video to start the conversation"}
                className="flex-1 bg-[#40414F] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={!selectedVideo || isAnalyzing}
              />
              <button
                type="submit"
                disabled={!selectedVideo || isAnalyzing || !newMessage.trim()}
                className={`px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium 
                  ${(!selectedVideo || isAnalyzing || !newMessage.trim()) 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:from-purple-600 hover:to-pink-600'} 
                  transition-all duration-200`}
              >
                {isAnalyzing ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Send'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
