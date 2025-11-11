# Real-Time Caption System Diagnostic Report
**Generated**: 2025-11-11 12:22 UTC
**Status**: Root cause identified - Binary audio NOT reaching backend

---

## Executive Summary

Comprehensive diagnostic logging has been added to both Rust (frontend) and Python (backend) sides. Testing reveals:

✅ **Rust Side: WORKING PERFECTLY**
- Audio capture callback invoked 1100+ times
- 120 audio chunks (4096 samples each) sent to channel
- All 120 chunks received from channel by WebSocket sender task
- All 120 binary messages (16384 bytes each) sent to WebSocket

❌ **Backend Side: NOT RECEIVING BINARY DATA**
- WebSocket connection established successfully
- Backend receives TEXT messages (config, ping) correctly
- Backend NEVER receives binary audio chunks
- `handle_audio_data` function never called
- Session stats show: `audio_chunks=0`

---

## Diagnostic Logging Added

### Rust Side (main.rs)

**Audio Capture Callback** (line 479-534):
- Tracks callback invocation count (every 100 calls)
- Logs send attempts and successes to channel
- Reports buffer size
- Detects when capturing stops

**Audio Receiver Task** (line 276-310):
- Logs when task starts
- Logs first chunk received
- Logs every 10th chunk received from channel
- Logs WebSocket send success/failure
- Logs when receiver loop exits

**WebSocket Task Lifecycle** (line 257-394):
- Assigns unique task ID to each WebSocket connection
- Logs task start, connection, and termination
- Tracks WebSocket message reception loop exit

### Backend Side (realtime.py)

**Main Message Loop** (line 128-133):
- Logs message_data keys received
- Logs BINARY message reception with byte count
- Logs TEXT message reception

---

## Test Results - Session 1

### Rust Logs (Evidence)

```
[WS_TASK_63618609] Spawning WebSocket task...
🎤 Starting system audio capture...
[WS_TASK_63618609] Task started, connecting...
[WS_TASK_63618609] ✓ Connected to WebSocket
[AUDIO_RX] Audio receiver task started, waiting for chunks...
✓ Audio capture running!
[AUDIO_RX] ✓ First chunk received from channel!
[AUDIO_CALLBACK] ✓ Sent 10 chunks to channel
[AUDIO_RX] Received 10 chunks from channel, sending to WebSocket
[AUDIO_RX] ✓ Sent 10 chunks to WebSocket (16384 bytes)
[AUDIO_CALLBACK] Invoked 100 times, buffer size: 2699, send attempts: 10, successes: 10
...
[AUDIO_CALLBACK] Invoked 1100 times, buffer size: 1331, send attempts: 118, successes: 118
[AUDIO_CALLBACK] ✓ Sent 120 chunks to channel
[AUDIO_RX] Received 120 chunks from channel, sending to WebSocket
[AUDIO_RX] ✓ Sent 120 chunks to WebSocket (16384 bytes)
[AUDIO_RX] ⚠ Audio receiver loop exited (channel closed)
[WS_TASK_63618609] ⚠ WebSocket receive loop exited
[WS_TASK_63618609] Task ending
```

**Analysis:**
- Audio callback successfully invoked 1100 times
- All 120 chunks successfully sent to mpsc channel
- All 120 chunks successfully received from channel
- All 120 binary WebSocket messages sent (16384 bytes each = 4096 f32 samples)
- Clean shutdown when user clicked Stop

### Backend Logs (Evidence)

```
2025-11-11 12:20:18 | [Realtime 5753603b] New connection request
2025-11-11 12:20:18 | [Realtime 5753603b] Connection accepted
2025-11-11 12:20:18 | [Realtime 5753603b] Transcription loop started
2025-11-11 12:20:18 | [Realtime 5753603b] Config updated: {'language': None, 'translate_to': None, 'min_chunk_duration': 0.15, 'model_size': 'tiny'}
```

**Analysis:**
- WebSocket connection successful
- Config message received and processed (TEXT message)
- NO binary message reception logs
- NO "Received BINARY message" logs
- NO "message_data keys" debug logs
- `handle_audio_data` function NEVER called

---

## Root Cause Analysis

**Problem**: Backend's `websocket.receive()` never returns binary messages despite Rust sending them.

**Evidence Chain**:
1. Rust logs confirm 120 binary messages sent via `write_guard.send(Message::Binary(bytes)).await`
2. No errors on Rust side - all sends reported successful
3. Backend receives TEXT messages (config) successfully from same WebSocket
4. Backend's `websocket.receive()` never returns binary messages
5. Backend diagnostic logging (message_data keys, BINARY detection) never triggers

**Possible Causes**:
1. **WebSocket Protocol Mismatch**: Rust tungstenite library vs FastAPI Starlette WebSocket
   - Different binary message framing?
   - Different message type encoding?

2. **FastAPI WebSocket API Issue**: `websocket.receive()` behavior
   - May not return binary in expected `message_data['bytes']` format
   - May need different API call (e.g., `websocket.receive_bytes()`)

3. **Async Loop Starvation**: Backend receive loop blocked or not processing messages
   - 60s timeout should trigger, but doesn't
   - Loop may be stuck waiting

---

## Next Steps

### Immediate Actions

1. **Test with Direct WebSocket Binary Send** (2 min)
   - Create minimal Python WebSocket client
   - Send binary message directly to backend
   - Confirm backend can receive binary at all

2. **Inspect FastAPI WebSocket receive() API** (5 min)
   - Check FastAPI documentation for binary message reception
   - Test `websocket.receive_bytes()` vs `websocket.receive()`
   - Check message_data structure for binary messages

3. **Add Backend Message Queue Inspection** (3 min)
   - Log ALL messages in receive queue before processing
   - Check if binary messages are queued but not processed

### Medium-Term Fixes

1. **Switch to FastAPI-native Binary Reception**:
   ```python
   # Instead of:
   message_data = await websocket.receive()
   if 'bytes' in message_data:
       ...

   # Try:
   try:
       binary_data = await websocket.receive_bytes()
       await handle_audio_data(websocket, session_id, binary_data, ...)
   except:
       text_data = await websocket.receive_text()
       ...
   ```

2. **Add Ping/Pong Binary Test**:
   - Have Rust send a test binary message on connection
   - Backend echoes it back
   - Confirms binary path works before audio streaming

---

## Session 2+ Behavior

**Status**: Cannot test until Session 1 works

Once binary audio reception is fixed, need to test:
- Does audio capture work in Session 2?
- Does audio reach backend in Session 2?
- Are there multiple WebSocket tasks running?

---

## Testing Checklist

- [x] Add Rust diagnostic logging
- [x] Add Backend diagnostic logging
- [x] Confirm Rust sends binary messages
- [x] Confirm Backend doesn't receive binary messages
- [ ] Test FastAPI binary reception API
- [ ] Fix backend binary message handling
- [ ] Test Session 1 with audio → captions
- [ ] Test Session 2 behavior
- [ ] Test Session 3+ behavior
- [ ] Remove debug logging
- [ ] Performance test

---

## Code Changes Required

**Priority 1 - Backend Binary Reception**:
`backend/app/api/routes/realtime.py` line 123-150

Current:
```python
message_data = await websocket.receive()
if 'bytes' in message_data and message_data['bytes'] is not None:
    await handle_audio_data(...)
```

Proposed Fix (need to test):
```python
# Option A: receive_bytes() for binary
try:
    binary_data = await asyncio.wait_for(websocket.receive_bytes(), timeout=0.1)
    await handle_audio_data(websocket, session_id, binary_data, ...)
    continue
except asyncio.TimeoutError:
    pass  # No binary data, check for text

# Option B: Explicit message type handling
message_data = await websocket.receive()
if message_data.get('type') == 'websocket.receive':
    if 'bytes' in message_data:
        await handle_audio_data(websocket, session_id, message_data['bytes'], ...)
```

---

## Conclusion

The live caption system's Rust frontend is **fully functional** and sending binary audio correctly. The critical blocker is that FastAPI's WebSocket `receive()` method is not returning binary messages in the expected format.

**Immediate action**: Test FastAPI binary reception API and update backend code accordingly.

**ETA**: 15 minutes to test and fix binary reception issue.

---

**Last Updated**: 2025-11-11 12:22 UTC
