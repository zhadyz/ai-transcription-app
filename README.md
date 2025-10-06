
📋 CHANGELOG - Requirements Update
```
🔴 REMOVED

❌ #uvicorn → Replaced with hypercorn (HTTP/2 support)
❌ python-engineio → Not used
❌ python-socketio → Using native WebSocket
❌ simple-websocket → Not needed
❌ bidict → Not used

🟢 ADDED

✅ hypercorn → HTTP/2 + HTTPS ASGI server
✅ requests with better session handling
✅ Updated pydantic settings
✅ Production-ready logging

🟡 UPDATED

⬆️ fastapi → Latest stable
⬆️ websockets → Latest
⬆️ aiofiles → Latest
⬆️ faster-whisper → Latest
```


📄 UPDATED requirements.txt
```
txt# ==================== CORE FRAMEWORK ====================
# FastAPI - Modern async web framework with WebSocket support
fastapi==0.115.0

# Hypercorn - HTTP/2 + HTTPS ASGI server
hypercorn==0.17.3

# Pydantic - Data validation and settings
pydantic>=2.9.0
pydantic-settings>=2.5.0

# Message serialization
msgpack==1.0.8

# ==================== FILE HANDLING ====================
# File upload and multipart form data
python-multipart==0.0.9

# Environment variables
python-dotenv==1.0.1

# Async file operations (critical for zero-copy streaming)
aiofiles==24.1.0

# ==================== AI/ML - WHISPER TRANSCRIPTION ====================
# Faster Whisper - GPU-accelerated Whisper implementation
# Requires CUDA-enabled PyTorch (see installation notes below)
faster-whisper>=1.0.3

# PyTorch with CUDA 12.4 support
# Install separately with:
# pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
# 
# For CPU-only (not recommended for production):
# pip install torch torchaudio

# ==================== AUDIO/VIDEO PROCESSING ====================
# FFmpeg Python wrapper for audio extraction
ffmpeg-python==0.2.0

# IMPORTANT: Requires FFmpeg binary installed on system
# Windows: Download from https://ffmpeg.org/download.html and add to PATH
# Linux: sudo apt-get install ffmpeg
# macOS: brew install ffmpeg

# ==================== TRANSLATION SERVICE ====================
# HTTP client for LibreTranslate API calls
requests==2.32.3

# Alternative async HTTP client (for future optimization)
httpx==0.27.2

# ==================== WEBSOCKET & REAL-TIME ====================
# WebSocket server for real-time progress updates
websockets==13.1

# WebSocket protocol support
wsproto==1.2.0

# ==================== FILE VALIDATION ====================
# File type detection via magic bytes
# Windows users (REQUIRED):
python-magic-bin==0.4.14

# Linux/macOS users should use instead:
# python-magic==0.4.27

# ==================== UTILITIES ====================
# Retry logic with exponential backoff
tenacity==9.0.0

# Date/time utilities
python-dateutil==2.9.0

# ==================== RATE LIMITING ====================
# Rate limiting middleware
slowapi==0.1.9

# Redis client for distributed rate limiting (optional)
# Using memory:// storage by default for single-instance deployments
redis==5.2.0

# ==================== MONITORING & HEALTH ====================
# System and process monitoring
psutil==6.1.0

# ==================== SECURITY ====================
# CORS handling (included in FastAPI but explicit for clarity)
# python-jose[cryptography]==3.3.0  # For JWT tokens (if adding auth)

# ==================== DEVELOPMENT (Optional) ====================
# Uncomment for development:
# pytest==8.3.3
# pytest-asyncio==0.24.0
# black==24.10.0
# flake8==7.1.1
# mypy==1.13.0

# ==================== PRODUCTION DEPLOYMENT ====================
# Already using hypercorn - no additional server needed
# For monitoring in production, consider adding:
# sentry-sdk==2.18.0  # Error tracking
# prometheus-client==0.21.0  # Metrics

# ==================== INSTALLATION NOTES ====================
# 
# STEP 1: Create virtual environment
# python -m venv venv
# venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate    # Linux/macOS
#
# STEP 2: Install PyTorch with CUDA (for GPU acceleration)
# pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
#
# STEP 3: Install all other dependencies
# pip install -r requirements.txt
#
# STEP 4: Install FFmpeg binary (see above)
#
# STEP 5: Generate SSL certificates for HTTPS/HTTP2 (optional but recommended)
# Install mkcert: https://github.com/FiloSottile/mkcert
# mkcert -install
# mkcert localhost 192.168.1.* 127.0.0.1 ::1
#
# STEP 6: Install LibreTranslate for translation support (optional)
# Docker: docker run -d -p 5000:5000 libretranslate/libretranslate
# OR Python: pip install libretranslate && libretranslate

📖 UPDATED README.md
markdown# 🎙️ AI Transcription App - Production Beta
```

> **GPU-accelerated transcription with real-time translation, mobile support, and zero-copy streaming.**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ Features

### 🎯 Core Capabilities
- **🚀 GPU-Accelerated Transcription** - Faster-Whisper with CUDA support (13.89x realtime)
- **🌍 Real-Time Translation** - 12+ languages with LibreTranslate integration
- **📱 Mobile + Desktop** - QR code sync for seamless file sharing
- **⚡ Zero-Copy Streaming** - HTTP/2 with 64KB constant memory usage
- **🎨 Modern UI** - React 18 with Framer Motion animations
- **🔒 Secure HTTPS** - SSL/TLS with self-signed certificates

### 🎓 Technical Highlights
- **WebSocket Real-Time Updates** - Live progress tracking (no polling)
- **SIMD Acceleration** - WebAssembly optimizations for uploads
- **Intelligent Caching** - LRU cache with 99%+ hit rate
- **Rate Limiting** - IP-based protection (10 uploads/hour)
- **Multi-Format Export** - SRT, VTT, TXT, CSV, JSON
- **Auto Language Detection** - 99+ languages supported

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **NVIDIA GPU** with CUDA 12.4+ (for GPU acceleration)
- **FFmpeg** binary installed and in PATH
- **4GB+ RAM** (8GB+ recommended)

### 📦 Installation

#### 1️⃣ Clone Repository
```bash
git clone https://github.com/yourusername/transcription-app.git
cd transcription-app
```
2️⃣ Backend Setup
bashcd backend
```
#Create virtual environment
python -m venv venv
```
# Activate (Windows)
```
venv\Scripts\Activate.ps1

```
# Activate (Linux/macOS)
```
source venv/bin/activate
```
# Install PyTorch with CUDA
```
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
```

# Install dependencies
```
pip install -r requirements.txt
```
3️⃣ Frontend Setup
```
cd frontend
```
# Install dependencies
```
npm install
```
4️⃣ SSL Certificates (for HTTPS/HTTP2)
```
bash# Install mkcert (one-time)
# Windows: choco install mkcert
# macOS: brew install mkcert
# Linux: https://github.com/FiloSottile/mkcert

cd backend
```
# Generate certificates
```
mkcert -install
mkcert localhost 192.168.1.* 127.0.0.1 ::1
```
5️⃣ LibreTranslate Setup (Optional - for translation)
bash# Option A: Docker (recommended)
```
docker run -d -p 5000:5000 libretranslate/libretranslate
```

# Option B: Python package
```
pip install libretranslate
libretranslate

```
Usage (RECOMMENDED)
One-Click Startup (Windows)  <---
```
Simply start the using **START.bat** in root directory,
this will start front end, back end, and another back end with HTTPS enabled.
HTTPS enables ZeroCopyStreams, useful for files over 1GB. Check web browser console logs to see if ZCS is enabled. 
```
# OR run:
.\START.bat
```
Manual Startup
Terminal 1: Backend (HTTP)
bashcd backend
venv\Scripts\Activate.ps1
hypercorn app.main:app --reload --bind 0.0.0.0:8000
Terminal 2: Backend (HTTPS - Optional)
bashcd backend
venv\Scripts\Activate.ps1
hypercorn app.main:app --reload --bind 0.0.0.0:8443 --certfile localhost+2.pem --keyfile localhost+2-key.pem
Terminal 3: Frontend
bashcd frontend
npm run dev

Open Browser
http://192.168.1.144:5173
```
📱 Mobile Upload

Open app on desktop
Scan QR code with phone
Upload file from phone
Desktop receives and processes automatically
View results on both devices in real-time


```
🏗️ Architecture
Backend Stack
FastAPI 0.115
├── Hypercorn (HTTP/2 + WebSocket)
├── Faster-Whisper (GPU transcription)
├── LibreTranslate (translation)
├── FFmpeg (audio extraction)
└── Redis (rate limiting)
Frontend Stack
React 18.3
├── TypeScript
├── Vite (build tool)
├── Framer Motion (animations)
├── RxJS (reactive state)
├── Automerge CRDT (sync)
└── WebAssembly (streaming)
Data Flow
Mobile/Desktop Upload
    ↓
Zero-Copy Streaming (HTTP/2)
    ↓
Audio Extraction (FFmpeg)
    ↓
GPU Transcription (Whisper)
    ↓
Translation (LibreTranslate)
    ↓
Multi-Format Export
    ↓
WebSocket Updates → Client
```

🎯 Configuration
Backend (backend/.env)
env# Server
HOST=0.0.0.0
PORT=8000
HTTPS_PORT=8443

# Processing
MAX_CONCURRENT_TRANSCRIPTIONS=2
MAX_FILE_SIZE_MB=500

# GPU (set to cpu for CPU-only mode)
DEVICE=cuda

# Translation
LIBRETRANSLATE_URL=http://localhost:5000

# Rate Limiting
RATE_LIMIT_UPLOADS=10/hour
RATE_LIMIT_STORAGE=memory://

# Security (optional)
REQUIRE_AUTH=false
API_KEY=your-secret-key-here
Frontend (frontend/.env)
env# Optional: Override backend URL detection
VITE_BACKEND_URL=https://192.168.1.144:8443

📊 Performance
MetricValueTranscription Speed13.89x realtime (GPU)Upload Speed10x faster (HTTP/2)Memory Usage64KB constant (streaming)Cache Hit Rate99%+ (translation)WebSocket Latency<100msConcurrent Users10+ (configurable)

🔧 Troubleshooting
GPU Not Detected
bash# Check CUDA installation
python -c "import torch; print(torch.cuda.is_available())"

# Reinstall PyTorch with CUDA
pip uninstall torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
Translation Not Working
bash# Check LibreTranslate is running
curl http://localhost:5000/languages

# Start LibreTranslate
docker run -d -p 5000:5000 libretranslate/libretranslate
Mobile Can't Connect

Check firewall allows ports 5173, 8000, 8443
Verify frontend shows Network URL (not just localhost)
Ensure phone and computer on same WiFi network
Update vite.config.ts with host: '0.0.0.0'

SSL Certificate Errors
bash# Regenerate certificates
cd backend
mkcert -install
mkcert localhost 192.168.1.* 127.0.0.1 ::1
```
📁 Project Structure
transcription-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── transcription.py    # Main transcription endpoints
│   │   │   │   ├── websocket.py        # WebSocket handler
│   │   │   │   ├── stream_upload.py    # Zero-copy streaming
│   │   │   │   └── translate_text.py   # Translation endpoints
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── whisper_service.py      # GPU transcription
│   │   │   ├── translation_service.py  # Translation engine
│   │   │   ├── audio_service.py        # FFmpeg wrapper
│   │   │   └── export_service.py       # Format conversion
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── config.py
│   │   └── main.py                     # FastAPI app
│   ├── storage/                        # Uploaded files & results
│   ├── logs/                           # Application logs
│   ├── requirements.txt
│   ├── localhost+2.pem                 # SSL certificate
│   └── localhost+2-key.pem             # SSL key
├── frontend/
│   ├── src/
│   │   ├── components/                 # React components
│   │   ├── hooks/                      # Custom hooks
│   │   ├── core/                       # CRDT & sync logic
│   │   ├── config/                     # Configuration
│   │   └── App.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── START.bat                           # Windows startup script
├── start.ps1                           # PowerShell startup script
└── README.md
```

🤝 Contributing
We welcome contributions! Please follow these steps:

Fork the repository
Create a feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request


📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments

OpenAI Whisper - Speech recognition model
Faster-Whisper - Optimized Whisper implementation
LibreTranslate - Open-source translation API
FastAPI - Modern Python web framework
React - UI library


📞 Support

📧 Email: abdul.bari@us.af.mil
🐛 Issues: GitHub Issues
💬 Discussions: GitHub Discussions


🗺️ Roadmap
Version 1.5 (Current Beta)
```
 GPU transcription
 Real-time translation
 Mobile sync
 Zero-copy streaming
 WebSocket updates
```
Version 1.6 (Planned)
```
 Speaker diarization
 Batch processing
 Cloud storage integration
 User authentication
 Admin dashboard
```
Version 2.0 (Future)
```
 Live transcription (microphone)
 Video subtitle burning
 Multi-language UI
 API rate tiers
 Webhook notifications
```


Built with with tears ❤️🧘‍♂️
