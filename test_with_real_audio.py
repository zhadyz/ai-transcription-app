"""
Test with REAL audio from test.mp3
This bypasses Tauri entirely and tests if Whisper can transcribe actual audio
"""
import asyncio
import websockets
import json
import time
import numpy as np
from pydub import AudioSegment
import struct

WEBSOCKET_URL = "ws://localhost:8000/ws/realtime"
TEST_AUDIO_PATH = r"C:\Users\eclip\Desktop\Bari 2025 Portfolio\Transcription\V1.5\transcription-app\test.mp3"
RESULTS_FILE = r"C:\Users\eclip\Desktop\Bari 2025 Portfolio\Transcription\V1.5\transcription-app\WHISPER_TEST_RESULTS.md"

async def test_whisper_with_real_audio():
    """
    Load test.mp3, convert to 16kHz mono Float32, send to backend, verify transcription
    """
    print("═══════════════════════════════════════════════════════════════")
    print("WHISPER TRANSCRIPTION TEST WITH REAL AUDIO")
    print("═══════════════════════════════════════════════════════════════\n")

    # Load test.mp3
    print(f"[LOAD] Loading {TEST_AUDIO_PATH}...")
    try:
        audio = AudioSegment.from_mp3(TEST_AUDIO_PATH)
        print(f"[LOAD] ✓ Loaded: {len(audio)}ms, {audio.frame_rate}Hz, {audio.channels} channels")
    except Exception as e:
        print(f"[LOAD] ❌ Failed to load: {e}")
        return

    # Convert to 16kHz mono
    print("[CONVERT] Converting to 16kHz mono...")
    audio = audio.set_frame_rate(16000).set_channels(1)
    print(f"[CONVERT] ✓ Converted: {len(audio)}ms, {audio.frame_rate}Hz, {audio.channels} channel")

    # Convert to Float32 numpy array (normalized to -1.0 to 1.0)
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    samples = samples / (2**15)  # Normalize int16 to float32 [-1.0, 1.0]
    print(f"[CONVERT] ✓ {len(samples)} samples as Float32")

    # Connect to WebSocket
    print(f"\n[WS] Connecting to {WEBSOCKET_URL}...")
    async with websockets.connect(WEBSOCKET_URL) as websocket:
        print("[WS] ✓ Connected")

        # Receive connection confirmation
        msg = await websocket.recv()
        data = json.loads(msg)
        session_id = data.get('session_id', 'unknown')[:8]
        print(f"[WS] ✓ Session ID: {session_id}")

        # Send config
        config = {
            "type": "config",
            "language": None,  # Auto-detect
            "translate_to": None,
            "min_chunk_duration": 0.15,
            "model_size": "tiny"
        }
        await websocket.send(json.dumps(config))
        msg = await websocket.recv()
        print(f"[WS] ✓ Config sent and acknowledged")

        # Send audio in chunks (4096 samples = 0.256s at 16kHz)
        chunk_size = 4096
        num_chunks = len(samples) // chunk_size
        print(f"\n[SEND] Sending {num_chunks} chunks of {chunk_size} samples each...")

        captions = []
        send_task = asyncio.create_task(send_audio_chunks(websocket, samples, chunk_size))
        receive_task = asyncio.create_task(receive_captions(websocket, captions))

        # Wait for both tasks
        await send_task
        print("[SEND] ✓ All audio sent")

        # Wait a bit longer for transcriptions to come back
        print("[WAIT] Waiting 10s for transcriptions...")
        await asyncio.sleep(10)

        # Cancel receive task
        receive_task.cancel()
        try:
            await receive_task
        except asyncio.CancelledError:
            pass

        print(f"\n[RESULT] Received {len(captions)} captions")

        # Generate report
        report = generate_report(captions, session_id)
        with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
            f.write(report)

        print(f"[RESULT] ✓ Report saved to {RESULTS_FILE}")

        if len(captions) > 0:
            full_text = " ".join([c['text'] for c in captions if c.get('is_final', True)])
            print(f"\n✅ SUCCESS - Whisper transcribed the audio!")
            print(f"\nTranscript: \"{full_text}\"\n")
        else:
            print(f"\n❌ FAILED - Whisper did not transcribe the audio\n")

async def send_audio_chunks(websocket, samples, chunk_size):
    """Send audio in chunks"""
    for i in range(0, len(samples), chunk_size):
        chunk = samples[i:i+chunk_size]

        # Pad last chunk if needed
        if len(chunk) < chunk_size:
            chunk = np.pad(chunk, (0, chunk_size - len(chunk)), mode='constant')

        # Convert to bytes (little-endian float32)
        chunk_bytes = chunk.tobytes()

        # Send binary message
        await websocket.send(chunk_bytes)

        if (i // chunk_size) % 10 == 0:
            print(f"[SEND] Sent chunk {i // chunk_size + 1} ({len(chunk_bytes)} bytes)")

        # Small delay to simulate real-time streaming
        await asyncio.sleep(chunk_size / 16000.0)  # Sleep for duration of chunk

async def receive_captions(websocket, captions):
    """Receive captions from backend"""
    try:
        while True:
            msg = await websocket.recv()
            data = json.loads(msg)

            if data.get('type') == 'caption':
                caption_text = data.get('text', '')
                language = data.get('language', 'unknown')
                is_final = data.get('is_final', False)

                captions.append({
                    'text': caption_text,
                    'language': language,
                    'is_final': is_final,
                    'timestamp': time.time()
                })

                print(f"\n[CAPTION] '{caption_text}' ({language}, final={is_final})\n")

    except asyncio.CancelledError:
        pass

def generate_report(captions, session_id):
    """Generate test report"""
    report = f"""# Whisper Transcription Test with Real Audio
**Generated**: {time.strftime('%Y-%m-%d %H:%M:%S UTC')}
**Test Audio**: test.mp3 (real audio, not silence)
**Session ID**: {session_id}

---

## Test Result

"""

    if len(captions) == 0:
        report += "❌ **FAILED** - Whisper did not transcribe the audio\n\n"
        report += "**Possible Causes**:\n"
        report += "- Whisper model not loaded\n"
        report += "- Silero VAD blocking transcription (no speech detected)\n"
        report += "- Transcription loop not running\n"
        report += "- Audio buffer issue\n\n"
    else:
        report += f"✅ **SUCCESS** - Whisper transcribed {len(captions)} captions\n\n"

    report += "---\n\n## Captions Received\n\n"

    if len(captions) > 0:
        for i, caption in enumerate(captions, 1):
            report += f"### Caption {i}\n"
            report += f"- **Text**: \"{caption['text']}\"\n"
            report += f"- **Language**: {caption['language']}\n"
            report += f"- **Is Final**: {caption['is_final']}\n"
            report += f"- **Timestamp**: {time.strftime('%H:%M:%S', time.localtime(caption['timestamp']))}\n\n"
    else:
        report += "*No captions received*\n\n"

    report += "---\n\n## Full Transcript\n\n"

    if len(captions) > 0:
        full_text = " ".join([c['text'] for c in captions if c.get('is_final', True)])
        report += f"\"{full_text}\"\n\n"

        all_text = " ".join([c['text'] for c in captions])
        if all_text != full_text:
            report += f"**All captions (including partial):** \"{all_text}\"\n\n"
    else:
        report += "*No transcript available*\n\n"

    report += "---\n\n## Next Steps\n\n"

    if len(captions) == 0:
        report += "1. Check backend logs for transcription_loop activity\n"
        report += "2. Verify Whisper model loaded: `docker-compose logs backend | grep Whisper`\n"
        report += "3. Check Silero VAD settings (min_chunk_duration, speech detection)\n"
        report += "4. Test with longer audio duration\n\n"
    else:
        report += "✅ Whisper is working! Now debug why Tauri app isn't sending audio:\n"
        report += "1. Check CPAL audio callback logs in Rust\n"
        report += "2. Verify loopback device configuration\n"
        report += "3. Test with actual system audio playing\n\n"

    return report

if __name__ == "__main__":
    asyncio.run(test_whisper_with_real_audio())
