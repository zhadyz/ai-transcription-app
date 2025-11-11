# Live Captions Desktop App 🎬

Real-time system audio transcription with overlay captions powered by Tauri + Rust + React.

## Features ✨

- **System Audio Capture** - Transcribes YouTube, Spotify, movies, games, etc.
- **Overlay Window** - Always-on-top transparent captions
- **GPU Accelerated** - Uses your existing Whisper backend
- **Lightweight** - ~5MB binary (Rust + React)
- **System Tray** - Minimize to tray, start/stop from menu

## How It Works 🔧

```
System Audio → WASAPI Loopback → Rust → WebSocket → Backend (Whisper) → Captions
```

1. **Rust backend** captures system audio using WASAPI (Windows Audio Session API)
2. **Converts** audio to Float32Array format
3. **Streams** to your existing transcription backend via WebSocket
4. **Displays** captions in an always-on-top overlay window

## Prerequisites 📋

- **Backend running**: Make sure your transcription backend is running on `localhost:8000`
- **Rust toolchain**: Already installed ✅
- **Node.js**: Already installed ✅

## Running the App 🚀

### Development Mode

```bash
npm run tauri dev
```

This will:
1. Start the Vite dev server (React frontend)
2. Compile Rust backend
3. Launch the desktop app

### Build Production Binary

```bash
npm run tauri build
```

Output: `src-tauri/target/release/live-captions-desktop.exe` (~5MB)

## Usage 📖

### Method 1: UI Button
1. Launch the app
2. Click "▶ Start Captions" in the top-right corner
3. Play any audio (YouTube, Spotify, movie, etc.)
4. Captions appear at the bottom of your screen!
5. Click "⏹ Stop Captions" when done

### Method 2: System Tray
1. Right-click the tray icon
2. Select "Start Captions"
3. Play any audio
4. Select "Stop Captions" when done

## Configuration ⚙️

### Window Position
Edit `src-tauri/tauri.conf.json`:
```json
{
  "app": {
    "windows": [{
      "y": 900,  // Vertical position (pixels from top)
      "height": 150  // Window height
    }]
  }
}
```

### Caption Styling
Edit `src/App.tsx` to customize:
- Font size: `text-2xl` → `text-3xl` (larger) or `text-xl` (smaller)
- Background: `bg-black/90` → `bg-blue-900/90` (colored)
- Position: `justify-end pb-4` → `justify-start pt-4` (top of screen)

### Backend URL
Edit `src-tauri/src/main.rs` line 45:
```rust
connect_async("ws://localhost:8000/ws/realtime").await
```

## Troubleshooting 🔧

### Icons Missing
Run this command to generate placeholder icons:
```bash
cargo install tauri-cli
cargo tauri icon path/to/icon.png
```

Or download icons from: [Tauri Icons](https://tauri.app/v1/guides/features/icons)

### Audio Not Capturing
- **Check permissions**: Windows may require audio device permissions
- **Try different device**: Some audio devices don't support loopback
- **Check backend**: Make sure `docker ps` shows transcription-backend running

### No Captions Appearing
1. Check backend logs: `docker logs transcription-backend`
2. Check browser console (F12 in the Tauri window)
3. Verify WebSocket connection in logs

## Architecture 🏗️

```
┌─────────────────────────────────────────────┐
│           Tauri Desktop App                 │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │  React UI    │◄─────┤  Rust Backend   │ │
│  │  (Overlay)   │      │  - Audio Capture│ │
│  └──────────────┘      │  - WebSocket    │ │
│                        └─────────────────┘ │
└────────────────┬────────────────────────────┘
                 │ WebSocket
                 ▼
┌─────────────────────────────────────────────┐
│      Transcription Backend (Docker)         │
│  ┌──────────────────────────────────────┐  │
│  │  FastAPI + Whisper + Silero VAD      │  │
│  │  - GPU Accelerated (CUDA)            │  │
│  │  - Real-time Speech Detection        │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Customization Ideas 💡

1. **Multiple Languages**: Add language selector in UI
2. **Save Transcripts**: Record all captions to file
3. **Microphone Mode**: Switch between system audio and mic
4. **Mixed Mode**: Capture both system audio + microphone
5. **Speaker Diarization**: Detect different speakers (requires pyannote)
6. **Translation**: Real-time translation with translate_to config

## Performance 📊

- **Memory**: ~50MB RAM
- **CPU**: ~2-5% (mostly backend)
- **Latency**: ~200-500ms (depends on Whisper model)
- **GPU**: Used by backend for Whisper inference

## Keyboard Shortcuts (Future)

- `Ctrl+Alt+C`: Start/Stop capture
- `Ctrl+Alt+H`: Hide/Show overlay
- `Ctrl+Alt+Q`: Quit app

## License

Same as parent project.

## Credits

Built with:
- [Tauri](https://tauri.app/) - Desktop framework
- [cpal](https://github.com/RustAudio/cpal) - Audio capture
- [Whisper](https://github.com/openai/whisper) - Speech recognition
- [React](https://react.dev/) - UI framework
