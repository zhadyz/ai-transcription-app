# STYGIAN: Real-Time Speech Transcription & Translation System

## Technical Specification

Enterprise-grade speech recognition platform implementing GPU-accelerated transcription with real-time translation capabilities. Engineered for performance-critical applications requiring sub-second latency and multi-device synchronization.

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)

---

## System Architecture

### Core Components

**Backend Infrastructure**
- FastAPI/Hypercorn ASGI server (HTTP/2 + WebSocket)
- Faster-Whisper with CTranslate2 GPU acceleration
- CTranslate2-based neural machine translation (GPU-optimized)
- Dual voice activity detection (Silero VAD + PyAnnote)
- WebSocket-based real-time communication protocol

**Desktop Application**
- Tauri 2.0 native framework (Rust + WebView2)
- React 18 with TypeScript
- Overlay window system for live captions
- Custom STYGIAN UI theme

**Cross-Platform Synchronization**
- QR code-based device pairing
- Session management with WebSocket state sync
- Real-time progress updates (<10ms latency)

---

## Performance Characteristics

| Metric | Value | Configuration |
|--------|-------|--------------|
| **Transcription Speed** | 13.89× real-time | NVIDIA RTX 5080, CUDA 12.4, float16 |
| **Translation Latency** | 169-379ms | CTranslate2 GPU, NLLB-200-distilled-600M |
| **Memory Footprint** | 64KB | Zero-copy HTTP/2 streaming |
| **WebSocket Latency** | <10ms | Persistent bidirectional channels |
| **Maximum File Size** | 5GB | Validated with production workloads |
| **Concurrent Sessions** | 100+ | Rate-limited per IP |

---

## Technical Features

### Speech Recognition
- **Engine**: Faster-Whisper with CTranslate2 optimization
- **Models**: base, small, medium, large-v2, large-v3
- **Language Support**: 99+ languages with automatic detection
- **Output Formats**: SRT, VTT, TXT, CSV, JSON
- **Acceleration**: CUDA 12.4+ with Tensor Core utilization

### Neural Translation
- **Engine**: NLLB-200 (distilled-600M) via CTranslate2
- **Performance**: GPU-accelerated inference (169-379ms latency)
- **Language Pairs**: 200+ languages
- **Memory**: Optimized for RTX 40/50 series GPUs
- **Fallback**: Automatic degradation to CPU inference

### Voice Activity Detection
- **Primary**: Silero VAD v5.1 (lightweight, real-time)
- **Secondary**: PyAnnote Audio (high-accuracy)
- **Segmentation**: Intelligent audio chunking with overlap handling
- **Latency**: Sub-100ms detection for live applications

### Live Caption System
- **Framework**: Tauri 2.0 desktop application
- **Rendering**: Always-on-top overlay window
- **Translation**: Real-time dual-language caption display
- **Customization**: Position, font size, language selection
- **GPU Indicator**: Real-time device telemetry display

---

## System Requirements

### Minimum Configuration
- **OS**: Windows 10/11, macOS 11+, Linux (Ubuntu 20.04+)
- **CPU**: 4-core x86_64 processor
- **RAM**: 8GB
- **Storage**: 15GB available space

### Recommended Configuration
- **GPU**: NVIDIA RTX 40/50 series (8GB+ VRAM)
- **CUDA**: 12.4 or later
- **RAM**: 16GB
- **Storage**: NVMe SSD with 20GB+ available

### Dependencies
- Python 3.11.x (strictly required - 3.12+ incompatible)
- Node.js 18.0+
- FFmpeg (system PATH required)
- NVIDIA drivers 550+ (for GPU acceleration)

---

## Installation

### Clone Repository
```bash
git clone https://github.com/zhadyz/ai-transcription-app.git
cd ai-transcription-app
```

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements-local.txt  # Windows
pip install -r requirements.txt        # Linux/macOS
```

**CUDA Installation (GPU Acceleration)**:
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
```

### Desktop Application Setup
```bash
cd live-captions-desktop
npm install
```

### Translation Model Conversion
```bash
cd backend
python convert_nllb_to_ct2.py
```
This converts the NLLB-200 model to CTranslate2 format for GPU inference.

---

## Deployment

### Backend Service
```bash
cd backend
python -m hypercorn app.main:app --bind 0.0.0.0:8000
```

### Desktop Application
```bash
cd live-captions-desktop
npm run tauri dev    # Development
npm run tauri build  # Production
```

---

## API Reference

### Transcription Endpoint
```
POST /api/transcribe/upload
Content-Type: multipart/form-data

Parameters:
  - file: audio/video file (max 5GB)
  - language: ISO 639-1 code or 'auto'
  - quality: 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3'
  - format: 'srt' | 'vtt' | 'txt' | 'csv' | 'json'

Response:
  - task_id: UUID for status polling
```

### Translation Endpoint
```
POST /api/translate/text
Content-Type: application/json

Body:
  {
    "text": "string",
    "source_lang": "en",
    "target_lang": "es"
  }

Response:
  {
    "translated_text": "string",
    "latency_ms": number
  }
```

### WebSocket Connection
```
WS /ws

Events:
  - transcription_progress
  - transcription_complete
  - transcription_error
  - live_caption_update
```

---

## Configuration

### Backend Environment Variables
```env
WHISPER_DEVICE=cuda
WHISPER_MODEL=base
WHISPER_COMPUTE_TYPE=float16
MAX_FILE_SIZE_MB=5000
TRANSLATION_DEVICE=cuda
TRANSLATION_MODEL_PATH=./models/ct2_nllb
ENABLE_LIVE_CAPTIONS=true
```

### Desktop Application
Edit `live-captions-desktop/src-tauri/tauri.conf.json` for window configuration:
```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "width": 1100,
        "height": 750,
        "decorations": false
      },
      {
        "label": "overlay",
        "transparent": true,
        "alwaysOnTop": true
      }
    ]
  }
}
```

---

## Benchmark Results

### GPU-Accelerated Transcription (RTX 5080)
```
Model: base
Duration: 60s audio
Processing Time: 4.32s
Real-time Factor: 13.89×
VRAM Usage: 1.2GB
Power Draw: 85W
```

### GPU Translation Performance (CTranslate2)
```
Model: NLLB-200-distilled-600M
Input Length: 50 tokens
Latency: 169-379ms
Throughput: 2.6-5.9 translations/second
VRAM Usage: 2.1GB
```

### Voice Activity Detection
```
Model: Silero VAD v5.1
Chunk Size: 512 samples (32ms @ 16kHz)
Latency: 12-18ms
False Positive Rate: 0.8%
False Negative Rate: 1.2%
```

---

## Technical Limitations

1. **Python 3.12 Incompatibility**: Current PyTorch CUDA builds require Python 3.11.x
2. **CUDA Dependency**: GPU acceleration requires NVIDIA hardware with CUDA 12.4+
3. **Memory Constraints**: Large-v3 model requires 8GB+ VRAM for optimal performance
4. **Live Caption Latency**: Real-time transcription introduces 1-3 second delay due to VAD segmentation
5. **Translation Accuracy**: NLLB-200 distilled model trades accuracy for speed (600M parameters vs 3.3B full model)

---

## Architecture Decisions

### CTranslate2 vs. LibreTranslate
Migrated from LibreTranslate to CTranslate2 for:
- **5-10× performance improvement** through GPU acceleration
- **Lower memory footprint** (2.1GB vs 4.5GB)
- **Direct PyTorch integration** eliminating HTTP overhead
- **Quantization support** (float16, int8) for memory-constrained systems

### Dual VAD System
Implemented hybrid voice activity detection:
- **Silero VAD**: Real-time detection for live captions (low latency)
- **PyAnnote Audio**: Accurate segmentation for file transcription (high quality)

### Tauri vs. Electron
Selected Tauri 2.0 over Electron for:
- **70% smaller binary size** (15MB vs 50MB)
- **Lower memory usage** (80MB vs 200MB idle)
- **Native system integration** (Rust backend)
- **Better security** (sandboxed WebView2)

---

## Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/routes/          # API endpoint definitions
│   │   ├── services/            # Core business logic
│   │   │   ├── whisper_service.py
│   │   │   ├── translation_service.py
│   │   │   ├── audio_service.py
│   │   │   └── vad_service.py
│   │   ├── models/              # Pydantic schemas
│   │   └── main.py              # FastAPI application
│   ├── models/                  # Whisper & translation models
│   ├── storage/                 # Temporary file storage
│   └── requirements.txt
│
├── live-captions-desktop/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── contexts/            # React context providers
│   │   ├── hooks/               # Custom React hooks
│   │   └── App.tsx              # Main application
│   ├── src-tauri/
│   │   ├── src/main.rs          # Rust backend
│   │   ├── Cargo.toml           # Rust dependencies
│   │   └── tauri.conf.json      # Tauri configuration
│   └── package.json
│
└── README.md
```

---

## License

MIT License. See LICENSE for full terms.

---

## Trademarks and Copyright

NVIDIA, CUDA, and GeForce RTX are trademarks and/or registered trademarks of NVIDIA Corporation in the United States and other countries.

All other trademarks are property of their respective owners.

---

## Technical References

### Core Technologies
- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) - Optimized Whisper implementation
- [CTranslate2](https://github.com/OpenNMT/CTranslate2) - Fast inference engine for Transformer models
- [Silero VAD](https://github.com/snakers4/silero-vad) - Pre-trained voice activity detection
- [PyAnnote Audio](https://github.com/pyannote/pyannote-audio) - Speaker diarization toolkit
- [Tauri](https://tauri.app/) - Cross-platform desktop application framework
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework

### Research Papers
- Radford, A., et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision. arXiv:2212.04356
- NLLB Team (2022). No Language Left Behind: Scaling Human-Centered Machine Translation. arXiv:2207.04672
- Bredin, H., et al. (2020). pyannote.audio: neural building blocks for speaker diarization. ICASSP 2020

---

## Contact

**Technical Inquiries**: abdul.bari@us.af.mil
**Issue Tracking**: [GitHub Issues](https://github.com/zhadyz/ai-transcription-app/issues)
**Repository**: [github.com/zhadyz/ai-transcription-app](https://github.com/zhadyz/ai-transcription-app)
