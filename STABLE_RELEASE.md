# STABLE RELEASE - Stygian v1.0.34

**Date:** 2025-12-01
**Status:** STABLE / WORKING
**Branch:** production/v2.0

---

## What Works

### Live Transcription
- Real-time audio capture (microphone + system audio)
- GPU-accelerated Whisper transcription (CUDA)
- Model sizes: tiny, base, small, medium, large-v2
- **large-v2 confirmed working** at 9.14x realtime on CUDA
- Clean model switching with availability check
- WebSocket-based streaming to frontend

### Model Management
- Models download on-demand from HuggingFace
- Cached in `%USERPROFILE%\.cache\huggingface\hub`
- Model availability check before switching
- Download progress via WebSocket (`/models/ws/download/{name}`)
- REST API: `GET /models/`, `GET /models/{name}/status`, `DELETE /models/{name}`

### Architecture (Working)
```
┌─────────────────────────────────────────────────────────────────┐
│                    TAURI DESKTOP APP                            │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend (TypeScript)                                    │
│  └── LiveCaptureContext.tsx                                     │
│      └── Tauri invoke('start_capture', {...})                   │
│      └── listen('caption', callback)                            │
│      └── checkModelAvailable() before model switch              │
├─────────────────────────────────────────────────────────────────┤
│  Rust Backend (src-tauri/)                                      │
│  └── main.rs                                                    │
│      └── start_capture() - spawns audio, connects WS            │
│      └── stop_capture() - sends shutdown signal, clean close    │
│      └── ws_shutdown_tx - proper WebSocket cleanup              │
│  └── backend_manager.rs                                         │
│      └── Manages Python process lifecycle                       │
│      └── First-run: extracts python-embed.zip, backend.zip      │
│      └── Installs dependencies, CUDA torch                      │
├─────────────────────────────────────────────────────────────────┤
│  Python Backend (backend/app/)                                  │
│  └── main.py - FastAPI app with model preloading                │
│  └── api/routes/realtime.py - WebSocket transcription           │
│  └── api/routes/models.py - Model management API                │
│  └── services/realtime_transcription_service.py                 │
│      └── faster-whisper with CUDA                               │
│      └── Silero VAD for speech detection                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `live-captions-desktop/src-tauri/src/main.rs` | Rust commands, WebSocket handling, shutdown signal |
| `live-captions-desktop/src-tauri/src/backend_manager.rs` | Python process lifecycle |
| `live-captions-desktop/src/contexts/LiveCaptureContext.tsx` | React state, model switch logic |
| `live-captions-desktop/src/hooks/useModelDownload.ts` | Model download with progress |
| `backend/app/api/routes/realtime.py` | WebSocket transcription endpoint |
| `backend/app/api/routes/models.py` | Model management REST/WS API |
| `backend/app/services/realtime_transcription_service.py` | Whisper + VAD |

---

## Recent Fixes (This Session)

### 1. WebSocket Zombie Sessions - FIXED
- **Problem:** Old WebSocket sessions stayed alive after `stop_capture()`
- **Solution:** Added `ws_shutdown_tx` channel for clean shutdown signal
- **Files:** `main.rs` - Added shutdown channel, `tokio::select!` in receive loop

### 2. Model Availability Check - ADDED
- **Problem:** Switching to undownloaded model caused hang/crash
- **Solution:** Check `/models/{name}/status` before switching
- **Files:** `LiveCaptureContext.tsx`, `useModelDownload.ts`

### 3. Original Crash Bug - FIXED (prior session)
- **Problem:** `return` in model switch error handler killed WebSocket
- **Solution:** Remove `return`, continue with current model on failure
- **Files:** `realtime.py`

---

## Build Commands

```bash
# Development
cd live-captions-desktop
npm run tauri dev

# Production build
cd live-captions-desktop
npm run tauri build

# Output: src-tauri/target/release/bundle/nsis/Stygian_1.0.34_x64-setup.exe
```

---

## Environment

- **Tauri:** v2.x
- **Rust:** stable
- **Node:** v18+
- **Python:** Embedded 3.11 (python-embed.zip)
- **PyTorch:** Nightly cu128 (for RTX 5000/Blackwell support)
- **faster-whisper:** Latest with CTranslate2
- **Silero VAD:** For speech detection

---

## Known Working Configuration

```
Model: large-v2 (maps to Systran/faster-whisper-large-v2)
Device: CUDA (GPU)
Performance: 9.14x realtime
Audio: 16kHz mono, float32
VAD: Silero with 0.1 speech threshold
```

---

## Notes for Future Development

1. **Before changing model logic:** This version has clean model switching working
2. **WebSocket cleanup:** Uses shutdown signal channel - don't remove
3. **Model names:** Frontend uses `large-v2`, backend registry has `large-v3` - mapping exists
4. **HuggingFace cache:** Models stored in standard HF cache, not custom location
5. **First-run setup:** Extracts python-embed.zip, installs deps, downloads CUDA torch

---

## Rollback Point

If future changes break things, this commit represents a stable working state.

```bash
git log --oneline -1  # Note this commit hash
git checkout <hash>   # To rollback if needed
```
