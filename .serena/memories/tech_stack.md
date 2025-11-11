# Technology Stack

## Backend Infrastructure
- **Framework**: FastAPI 0.115
- **ASGI Server**: Hypercorn 0.17.3 (HTTP/2 + WebSocket support)
- **AI/ML**: 
  - Faster-Whisper 1.0.3 (CUDA-accelerated transcription)
  - Transformers 4.30+ (Hugging Face, NLLB-200 translation)
  - PyTorch 2.0+ (required for Silero VAD)
  - Silero VAD 5.1 (Voice Activity Detection)
- **Audio Processing**: FFmpeg (via ffmpeg-python 0.2.0)
- **Translation**: LibreTranslate (Docker container)
- **Data Validation**: Pydantic 2.9+
- **Real-time Communication**: WebSockets 13.1, wsproto 1.2.0
- **Rate Limiting**: SlowAPI 0.1.9, Redis 5.2.0
- **File Handling**: aiofiles 24.1.0, python-multipart 0.0.9
- **Utilities**: tenacity 9.0.0, httpx 0.27.2, requests 2.32.3
- **Monitoring**: psutil 6.1.0, nvidia-ml-py3 7.352.0
- **File Validation**: python-magic 0.4.27 (Linux/Docker)

## Frontend Infrastructure
- **Framework**: React 18.2
- **Language**: TypeScript 5.3.3
- **Build System**: Vite 5.0.8
- **UI Styling**: TailwindCSS 3.4.0 with PostCSS, Autoprefixer
- **Animation**: Framer Motion 10.16.16
- **State Management**: 
  - Zustand 4.4.7 (simple state)
  - RxJS 7.8.1 (reactive state)
  - Automerge 2.1.10 (CRDT for distributed sync)
- **Routing**: React Router DOM 7.9.3
- **Real-time**: Socket.io-client 4.8.1, WebSocket API
- **File Upload**: React Dropzone 14.2.3
- **QR Codes**: qrcode.react 4.2.0
- **HTTP Client**: Axios 1.6.2
- **Utilities**: @msgpack/msgpack 3.0.0, lz4js 0.2.0
- **WebAssembly**: vite-plugin-wasm 3.5.0, vite-plugin-top-level-await 1.6.0
- **Linting**: ESLint 8.56.0

## Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose
- **Reverse Proxy**: nginx (production)
- **CUDA Support**: NVIDIA Docker runtime, CUDA 12.4+
- **SSL/TLS**: Self-signed certificates via mkcert

## Platform
- **OS**: Windows (primary development), Linux (Docker containers)
- **Python Version**: 3.11.x (strictly required)
- **Node.js Version**: 18.0+
