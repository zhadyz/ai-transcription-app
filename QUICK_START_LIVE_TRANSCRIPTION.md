# Quick Start: Live Transcription

## 🚀 Get Started in 3 Minutes

### Step 1: Install Backend Dependencies (1 min)

```bash
cd backend
pip install -r requirements-realtime.txt
```

### Step 2: Start Backend (if not running)

```bash
cd backend
python -m app.main
```

The real-time endpoint is automatically available at `ws://localhost:8000/ws/realtime`

### Step 3: Add to Frontend (2 min)

Find your main App component (likely `frontend/src/App.tsx` or similar) and add:

```tsx
import { LiveCaptureProvider } from './contexts/LiveCaptureContext';
import { LiveCapturePanel } from './components/livecapture';

function App() {
  return (
    <LiveCaptureProvider>
      {/* Your existing app */}
      <YourExistingApp />

      {/* Add this anywhere - it's position:fixed */}
      <div className="fixed top-4 right-4 z-50">
        <LiveCapturePanel />
      </div>
    </LiveCaptureProvider>
  );
}
```

### Step 4: Test It! ✨

1. Open your app in browser: `http://localhost:5173`
2. Look for the "🎙️ Live Capture" button (top-right)
3. Click it to start
4. Speak into your microphone
5. Watch captions appear in real-time!

---

## 🎯 That's It!

You now have:
- ✅ Real-time transcription (500ms-1s latency)
- ✅ Live caption overlay
- ✅ Auto language detection
- ✅ Customizable appearance
- ✅ Translation support (optional)

---

## 📝 Example Integration Locations

### Option 1: Main App Layout

```tsx
// frontend/src/App.tsx
<LiveCaptureProvider>
  <div className="app">
    <Header />
    <MainContent />
    <Footer />

    {/* Fixed in top-right corner */}
    <div className="fixed top-4 right-4 z-50">
      <LiveCapturePanel />
    </div>
  </div>
</LiveCaptureProvider>
```

### Option 2: Dedicated Page

```tsx
// frontend/src/pages/LiveTranscription.tsx
export function LiveTranscriptionPage() {
  return (
    <LiveCaptureProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">
            Live Transcription
          </h1>

          <div className="bg-white rounded-xl shadow-2xl p-8">
            <LiveCapturePanel />

            <div className="mt-8 text-center text-gray-600">
              <p>Click "Live Capture" to start real-time transcription</p>
              <p className="text-sm mt-2">Powered by Whisper AI</p>
            </div>
          </div>
        </div>
      </div>
    </LiveCaptureProvider>
  );
}
```

### Option 3: As Toolbar Item

```tsx
// Add to existing toolbar
<div className="toolbar flex items-center gap-4">
  <ToolbarButton>Upload</ToolbarButton>
  <ToolbarButton>Settings</ToolbarButton>

  {/* Live capture as toolbar item */}
  <LiveCaptureProvider>
    <LiveCapturePanel />
  </LiveCaptureProvider>
</div>
```

---

## 🎨 Customization Examples

### Change Caption Position

```tsx
// In LiveCaptureContext.tsx, change default settings:
const [settings, setSettings] = useState({
  position: 'top',    // or 'center', 'bottom'
  fontSize: 'xlarge', // Make it bigger!
  // ...
});
```

### Different Button Style

```tsx
// Customize LiveCaptureButton.tsx colors:
const stateStyles = {
  active: {
    bg: 'bg-purple-500 hover:bg-purple-600', // Purple instead of red
    // ...
  },
};
```

### Custom Caption Background

```tsx
<CaptionOverlay
  caption={currentCaption}
  backgroundColor="rgba(25, 25, 112, 0.9)" // Midnight blue
  textColor="#FFD700" // Gold text
  // ...
/>
```

---

## 🔧 Troubleshooting

**Microphone not working?**
- Make sure you're using HTTPS (or localhost)
- Check browser permissions
- Look for permission prompt

**No captions appearing?**
- Check backend is running: `http://localhost:8000/health`
- Open browser DevTools → Network → WS (should see connection)
- Check browser console for errors

**Backend error?**
```bash
# Missing dependencies?
pip install -r requirements-realtime.txt

# GPU not available?
# It will automatically fall back to CPU (slower but works)
```

---

## 🎯 Next Steps

1. **Try it with different languages** - It auto-detects!
2. **Enable translation** - Click settings gear
3. **Customize appearance** - Change colors, position, size
4. **Read full docs** - See `REALTIME_TRANSCRIPTION_GUIDE.md`

---

## 🌟 Pro Tips

**For Best Performance:**
- Use Chrome/Edge (best audio API support)
- Speak clearly and not too fast
- Use in quiet environment
- Keep microphone close

**For Best Accuracy:**
- Backend will use GPU if available (13× faster!)
- CPU mode still works (just slower)
- Auto-detection works best with clear speech
- Can manually select language for better results

---

## 📊 What You Built

You just added a feature comparable to:
- ✅ Google Live Transcribe
- ✅ Microsoft Live Captions (Copilot Plus)
- ✅ Zoom/Teams live captions
- ✅ Otter.ai real-time transcription

**All running on YOUR infrastructure!** 🎉

---

## Need Help?

Check `REALTIME_TRANSCRIPTION_GUIDE.md` for:
- Detailed architecture
- Performance optimization
- Advanced configuration
- API reference
- Full troubleshooting guide

**Happy transcribing! 🎙️✨**
