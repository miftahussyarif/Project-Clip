# ClipGenius - AI-Powered Video Clipping SaaS

Transform your YouTube videos into viral short-form clips with AI-powered analysis, smart framing, and auto-captions.

![ClipGenius](https://img.shields.io/badge/ClipGenius-AI%20Video%20Clipping-6366f1?style=for-the-badge)

## ✨ Features

- **🧠 AI-Powered Analysis**: Gemini AI analyzes video transcripts to find viral-worthy moments
- **📐 Smart Cropping**: Automatically converts landscape (16:9) to portrait (9:16) with intelligent subject tracking
- **💬 Auto Captions**: Stylish, animated captions synchronized with your video
- **🎯 Viral Score**: Each clip gets a viral potential score (1-10)
- **⚡ Fast Processing**: Efficient FFmpeg pipeline
- **📱 Platform Ready**: Export as 1080x1920 MP4 for TikTok, YouTube Shorts, Instagram Reels

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: TailwindCSS with custom dark theme
- **AI**: Google Gemini Pro API
- **Video Download**: yt-dlp
- **Video Processing**: FFmpeg
- **State Management**: Zustand

## 📋 Prerequisites

Before running this application, make sure you have:

1. **Node.js** (v18 or higher)
2. **yt-dlp** - YouTube video downloader
   ```bash
   # Ubuntu/Debian
   sudo apt install yt-dlp
   
   # macOS
   brew install yt-dlp
   
   # pip
   pip install yt-dlp
   ```

3. **FFmpeg** - Video processing
   ```bash
   # Ubuntu/Debian
   sudo apt install ffmpeg
   
   # macOS
   brew install ffmpeg
   ```

4. **Gemini API Key** - Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   cd Project-Clip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Edit .env.local and add your Gemini API key
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 How It Works

1. **Paste YouTube URL**: Enter any YouTube video link
2. **AI Analysis**: Gemini analyzes the transcript to find engaging moments
3. **Select Clips**: Review AI recommendations with viral scores
4. **Process**: Download, cut, frame, and add captions automatically
5. **Download**: Get your portrait-formatted clips ready to upload

## 📁 Project Structure

```
Project-Clip/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── dashboard/            # Main dashboard
│   │   └── api/                  # API routes
│   ├── lib/
│   │   ├── youtube/              # YouTube integration
│   │   ├── gemini/               # AI analysis
│   │   ├── video/                # Video processing
│   │   └── utils/                # Helpers
│   ├── types/                    # TypeScript types
│   └── store/                    # Zustand store
├── temp/                         # Temporary video files
├── output/                       # Processed clips
└── public/                       # Static assets
```

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/youtube/info` | POST | Get video metadata |
| `/api/youtube/transcript` | POST | Get video transcript |
| `/api/analyze` | POST | AI analysis for clip recommendations |
| `/api/process` | POST | Process and generate clips |
| `/api/clips` | GET | List processed clips |
| `/api/clips/[filename]` | GET | Download a clip |

## ⚙️ Configuration

### Caption Styling

Captions are styled with:
- Font: Arial Bold
- Size: 28px
- Color: White with black outline
- Position: Center-bottom
- Margin: 60px from bottom

### Video Output

- Resolution: 1080x1920 (Portrait)
- Format: MP4 (H.264 + AAC)
- Frame Rate: 30fps
- Quality: CRF 23

## 📝 License

MIT License - feel free to use for personal and commercial projects.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube downloading
- [FFmpeg](https://ffmpeg.org/) for video processing
