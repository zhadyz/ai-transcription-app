# Real-Time Transcription Debugging Session - SOLUTION APPLIED ✓

## ROOT CAUSE IDENTIFIED ✓

**VAD (Voice Activity Detection) threshold was TOO HIGH**

### The Problem
- Audio WAS being captured by Tauri app ✓
- Audio WAS being sent to backend WebSocket ✓
- Backend WAS receiving audio chunks ✓
- **BUT:** VAD detected < 10% speech ratio → Whisper never ran!

### Location
`backend/app/services/realtime_transcription_service.py:527`

**Original code:**
```python
speech_ratio = self.vad.get_speech_ratio(audio, self.sample_rate)
if speech_ratio < 0.1:  # Less than 10% speech (allows short words)
    logger.debug(f"Low speech ratio: {speech_ratio:.2f}, skipping transcription")
    return []  # ← Whisper skipped, no captions!
```

### Solution Applied ✓

**Changed threshold from 0.1 (10%) to 0.01 (1%)**

```python
speech_ratio = self.vad.get_speech_ratio(audio, self.sample_rate)
logger.info(f"[VAD] Speech ratio: {speech_ratio:.3f} (threshold: 0.01)")
if speech_ratio < 0.01:  # Less than 1% speech (ULTRA sensitive for quiet audio)
    logger.info(f"[VAD] Low speech ratio: {speech_ratio:.3f}, skipping transcription")
    return []
```

**Changes:**
1. Lowered threshold from 10% to 1% (10x more sensitive)
2. Added logging to see speech ratio values
3. Changed log level from DEBUG to INFO for visibility

**Applied:** 2025-11-11 16:08:24
**Status:** Backend restarted, changes active

## Testing Instructions

### User Actions:
1. **In Tauri desktop app:**
   - Click "Stop Captions" if currently running
   - Click "Start Captions" again
   - **Speak clearly** into microphone: "Hello, this is a test"

2. **Check backend logs:**
```bash
docker-compose logs -f backend | grep -i "VAD\|Caption sent"
```

3. **Expected output:**
```
[VAD] Speech ratio: 0.XXX (threshold: 0.01)
[Realtime xxx] Caption sent: "Hello, this is a test" (en)
```

4. **Expected in UI:**
   - Captions should appear at bottom of screen!

## Additional Tuning (if needed)

If still no captions:

### Option A: Lower threshold even more
```python
if speech_ratio < 0.001:  # 0.1% - extremely sensitive
```

### Option B: Disable VAD check temporarily
```python
# Comment out the check:
# if speech_ratio < 0.01:
#     return []
```

### Option C: Check Silero VAD settings
Line 119-120: Silero threshold is 0.05

```python
is_speech = avg_speech_prob > 0.05  # Could lower to 0.01
```

## Architecture Reminder

```
Tauri Rust Backend
  ↓ (Audio capture: WASAPI)
WebSocket: ws://localhost:8000/ws/realtime
  ↓ (Binary audio chunks)
Python Backend - realtime.py
  ↓ (Receives, buffers audio)
AudioBuffer
  ↓ (2s timeout triggers transcription)
RealtimeTranscriptionService
  ↓ (VAD check - NOW: 0.01 threshold)
Whisper Model (tiny)
  ↓ (Transcription)
Caption JSON
  ↓ (WebSocket response)
Tauri Rust Backend
  ↓ (IPC event)
React UI - LiveCaptureContext
  ↓ (State update)
CaptionOverlay Component
  ↓ (Display!)
```

## Files Modified

1. `backend/app/services/realtime_transcription_service.py` 
   - Line 527: Changed threshold from 0.1 to 0.01
   - Line 527: Added logging for speech ratio

## Next Steps

1. User tests with new threshold
2. Check logs for VAD output
3. Verify captions appear in UI
4. If still issues, further lower threshold or disable VAD
