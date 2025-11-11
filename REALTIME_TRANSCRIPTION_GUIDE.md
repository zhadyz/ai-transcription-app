# Real-Time Live Transcription Feature

## Overview

This feature adds **real-time live caption transcription** to your application. Users can click a button to start capturing audio from their microphone and receive instant transcription overlays on screen.

### Key Features
- ✅ Real-time audio capture from browser microphone
- ✅ GPU-accelerated transcription (500ms-1s latency)
- ✅ Live caption overlays with smooth animations
- ✅ Auto language detection (99+ languages)
- ✅ Real-time translation (optional)
- ✅ Customizable caption appearance
- ✅ Volume visualization
- ✅ Error recovery and reconnection

---

## Installation

### 1. Backend Dependencies

```bash
cd backend
pip install -r requirements-realtime.txt
```

**Required packages:**
- `whisper-streaming==0.4.0`
- `librosa==0.10.2`
- `soundfile==0.12.1`

### 2. Frontend Dependencies

All frontend dependencies are already included in your existing `package.json`:
- ✅ React 18
- ✅ TypeScript
- ✅ Framer Motion (animations)
- ✅ TailwindCSS (styling)

---

## Quick Start

### Backend Setup

The backend routes are already integrated in `main.py`. The real-time transcription endpoint is available at:

```
ws://localhost:8000/ws/realtime
```

**No additional configuration needed!** The service automatically:
- Detects GPU/CPU availability
- Loads the optimal Whisper model (small - best for real-time)
- Manages audio buffers
- Handles WebSocket connections

### Frontend Integration

#### Option 1: Add to Existing App

```tsx
// In your main App.tsx or layout component
import { LiveCaptureProvider } from './contexts/LiveCaptureContext';
import { LiveCapturePanel } from './components/livecapture/LiveCapturePanel';

function App() {
  return (
    <LiveCaptureProvider>
      {/* Your existing app content */}
      <YourExistingComponents />

      {/* Add Live Capture Panel */}
      <div className="fixed top-4 right-4 z-50">
        <LiveCapturePanel />
      </div>
    </LiveCaptureProvider>
  );
}
```

#### Option 2: Standalone Page

```tsx
// Create a new page: pages/LiveTranscription.tsx
import { LiveCaptureProvider } from '../contexts/LiveCaptureContext';
import { LiveCapturePanel } from '../components/livecapture/LiveCapturePanel';

export function LiveTranscriptionPage() {
  return (
    <LiveCaptureProvider>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Live Transcription</h1>
          <LiveCapturePanel />
        </div>
      </div>
    </LiveCaptureProvider>
  );
}
```

---

## Usage

### For End Users

1. **Click "Live Capture" button** - Grants microphone permission
2. **Button turns red** - Capturing and transcribing
3. **Captions appear** - Real-time transcription overlay
4. **Click again to stop** - Ends capture session

### Settings (Gear Icon)

Users can customize:
- **Position**: Top, Center, or Bottom
- **Font Size**: Small, Medium, Large, XL
- **Language**: Auto-detect or specific language
- **Translation**: Enable real-time translation

---

## Architecture

### Data Flow

```
Microphone → Web Audio API → AudioCaptureService
                ↓
        Float32Array chunks (16kHz mono)
                ↓
        WebSocket → Backend
                ↓
        RealtimeTranscriptionService
                ↓
        Whisper (GPU) → Transcription
                ↓
        WebSocket → Frontend
                ↓
        CaptionOverlay (animated display)
```

### Components

| Component | Purpose |
|-----------|---------|
| **LiveCapturePanel** | Main integration component |
| **LiveCaptureButton** | Toggle button with states |
| **CaptionOverlay** | Animated caption display |
| **LiveCaptureContext** | State management |
| **AudioCaptureService** | Browser audio capture |
| **RealtimeWebSocket** | WebSocket client |

### Backend Services

| Service | Purpose |
|---------|---------|
| **RealtimeTranscriptionService** | Whisper streaming |
| **AudioBuffer** | Circular buffer management |
| **SimpleVAD** | Voice activity detection |
| **realtime.py** | WebSocket endpoint |

---

## Performance

### Latency Breakdown

| Stage | Time | Notes |
|-------|------|-------|
| Audio capture | 30ms | Browser chunk size |
| Network transmission | 10-50ms | Local: ~10ms, Internet: ~50ms |
| Buffer accumulation | 2-3s | Configurable |
| Transcription (GPU) | 300-500ms | Whisper small model |
| Network response | 10-50ms | WebSocket |
| **Total latency** | **2.5-4s** | Actual user experience |

### Optimization Tips

**For Lower Latency (1-2s):**
- Use `tiny` or `base` Whisper model (less accurate)
- Reduce buffer duration to 1.5s
- Use dedicated GPU

**For Higher Accuracy:**
- Use `medium` or `large-v3` model (more latency)
- Increase buffer to 3-4s
- Enable translation post-processing

---

## Configuration

### Backend Configuration

Edit `backend/app/services/realtime_transcription_service.py`:

```python
# Change model size
service = RealtimeTranscriptionService(
    model_size="small",  # Options: tiny, base, small, medium, large-v3
    device="auto",       # Options: cpu, cuda, auto
)

# Change buffer settings
audio_buffer = AudioBuffer(
    sample_rate=16000,
    max_duration=30.0  # Maximum buffer size in seconds
)

# Change VAD sensitivity
vad = SimpleVAD(energy_threshold=0.01)  # Lower = more sensitive
```

### Frontend Configuration

Edit `frontend/src/contexts/LiveCaptureContext.tsx`:

```typescript
// Default settings
const [settings, setSettings] = useState({
  language: null,        // Auto-detect
  translateTo: null,     // No translation
  fontSize: 'large',     // Caption size
  position: 'bottom',    // Caption position
  showTranslation: false
});
```

---

## Troubleshooting

### Backend Issues

**Error: "Failed to load Whisper model"**
- Check GPU drivers (CUDA 12.4+)
- Try CPU mode: `device="cpu"`
- Verify model files in `./models/`

**Error: "No speech detected"**
- Lower VAD threshold
- Check microphone input levels
- Test with louder audio

**High latency (>5s)**
- Switch to smaller model (`tiny` or `base`)
- Check GPU utilization
- Reduce buffer duration

### Frontend Issues

**Microphone permission denied**
- Use HTTPS (required for getUserMedia)
- Check browser permissions
- Try different browser

**No captions appearing**
- Check WebSocket connection (DevTools → Network → WS)
- Verify backend is running
- Check browser console for errors

**Captions cutting off**
- Increase `CAPTION_LIFETIME` in `CaptionOverlay.tsx`
- Adjust `min_chunk_duration` in WebSocket config

---

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| **Chrome 60+** | ✅ Full | Recommended |
| **Firefox 55+** | ✅ Full | Works well |
| **Edge 79+** | ✅ Full | Chromium-based |
| **Safari 11+** | ⚠️ Limited | Requires HTTPS |
| **Mobile Chrome** | ✅ Full | Android only |
| **Mobile Safari** | ⚠️ Limited | iOS 15+ |

---

## Security Considerations

### HTTPS Required

Microphone access requires HTTPS in production:

```bash
# Development (self-signed cert)
cd backend
# Already configured with localhost+2.pem

# Production
# Use Let's Encrypt or your SSL certificate
```

### Permissions

Users must grant microphone permission. Handle denial gracefully:

```typescript
try {
  await start();
} catch (error) {
  // Show friendly error message
  alert('Microphone access denied. Please allow access to use live captions.');
}
```

---

## Future Enhancements

Potential improvements:

- [ ] **System audio capture** (Windows/macOS loopback)
- [ ] **Speaker diarization** (identify different speakers)
- [ ] **Caption history** (scrollable transcript)
- [ ] **Export captions** (download as SRT/VTT)
- [ ] **Keyword highlighting** (emphasis on important words)
- [ ] **Caption styles** (multiple themes)
- [ ] **Offline mode** (local processing)
- [ ] **Multi-language mixing** (code-switching support)

---

## API Reference

### LiveCaptureContext API

```typescript
const {
  isActive,      // boolean - is capturing
  isConnected,   // boolean - WebSocket connected
  volume,        // number - current volume (0-1)
  currentCaption,// Caption | null - current caption
  error,         // string | null - error message
  settings,      // LiveCaptureSettings - current settings
  start,         // () => Promise<void> - start capture
  stop,          // () => void - stop capture
  updateSettings,// (settings) => void - update settings
  isSupported    // boolean - browser support
} = useLiveCapture();
```

### WebSocket Protocol

**Client → Server:**
```typescript
// Config update
{ type: 'config', language: 'en', translate_to: 'es' }

// Heartbeat
{ type: 'ping', timestamp: 1234567890 }

// Audio data (binary)
Float32Array.buffer
```

**Server → Client:**
```typescript
// Caption
{
  type: 'caption',
  text: 'Hello world',
  language: 'en',
  start: 0.0,
  end: 2.5,
  is_final: true,
  timestamp: 1234567890
}

// Translation (if enabled)
{
  type: 'translation',
  text: 'Hola mundo',
  language: 'es',
  timestamp: 1234567890
}
```

---

## Support

For issues or questions:
1. Check browser console for errors
2. Verify backend logs
3. Test with different browsers
4. Check microphone hardware
5. Review WebSocket connection

---

## License

Same as main project license.

**Enjoy real-time transcription! 🎙️**
