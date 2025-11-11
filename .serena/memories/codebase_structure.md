# Codebase Structure

## Root Directory
```
transcription-app/
├── START-HERE.bat              # ⭐ ONE-CLICK Docker start script (Windows)
├── APP-INFO.txt                # Auto-generated IP address info
├── OnyxTranscription.exe       # Alternative automated installer
├── docker-compose.yml          # Docker orchestration config
├── README.md                   # Primary documentation
├── CLAUDE.md                   # MENDICANT_BIAS orchestrator instructions
├── .gitignore                  # Git ignore rules
├── LICENSE                     # MIT License
├── backend/                    # Python FastAPI backend
├── frontend/                   # React TypeScript frontend
├── scripts/                    # Deployment scripts
├── lt-data/                    # LibreTranslate data volume
├── internal-tests/             # Internal test files
├── live-captions-desktop/      # Desktop live captions feature
├── --name/                     # Unknown directory
└── Test files (*.py, *.md)     # Various test and documentation files
```

## Backend Structure
```
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── transcribe.py          # Transcription endpoints
│   │   │   ├── websocket.py           # Real-time WebSocket handler
│   │   │   ├── stream_upload.py       # Zero-copy streaming
│   │   │   ├── translate_text.py      # Translation integration
│   │   │   ├── session.py             # Mobile session management
│   │   │   ├── system.py              # System/health endpoints
│   │   │   ├── capabilities.py        # Feature capabilities
│   │   │   ├── device_broadcaster.py  # Device telemetry
│   │   │   ├── realtime.py            # Real-time transcription
│   │   │   ├── auth.py                # Authentication (API v2)
│   │   │   ├── api_keys.py            # API key management (API v2)
│   │   │   └── api_v2.py              # API v2 routes
│   │   └── dependencies/              # Dependency injection
│   ├── services/
│   │   ├── whisper_service.py         # GPU transcription engine
│   │   ├── translation_service.py     # Translation interface
│   │   ├── audio_service.py           # FFmpeg pipeline
│   │   ├── validation_service.py      # Input validation
│   │   ├── export_service.py          # Multi-format export
│   │   ├── session_service.py         # Session management
│   │   ├── realtime_transcription_service.py  # Real-time transcription
│   │   ├── auth_service.py            # Authentication service
│   │   ├── api_key_service.py         # API key service
│   │   ├── webhook_service.py         # Webhook notifications
│   │   ├── file_input_service.py      # File input handling
│   │   └── cleanup_service.py         # Resource cleanup
│   ├── models/
│   │   ├── transcription.py           # Transcription models
│   │   └── auth.py                    # Auth models (API v2)
│   ├── middleware/
│   │   └── rate_limit.py              # Rate limiting middleware
│   ├── core/
│   │   └── auth_exceptions.py         # Auth exception handlers
│   ├── db/                            # Database models (API v2)
│   ├── config.py                      # Configuration management
│   ├── logging_config.py              # Logging setup
│   ├── main.py                        # FastAPI app entry (v1)
│   └── main_v2.py                     # API v2 entry point
├── storage/                           # Uploaded files and transcripts
├── logs/                              # Application logs
├── migrations/                        # Database migrations (API v2)
├── requirements.txt                   # Linux/Docker dependencies
├── requirements-local.txt             # Windows dependencies
├── requirements-auth.txt              # Auth dependencies (API v2)
├── requirements-realtime.txt          # Real-time dependencies
├── Dockerfile                         # Backend container definition
├── localhost+2.pem                    # SSL certificate
├── localhost+2-key.pem                # SSL private key
├── stress_test.py                     # Stress testing script
└── venv/                              # Python virtual environment (native)
```

## Frontend Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── upload/                    # Upload components
│   │   ├── system/                    # System components
│   │   │   └── DeviceIndicator.tsx    # GPU/device status
│   │   └── livecapture/               # Live capture components
│   ├── contexts/
│   │   └── LiveCaptureContext.tsx     # Live capture state
│   ├── core/
│   │   ├── SessionContext.tsx         # Session management
│   │   ├── WebSocketContext.tsx       # WebSocket state
│   │   └── [CRDT logic]               # Distributed sync (Automerge)
│   ├── hooks/                         # Custom React hooks
│   ├── services/
│   │   ├── audioCapture.ts            # Audio capture service
│   │   └── realtimeWebSocket.ts       # Real-time WebSocket
│   ├── config/
│   │   └── backend.ts                 # Backend service discovery
│   ├── assets/                        # Static assets
│   ├── styles/                        # Global styles
│   ├── types/                         # TypeScript type definitions
│   ├── App.tsx                        # Application root
│   └── main.tsx                       # Entry point
├── public/                            # Public static assets
├── node_modules/                      # NPM dependencies
├── package.json                       # Node.js dependencies & scripts
├── package-lock.json                  # Locked dependency versions
├── tsconfig.json                      # TypeScript config
├── tsconfig.node.json                 # TypeScript Node config
├── vite.config.ts                     # Vite build config
├── tailwind.config.js                 # TailwindCSS config
├── postcss.config.js                  # PostCSS config
├── Dockerfile                         # Frontend container definition
├── nginx.conf                         # Production nginx config
└── index.html                         # HTML entry point
```

## Key Configuration Files

### Docker
- `docker-compose.yml` - Multi-container orchestration with backend, frontend, libretranslate services

### Backend
- `backend/app/config.py` - Central configuration with environment variables
- `backend/.env` - Local environment variables (not in repo)
- `backend/requirements*.txt` - Python dependencies (platform-specific)

### Frontend
- `frontend/vite.config.ts` - Build system and dev server config
- `frontend/package.json` - Dependencies and npm scripts
- `frontend/tailwind.config.js` - Styling configuration
- `frontend/nginx.conf` - Production reverse proxy config

## Important Notes

### Experimental v2.0 API
The current branch `experimental/v2.0-api-first` includes:
- `backend/app/main_v2.py` - New API entry point
- Authentication and API key management
- Real-time transcription service
- Database integration (`backend/db/`, `backend/migrations/`)
- Additional requirements files for new features

### Files to Ignore
- `.git/` - Git repository data
- `.serena/` - Serena MCP server data
- `.claude/` - Claude Code configuration
- `node_modules/` - NPM dependencies (frontend)
- `venv/` - Python virtual environment (backend)
- `backend/storage/` - Uploaded files (runtime)
- `backend/logs/` - Log files (runtime)
- `lt-data/` - LibreTranslate data (runtime)
- Test files in root: `test_*.py`, `fully_automated_test.py`
- Documentation: Various `*.md` files (security audits, diagnostics, guides)

### Entry Points
- **Docker**: `docker-compose up -d` or `START-HERE.bat`
- **Native Backend**: `backend/app/main.py` (FastAPI application)
- **Native Frontend**: `frontend/src/main.tsx` (React entry)
- **Alternative**: `x.py` or `OnyxTranscription.exe` (automated installers)

### Data Flow
1. Upload → `backend/api/routes/stream_upload.py` or `transcribe.py`
2. Audio Extraction → `backend/services/audio_service.py` (FFmpeg)
3. Transcription → `backend/services/whisper_service.py` (Faster-Whisper)
4. Translation → `backend/services/translation_service.py` (LibreTranslate)
5. Export → `backend/services/export_service.py` (Multi-format)
6. Real-time Updates → `backend/api/routes/websocket.py`

### Mobile Integration
- QR code generation in frontend
- Session management: `backend/app/services/session_service.py`
- Mobile route: `frontend/src/components/upload/MobileUpload.tsx`
- Device pairing tracked via WebSocket connections
