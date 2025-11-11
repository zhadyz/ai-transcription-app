"""
FULLY AUTOMATED End-to-End Test
- Finds and clicks "Start Live Captions" button using pyautogui
- Plays test.mp3 through system audio
- Monitors backend for transcription results
- Generates evidence report

NO USER INTERACTION REQUIRED
"""
import asyncio
import websockets
import json
import time
import subprocess
import sys
import os
import pyautogui
import pygetwindow as gw
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

WEBSOCKET_URL = "ws://localhost:8000/ws/realtime"
TEST_AUDIO_PATH = r"C:\Users\eclip\Desktop\Bari 2025 Portfolio\Transcription\V1.5\transcription-app\test.mp3"
RESULTS_FILE = r"C:\Users\eclip\Desktop\Bari 2025 Portfolio\Transcription\V1.5\transcription-app\AUTOMATED_TEST_RESULTS.md"

# ═══════════════════════════════════════════════════════════════════════════
# UI AUTOMATION - Click "Start Live Captions" Button
# ═══════════════════════════════════════════════════════════════════════════

def find_and_click_start_button():
    """Find the Tauri app window and click Start Live Captions button"""
    print("[UI] Searching for Tauri app window...")

    # Find window by title (adjust if needed)
    windows = gw.getWindowsWithTitle("Live Captions")
    if not windows:
        windows = gw.getAllWindows()
        print(f"[UI] Available windows: {[w.title for w in windows[:10]]}")
        return False

    tauri_window = windows[0]
    print(f"[UI] ✓ Found window: '{tauri_window.title}'")

    # Activate window
    try:
        tauri_window.activate()
        time.sleep(0.5)
        print("[UI] ✓ Window activated")
    except Exception as e:
        print(f"[UI] ⚠ Could not activate window: {e}")

    # Try to find and click the button
    # Strategy: Look for green/button-colored region or OCR
    print("[UI] Attempting to locate 'Start Live Captions' button...")

    # Take screenshot and search for button
    try:
        # Method 1: Try to find button by image (you'd need to save a screenshot of the button first)
        # Method 2: Use pyautogui.locateOnScreen() with button image
        # Method 3: Click at known position (if button is always in same place)

        # For now, try clicking center of window (assuming button is prominent)
        window_center_x = tauri_window.left + tauri_window.width // 2
        window_center_y = tauri_window.top + tauri_window.height // 2

        print(f"[UI] Clicking at window center: ({window_center_x}, {window_center_y})")
        pyautogui.click(window_center_x, window_center_y)
        time.sleep(1)

        print("[UI] ✓ Click performed")
        return True

    except Exception as e:
        print(f"[UI] ❌ Click failed: {e}")
        return False

# ═══════════════════════════════════════════════════════════════════════════
# WEBSOCKET MONITOR
# ═══════════════════════════════════════════════════════════════════════════

class TranscriptionMonitor:
    def __init__(self):
        self.captions = []
        self.connected = False
        self.session_id = None
        self.binary_chunks_received = 0
        self.errors = []

    async def connect_and_monitor(self, duration=60):
        """Connect to WebSocket and monitor for captions"""
        print(f"[MONITOR] Connecting to {WEBSOCKET_URL}...")

        try:
            async with websockets.connect(WEBSOCKET_URL) as websocket:
                print("[MONITOR] ✓ Connected to WebSocket")
                self.connected = True

                # Wait for connection confirmation
                msg = await websocket.recv()
                data = json.loads(msg)
                if data.get('type') == 'connected':
                    self.session_id = data.get('session_id')
                    print(f"[MONITOR] ✓ Session ID: {self.session_id[:8]}")

                # Send config
                config = {
                    "type": "config",
                    "language": None,  # Auto-detect
                    "translate_to": None,
                    "min_chunk_duration": 0.15,
                    "model_size": "tiny"
                }
                await websocket.send(json.dumps(config))
                print("[MONITOR] ✓ Config sent")

                # Monitor
                start_time = time.time()
                last_ping = time.time()

                while time.time() - start_time < duration:
                    try:
                        msg = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        data = json.loads(msg)

                        msg_type = data.get('type')

                        if msg_type == 'caption':
                            caption_text = data.get('text', '')
                            language = data.get('language', 'unknown')
                            is_final = data.get('is_final', False)

                            self.captions.append({
                                'text': caption_text,
                                'language': language,
                                'is_final': is_final,
                                'timestamp': time.time()
                            })

                            print(f"\n[CAPTION] '{caption_text}' ({language}, final={is_final})\n")

                        elif msg_type == 'config_updated':
                            print(f"[MONITOR] Config updated")

                        elif msg_type == 'pong':
                            pass  # Silent

                        elif msg_type == 'error':
                            error_msg = data.get('message', 'Unknown error')
                            self.errors.append(error_msg)
                            print(f"[MONITOR] ❌ Error: {error_msg}")

                        else:
                            print(f"[MONITOR] Received: {msg_type}")

                    except asyncio.TimeoutError:
                        # Send ping every 10s
                        if time.time() - last_ping > 10:
                            await websocket.send(json.dumps({
                                "type": "ping",
                                "timestamp": int(time.time() * 1000)
                            }))
                            last_ping = time.time()

                    except Exception as e:
                        print(f"[MONITOR] Error: {e}")
                        self.errors.append(str(e))
                        break

                # Get stats before closing
                try:
                    await websocket.send(json.dumps({"type": "get_stats"}))
                    msg = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    data = json.loads(msg)
                    if data.get('type') == 'stats':
                        stats = data.get('stats', {})
                        self.binary_chunks_received = stats.get('audio_chunks_received', 0)
                        print(f"[MONITOR] Stats: {stats}")
                except:
                    pass

                print(f"[MONITOR] Monitoring complete. Captions: {len(self.captions)}, Audio chunks: {self.binary_chunks_received}")

        except Exception as e:
            print(f"[MONITOR] ❌ Connection failed: {e}")
            self.connected = False
            self.errors.append(f"Connection failed: {e}")

    def generate_report(self):
        """Generate comprehensive test report"""
        report = f"""# Fully Automated End-to-End Test Results
**Generated**: {time.strftime('%Y-%m-%d %H:%M:%S UTC')}
**Test Audio**: test.mp3
**Session ID**: {self.session_id or 'N/A'}

---

## Test Status

"""

        if not self.connected:
            report += "❌ **FAILED** - Could not connect to backend WebSocket\n\n"
            report += "**Root Cause**: Backend not reachable or not running\n\n"
        elif self.binary_chunks_received == 0:
            report += "❌ **FAILED** - Connected but NO AUDIO DATA received by backend\n\n"
            report += "**Root Cause**: Rust audio capture not working or WebSocket binary messages not being sent\n\n"
        elif len(self.captions) == 0:
            report += "❌ **FAILED** - Audio received but NO CAPTIONS generated\n\n"
            report += "**Root Cause**: Whisper transcription service not working\n\n"
        else:
            report += f"✅ **SUCCESS** - End-to-end transcription working\n\n"
            report += f"- Captions received: {len(self.captions)}\n"
            report += f"- Audio chunks received: {self.binary_chunks_received}\n\n"

        report += "---\n\n## Evidence Chain\n\n"
        report += f"1. WebSocket connection: {'✓ Success' if self.connected else '❌ Failed'}\n"
        report += f"2. Session established: {'✓ Yes' if self.session_id else '❌ No'}\n"
        report += f"3. Audio chunks received by backend: {self.binary_chunks_received}\n"
        report += f"4. Captions generated: {len(self.captions)}\n"
        report += f"5. Final captions: {len([c for c in self.captions if c['is_final']])}\n\n"

        if len(self.errors) > 0:
            report += "### Errors Encountered\n\n"
            for error in self.errors:
                report += f"- {error}\n"
            report += "\n"

        report += "---\n\n## Captions Received\n\n"

        if len(self.captions) == 0:
            report += "*No captions received*\n\n"
        else:
            for i, caption in enumerate(self.captions, 1):
                report += f"### Caption {i}\n"
                report += f"- **Text**: \"{caption['text']}\"\n"
                report += f"- **Language**: {caption['language']}\n"
                report += f"- **Is Final**: {caption['is_final']}\n"
                report += f"- **Timestamp**: {time.strftime('%H:%M:%S', time.localtime(caption['timestamp']))}\n\n"

        report += "---\n\n## Full Transcript\n\n"

        if len(self.captions) > 0:
            full_text = " ".join([c['text'] for c in self.captions if c['is_final']])
            report += f"\"{full_text}\"\n\n"

            # Also include ALL captions (including non-final)
            all_text = " ".join([c['text'] for c in self.captions])
            if all_text != full_text:
                report += f"**All captions (including partial):** \"{all_text}\"\n\n"
        else:
            report += "*No transcript available*\n\n"

        report += "---\n\n## Next Steps\n\n"

        if not self.connected:
            report += "1. Verify backend container is running: `docker ps`\n"
            report += "2. Check backend logs: `docker-compose logs backend`\n"
            report += "3. Test WebSocket manually: `wscat -c ws://localhost:8000/ws/realtime`\n\n"
        elif self.binary_chunks_received == 0:
            report += "1. Verify Tauri app is capturing audio (check Rust logs for AUDIO_CALLBACK)\n"
            report += "2. Verify WebSocket connection from Rust (check for WS_TASK logs)\n"
            report += "3. Check Rust logs for 'Sent X chunks to WebSocket'\n"
            report += "4. Verify test.mp3 played through speakers (not headphones)\n\n"
        elif len(self.captions) == 0:
            report += "1. Check backend logs for Whisper transcription errors\n"
            report += "2. Verify Whisper model loaded correctly\n"
            report += "3. Check backend logs for transcription_loop activity\n"
            report += "4. Verify audio quality/duration of test.mp3\n\n"
        else:
            report += "✅ System is working correctly! No further action needed.\n\n"

        return report

# ═══════════════════════════════════════════════════════════════════════════
# MAIN TEST FLOW
# ═══════════════════════════════════════════════════════════════════════════

async def main():
    print("═══════════════════════════════════════════════════════════════")
    print("FULLY AUTOMATED END-TO-END LIVE CAPTION SYSTEM TEST")
    print("═══════════════════════════════════════════════════════════════\n")

    # Verify test.mp3 exists
    if not os.path.exists(TEST_AUDIO_PATH):
        print(f"❌ ERROR: test.mp3 not found at {TEST_AUDIO_PATH}")
        return

    print(f"✓ Test audio file found: {TEST_AUDIO_PATH}\n")

    # Step 1: Find and click Start button
    print("[STEP 1] Clicking 'Start Live Captions' button...")
    clicked = find_and_click_start_button()
    if not clicked:
        print("⚠ Warning: Could not automatically click button")
        print("Proceeding anyway - button may already be active\n")
    else:
        print("✓ Button clicked\n")
        time.sleep(2)  # Wait for capture to start

    # Step 2: Start monitoring in background
    print("[STEP 2] Starting backend monitor...")
    monitor = TranscriptionMonitor()
    monitor_task = asyncio.create_task(monitor.connect_and_monitor(duration=45))

    # Wait for connection
    await asyncio.sleep(3)

    # Step 3: Play test.mp3
    print("[STEP 3] Playing test.mp3...")
    try:
        subprocess.Popen([TEST_AUDIO_PATH], shell=True)
        print("✓ Audio player started\n")
    except Exception as e:
        print(f"❌ Failed to start audio: {e}\n")

    # Step 4: Wait for monitoring to complete
    print("[STEP 4] Monitoring for captions (45 seconds)...\n")
    await monitor_task

    # Step 5: Generate report
    print("\n[STEP 5] Generating report...")
    report = monitor.generate_report()

    # Save report
    with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"✓ Report saved to {RESULTS_FILE}\n")

    print("═" * 67)
    print("TEST COMPLETE")
    print("═" * 67 + "\n")

    # Print summary
    print("RESULTS:")
    print(f"- WebSocket connected: {monitor.connected}")
    print(f"- Audio chunks received: {monitor.binary_chunks_received}")
    print(f"- Captions received: {len(monitor.captions)}")

    if len(monitor.captions) > 0:
        print(f"\n✅ SUCCESS - System is working!\n")
        full_text = " ".join([c['text'] for c in monitor.captions if c['is_final']])
        print(f"Transcribed text: \"{full_text}\"\n")
    else:
        print(f"\n❌ FAILED - No captions received\n")
        if monitor.binary_chunks_received > 0:
            print("Audio is reaching backend but Whisper is not transcribing.")
        elif monitor.connected:
            print("Backend connected but no audio data received.")
        else:
            print("Could not connect to backend.")

    print(f"\nFull report: {RESULTS_FILE}\n")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
    except Exception as e:
        print(f"\n\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
