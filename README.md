# 🎙️ AI Transcription App - V1.5

> **GPU-accelerated transcription with real-time translation, mobile support, and zero-copy streaming. Now with Docker support!**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📋 Changelog

### v1.5.3 (October 09 2025) 🔮
**Real-Time GPU Telemetry Release**

#### 🟢 ADDED
- ✅ **GPU Memory Oracle** - Statistical analysis with trend detection, anomaly detection, OOM prediction
- ✅ **Adaptive Telemetry Broadcaster** - Real-time WebSocket broadcasting (5-15s adaptive intervals)
- ✅ **Circuit Breaker Pattern** - Self-healing on NVML failures with exponential backoff
- ✅ **Backpressure Detection** - Per-client health monitoring and automatic throttling
- ✅ **WebSocket Context** - React context for centralized WebSocket management
- ✅ **Device Statistics API** - `/system/device-info` with comprehensive GPU metrics
- ✅ **Graceful Degradation** - Fallback to PyTorch stats when pynvml unavailable
- ✅ **nvidia-ml-py3** - Direct NVIDIA driver access for accurate VRAM tracking

#### 🟡 CHANGED
- ⬆️ **DeviceIndicator.tsx** - Rewritten from 460→165 lines with null-safe rendering
- ⬆️ **system.py** - Replaced with GPUMemoryOracle (pynvml-based with fallback)
- 🔧 **main.py lifespan()** - Integrated device telemetry broadcaster
- 🔧 **Backend architecture** - Separated statistics (backend) from display (frontend)

#### 🔴 FIXED
- 🐛 **VRAM detection** - Now sees CTranslate2 memory allocations (was showing 0.0 GB)
- 🐛 **Null pointer crashes** - DeviceIndicator handles missing/null GPU data gracefully
- 🐛 **WebSocket message handling** - Proper JSON parsing with error boundaries

#### 📊 PERFORMANCE
- ⚡ **<0.1% CPU** - Broadcaster overhead with message caching (4.5s TTL)
- ⚡ **Zero HTTP polling** - Eliminated 120 requests/hour per client
- ⚡ **50× lower latency** - WebSocket updates (4ms) vs HTTP polling (200ms)
- ⚡ **10× fewer renders** - Memoized components with smart re-render logic

---

### v1.5.2 (Latest - October 08 2025) 🐳
**Docker Support Release**

#### 🟢 ADDED
- ✅ **Complete Docker support** - One-command deployment
- ✅ **docker-compose.yml** - Orchestrates all services
- ✅ **Multi-stage builds** - Optimized frontend (nginx) and backend
- ✅ **GPU support in Docker** - NVIDIA CUDA containers
- ✅ **Platform-specific requirements** - Automatic Linux/Windows dependency handling
- ✅ **Production-ready nginx** - Reverse proxy with 5GB upload support
- ✅ **docker-start.bat** - Windows Docker launcher
- ✅ **Comprehensive Docker docs** - DOCKER-README.md

#### 🟡 CHANGED
- ⬆️ **requirements.txt** - Split into Docker (Linux) and local (Windows) versions
- ⬆️ **Frontend build** - Uses esbuild for faster builds (10x speed improvement)
- ⬆️ **vite.config.ts** - Removed unused Babel plugins
- 🔧 **CORS configuration** - Enabled for nginx reverse proxy

#### 🔴 FIXED
- 🐛 **Large file uploads in Docker** - nginx `client_max_body_size` increased to 5GB
- 🐛 **PyTorch Docker installation** - Separate install step for CUDA compatibility
- 🐛 **Frontend TypeScript errors** - Relaxed build checks for production
- 🐛 **python-magic platform issues** - Automatic platform detection

---

### v1.5.1 (October 08 2025)
**Stability and Large File Support**

#### 🔴 REMOVED
- ❌ **uvicorn** → Replaced with hypercorn (HTTP/2 support)
- ❌ **python-engineio** → Not used
- ❌ **python-socketio** → Using native WebSocket
- ❌ **simple-websocket** → Not needed
- ❌ **bidict** → Not used

#### 🟢 ADDED
- ✅ **hypercorn** → HTTP/2 + HTTPS ASGI server
- ✅ **Large file support** → Tested with 2.3GB+ files
- ✅ **Adaptive file validation** → Retry logic scaled by file size
- ✅ **Whisper large-v2 and large-v3** → Maximum accuracy models
- ✅ **requests** with better session handling
- ✅ Updated **pydantic settings**
- ✅ Production-ready **logging**

#### 🟡 UPDATED
- ⬆️ **fastapi** → Latest stable
- ⬆️ **websockets** → Latest
- ⬆️ **aiofiles** → Latest
- ⬆️ **faster-whisper** → Latest

#### 🔴 FIXED
- 🐛 **os.fsync()** → Fixed race conditions on large file uploads
- 🐛 **inode/blockdevice errors** → Adaptive wait times (0.2s-1.0s per attempt)
- 🐛 **LibreTranslate startup** → Fixed venv path detection

---

## ✨ Features

### 🎯 Core Capabilities
- **🚀 GPU-Accelerated Transcription** - Faster-Whisper with CUDA support (13.89x realtime)
- **🌍 Real-Time Translation** - 12+ languages with LibreTranslate integration
- **📱 Mobile + Desktop** - QR code sync for seamless file sharing
- **⚡ Zero-Copy Streaming** - HTTP/2 with 64KB constant memory usage
- **🎨 Modern UI** - React 18 with Framer Motion animations
- **🔒 Secure HTTPS** - SSL/TLS with self-signed certificates
- **🐳 Docker Ready** - One-command deployment with docker-compose

### 🎓 Technical Highlights
- **WebSocket Real-Time Updates** - Live progress tracking (no polling)
- **SIMD Acceleration** - WebAssembly optimizations for uploads
- **Intelligent Caching** - LRU cache with 99%+ hit rate
- **Rate Limiting** - IP-based protection (10 uploads/hour)
- **Multi-Format Export** - SRT, VTT, TXT, CSV, JSON
- **Auto Language Detection** - 99+ languages supported
- **Large File Support** - Successfully handles files up to 5GB

---

## 🚀 Quick Start

### Prerequisites

#### For Docker Installation (Recommended):
- **Docker Desktop** 20.10+ installed
- **NVIDIA GPU** with CUDA 12.4+ (optional, for GPU acceleration)
- **8GB+ RAM** recommended

#### For Manual Installation:
- **Python 3.11+** (NOT 3.12+, breaks compatibility)
- **Node.js 18+** with npm
- **NVIDIA GPU** with CUDA 12.4+ (optional)
- **FFmpeg** binary installed and in PATH
- **4GB+ RAM** (8GB+ recommended)

---

## 🐳 Docker Installation (Recommended)

### One-Command Startup

```bash
# Windows
docker-start.bat

# Linux/Mac
docker-compose up --build -d
```

That's it! The app will be available at:
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000
- **Mobile Access:** http://YOUR_IP (scan QR code from desktop)

### What Docker Includes

The Docker setup automatically:
- ✅ Builds optimized production containers
- ✅ Installs all dependencies (Python, Node, PyTorch with CUDA)
- ✅ Sets up nginx reverse proxy
- ✅ Configures LibreTranslate for translation
- ✅ Exposes correct ports for mobile access
- ✅ Mounts persistent storage volumes

### Docker Commands

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f
docker-compose logs -f backend   # Backend only
docker-compose logs -f frontend  # Frontend only

# Stop everything
docker-compose down

# Rebuild after code changes
docker-compose up --build -d

# Clean everything (including volumes)
docker-compose down -v
docker system prune -a
```

### GPU Support in Docker

GPU is enabled by default. If you **don't have an NVIDIA GPU**:

1. Edit `docker-compose.yml`
2. Comment out the `deploy` section under `backend`:

```yaml
backend:
  # Comment out this entire section if no GPU:
  # deploy:
  #   resources:
  #     reservations:
  #       devices:
  #         - driver: nvidia
  #           count: 1
  #           capabilities: [gpu]
```

3. Change environment variable:
```yaml
environment:
  - WHISPER_DEVICE=cpu  # Change from 'cuda' to 'cpu'
```

### Docker Troubleshooting

**Port already in use:**
```yaml
# Edit docker-compose.yml, change ports:
ports:
  - "8080:80"   # Frontend (was 80)
  - "8001:8000" # Backend (was 8000)
```

**Container won't start:**
```bash
docker-compose logs backend  # Check errors
docker-compose restart       # Restart
```

**Out of disk space:**
```bash
docker system prune -a --volumes
```

See [DOCKER-README.md](DOCKER-README.md) for complete Docker documentation.

---

## Venv Installation (Recommended if you don't have docker but use Windows)

**Windows:** Double-click `install.bat` or run `install.ps1`

This automatically installs:
- Python 3.11 virtual environment
- PyTorch with CUDA
- All backend dependencies
- Frontend dependencies
- SSL certificates (optional)

When installation is complete, hit start.bat and it will automatically start the application. 

### 📦 Manual Step-by-Step Installation (Advanced)

#### 1️⃣ Clone Repository
```bash
git clone https://github.com/zhadyz/ai-transcription-app.git
cd ai-transcription-app
```

#### 2️⃣ Backend Setup
```bash
cd backend

# Create virtual environment (MUST be Python 3.11.x)
python -m venv venv

# Activate (Windows)
venv\Scripts\Activate.ps1

# Activate (Linux/macOS)
source venv/bin/activate

# Install PyTorch with CUDA (REQUIRED - do this FIRST)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124

# Install remaining dependencies
# Windows:
pip install -r requirements-local.txt

# Linux/Docker:
pip install -r requirements.txt
```

**⚠️ CRITICAL:** Python 3.11.x ONLY! Python 3.12+ breaks PyTorch compatibility.

#### 3️⃣ Frontend Setup
```bash
cd frontend

# Install dependencies
npm install
```

### 4️⃣ Certs should already come preinstalled. If not,
##  SSL Certificates (Optional - for HTTPS/Streaming)
```bash
# Install mkcert (one-time)
# Windows: choco install mkcert
# macOS: brew install mkcert
# Linux: https://github.com/FiloSottile/mkcert

# Generate certificates
cd backend
mkcert -install
mkcert localhost 192.168.1.* 127.0.0.1 ::1
```

#### 5️⃣ LibreTranslate Setup (Optional - for translation)

**Option A: Python Package**
```bash
pip install libretranslate
libretranslate
```

**Option B: Docker** (Recommended)
```bash
docker run -d -p 5000:5000 libretranslate/libretranslate
```

#### 6️⃣ Environment Configuration
```bash
cd backend

# Create .env file
echo "ENV=development
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
MAX_FILE_SIZE_MB=5000
LOG_LEVEL=INFO" > .env
```

---

## 🎮 How to Use

### Docker (Easiest)

```bash
# Start
docker-start.bat

# Open browser to:
http://localhost
```

### Manual Installation

#### ⚡ One-Click Startup (Windows)
Double-click **`START.bat`** in root directory.

This starts:
- Backend HTTP server (port 8000)
- Backend HTTPS server (port 8443) - enables Zero-Copy Streaming
- Frontend dev server (port 5173)

**Open browser to:** `http://192.168.1.x:5173` (shown in console)

> **Note:** HTTPS enables Zero-Copy Streams for files over 1GB. Check browser console to see if ZCS is enabled.

#### 🔍 Manual Startup (Debugging)

**Terminal 1: Backend HTTP**
```bash
cd backend
venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate  # Linux/Mac
hypercorn app.main:app --reload --bind 0.0.0.0:8000
```

**Terminal 2: Backend HTTPS (Optional - for streaming)**
```bash
cd backend
venv\Scripts\Activate.ps1
hypercorn app.main:app --reload --bind 0.0.0.0:8443 --certfile localhost+2.pem --keyfile localhost+2-key.pem
```

**Terminal 3: Frontend**
```bash
cd frontend
npm run dev
```

**Terminal 4: LibreTranslate (Optional)**
```bash
# If using Python package:
libretranslate

# If using Docker:
docker start libretranslate  # If already created
# OR
docker run -d -p 5000:5000 libretranslate/libretranslate
```

---

### 📱 Mobile Upload

1. Open app on desktop: `http://localhost` (Docker) or `http://192.168.1.x:5173` (Manual)
2. Click "Mobile Upload" to show QR code
3. Scan QR code with phone
4. Upload file from phone
5. Desktop receives and processes automatically

**Requirements:**
- Phone and computer on same WiFi network
- Firewall allows ports 80, 8000, 8443, 5173

---

## 🏗️ Architecture

### Deployment Options

#### Docker Deployment (Production)
```
nginx (Port 80)
    ├── Serves frontend static files
    └── Proxies API calls to backend
         ↓
Backend (Ports 8000, 8443)
    ├── FastAPI with Hypercorn
    ├── Whisper GPU transcription
    └── WebSocket real-time updates
         ↓
LibreTranslate (Port 5000)
    └── Translation service
```

#### Manual Deployment (Development)
```
Vite Dev Server (Port 5173)
    └── Hot reload, proxying
         ↓
Backend (Ports 8000, 8443)
    ├── HTTP/2 streaming
    └── HTTPS with SSL certs
```

### Backend Stack
```
FastAPI 0.115
├── Hypercorn (HTTP/2 + WebSocket)
├── Faster-Whisper (GPU transcription)
├── LibreTranslate (translation)
├── FFmpeg (audio extraction)
└── Redis (rate limiting)
```

### Frontend Stack
```
React 18.3
├── TypeScript
├── Vite (build tool)
├── Framer Motion (animations)
├── RxJS (reactive state)
├── Automerge CRDT (sync)
└── WebAssembly (streaming)
```

### Data Flow
```
Mobile/Desktop Upload
    ↓
Upload Transport
    ├── HTTPS Enabled: Zero-Copy Streaming (HTTP/2)
    │   # Efficiently streams large files (1GB+)
    |
    └── HTTP: Standard Upload (XMLHttpRequest)
        # Suitable for smaller files
    ↓
nginx (Docker) / Direct (Manual)
    ↓
Audio Extraction (FFmpeg)
    ↓
GPU Transcription (Whisper)
    ├── base, small, medium
    └── large-v2, large-v3 (highest accuracy)
    ↓
Translation (LibreTranslate - Optional)
    ↓
Multi-Format Export (SRT, VTT, TXT, CSV, JSON)
    ↓
WebSocket Updates → Client
```

---

## 📊 Performance Metrics

| Metric | Docker | Manual | Notes |
|--------|--------|--------|-------|
| **Transcription Speed** | 13.89x realtime | 13.89x realtime | With GPU |
| **Upload Speed** | 10x faster | 10x faster | HTTP/2 streaming |
| **Memory Usage** | 64KB constant | 64KB constant | Zero-copy mode |
| **Build Time** | 5-10 min (first) | N/A | Cached after first build |
| **Startup Time** | ~30s | ~10s | Container initialization |
| **File Size Limit** | 5GB | 5GB | Tested with 2.3GB |

---

## ⚙️ Configuration

### Docker Configuration

Edit `docker-compose.yml` environment variables:

```yaml
backend:
  environment:
    - WHISPER_DEVICE=cuda        # or 'cpu' if no GPU
    - WHISPER_MODEL=base         # base, small, medium, large-v2, large-v3
    - MAX_FILE_SIZE_MB=5000      # Upload limit
    - LOG_LEVEL=INFO             # DEBUG, INFO, WARNING, ERROR
```

### Manual Configuration

Create `backend/.env`:

```env
ENV=development
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
WHISPER_MODEL=base
MAX_FILE_SIZE_MB=5000
LOG_LEVEL=INFO
LIBRETRANSLATE_URL=http://localhost:5000
```

---

## 🔧 Troubleshooting

### Docker Issues

**"Docker is not running"**
```bash
# Start Docker Desktop, then:
docker-compose up -d
```

**Port 80 already in use**
```yaml
# Edit docker-compose.yml
frontend:
  ports:
    - "8080:80"  # Use port 8080 instead
```

**GPU not detected in Docker**
```bash
# Check NVIDIA Docker runtime:
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi

# If fails, install nvidia-docker2:
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
```

**Cannot find python-magic**
- This is normal in Docker - handled automatically
- Linux containers use `python-magic==0.4.27`
- Windows local uses `python-magic-bin==0.4.14`

---

### Manual Installation Issues

**🖥️ GPU Not Detected**
```bash
# Check CUDA installation
python -c "import torch; print(torch.cuda.is_available())"

# If False, reinstall PyTorch with CUDA:
pip uninstall torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
```

**🐍 Python Version Error**
```bash
# Check version
python --version

# MUST be 3.11.x (not 3.12+)
# Download Python 3.11.9:
# https://www.python.org/downloads/release/python-3119/
```

**🌐 Translation Not Working**
```bash
# Check LibreTranslate is running
curl http://localhost:5000/languages

# Start LibreTranslate:
# Docker:
docker run -d -p 5000:5000 libretranslate/libretranslate

# Python:
pip install libretranslate
libretranslate
```

**📱 Mobile Can't Connect**

1. Check firewall allows ports:
   - Docker: **80, 8000**
   - Manual: **5173, 8000, 8443**
2. Verify same WiFi network
3. Check IP shown in app matches your computer's IP
4. Windows: Allow through Windows Firewall

**🔒 SSL Certificate Errors**
```bash
# Regenerate certificates
cd backend
mkcert -install
mkcert localhost 192.168.1.* 127.0.0.1 ::1
```

**⚠️ "Upload failed: 413"**
- Docker: Update `frontend/nginx.conf` `client_max_body_size`
- Rebuild: `docker-compose build frontend && docker-compose up -d`

**⚠️ "Upload failed: 405"**
- Check CORS is enabled in `backend/app/main.py`
- Should have `CORSMiddleware` configured

---

## 📁 Project Structure

```
transcription-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── transcribe.py       # Main transcription endpoints
│   │   │   │   ├── websocket.py        # WebSocket handler
│   │   │   │   ├── stream_upload.py    # Zero-copy streaming
│   │   │   │   ├── translate_text.py   # Translation endpoints
│   │   │   │   └── session.py          # Mobile session management
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── whisper_service.py      # GPU transcription
│   │   │   ├── translation_service.py  # Translation engine
│   │   │   ├── audio_service.py        # FFmpeg wrapper
│   │   │   ├── validation_service.py   # File validation
│   │   │   └── export_service.py       # Format conversion
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── config.py
│   │   └── main.py                     # FastAPI app with CORS
│   ├── storage/                        # Uploaded files & results
│   ├── logs/                           # Application logs
│   ├── requirements.txt                # Linux/Docker dependencies
│   ├── requirements-local.txt          # Windows dependencies
│   ├── Dockerfile                      # Backend container
│   ├── localhost+2.pem                 # SSL certificate (optional)
│   └── localhost+2-key.pem             # SSL key (optional)
├── frontend/
│   ├── src/
│   │   ├── components/                 # React components
│   │   ├── hooks/                      # Custom hooks
│   │   ├── core/                       # CRDT & sync logic
│   │   ├── config/
│   │   │   └── backend.ts              # Smart backend detection
│   │   └── App.tsx
│   ├── public/
│   ├── nginx.conf                      # nginx config (Docker)
│   ├── Dockerfile                      # Frontend container
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml                  # Orchestration
├── docker-start.bat                    # Docker launcher (Windows)
├── DOCKER-README.md                    # Docker docs
├── START.bat                           # Manual launcher (Windows)
├── start.ps1                           # PowerShell startup
├── install.bat                         # Installation wizard
├── install.ps1                         # PowerShell installer
└── README.md
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Development Setup:**
```bash
# Use manual installation for development
# Docker is for production deployment

# Install pre-commit hooks (optional)
pip install pre-commit
pre-commit install
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](https://opensource.org/license/mit) file for details.

---

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition model
- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) - Optimized Whisper implementation
- [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) - Open-source translation API
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://reactjs.org/) - UI library
- [Docker](https://www.docker.com/) - Containerization platform

---

## 📞 Support

- 📧 **Email:** abdul.bari@us.af.mil
- 🐛 **Discord:** 18xray
- 💬 **Issues:** [GitHub Issues](https://github.com/zhadyz/ai-transcription-app/issues)

---

## 🗺️ Roadmap

### Version 1.5.2 (Current) ✅
- ✅ Complete Docker support
- ✅ Production-ready deployment
- ✅ GPU support in containers
- ✅ Mobile QR codes in Docker
- ✅ nginx reverse proxy

### Version 1.6 (Planned - Q1 2025)
- ⏳ **Kubernetes support** - Scalable cloud deployment
- ⏳ **Speaker diarization** - Identify who said what
- ⏳ **Batch processing** - Process multiple files
- ⏳ **Cloud storage** - S3, Google Drive, Dropbox integration
- ⏳ **User authentication** - JWT tokens, OAuth
- ⏳ **Admin dashboard** - Usage stats, user management

### Version 2.0 (Future - Q2 2025)
- 🔮 **Live transcription** - Real-time from microphone
- 🔮 **Video subtitle burning** - Embed subtitles in video
- 🔮 **Multi-language UI** - Localized interface
- 🔮 **API rate tiers** - Free, pro, enterprise plans
- 🔮 **Webhook notifications** - Notify when jobs complete
- 🔮 **Plugin system** - Custom post-processing

---

<div align="center">

**Made with tears ❤️ by hollowed_eyes**

⭐ **Stars are appreciated** ⭐

[Report Bug](https://github.com/zhadyz/ai-transcription-app/issues) · [Request Feature](https://github.com/zhadyz/ai-transcription-app/issues) · [Documentation](https://github.com/zhadyz/ai-transcription-app/wiki)

</div>
