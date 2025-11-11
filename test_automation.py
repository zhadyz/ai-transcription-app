"""
Automated End-to-End Testing Script for Live Caption System
Plays test.mp3 and monitors the complete transcription pipeline
"""
import asyncio
import websockets
import json
import time
import subprocess
import sys
import os
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

WEBSOCKET_URL = "ws://localhost:8000/ws/realtime"
TEST_AUDIO_PATH = r"C:\Users\eclip\Desktop\Bari 2025 Portfolio\Transcription\V1.5\transcription-app\test.mp3"
RESULTS_FILE = r"C:\Users\eclip\Desktop\Bari 2025 Portfolio\Transcription\V1.5\transcription-app\TEST_RESULTS.md"

# ═══════════════════════════════════════════════════════════════════════════
# WEBSOCKET CLIENT - Monitor Backend for Captions
# ═══════════════════════════════════════════════════════════════════════════

class TranscriptionMonitor:
    def __init__(self):
        self.captions = []
        self.connected = False
        self.session_id = None

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

                # Send config (auto-detect language)
                config = {
                    "type": "config",
                    "language": None,  # Auto-detect
                    "translate_to": None,
                    "min_chunk_duration": 0.15,
                    "model_size": "tiny"
                }
                await websocket.send(json.dumps(config))
                print("[MONITOR] ✓ Config sent")

                # Monitor for captions
                start_time = time.time()
                print(f"[MONITOR] Monitoring for {duration}s...")

                while time.time() - start_time < duration:
                    try:
                        msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        data = json.loads(msg)

                        if data.get('type') == 'caption':
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

                        elif data.get('type') == 'config_updated':
                            print(f"[MONITOR] Config updated: {data.get('config')}")

                        elif data.get('type') == 'pong':
                            print("[MONITOR] Pong received")

                        else:
                            print(f"[MONITOR] Received: {data.get('type')}")

                    except asyncio.TimeoutError:
                        # Send ping
                        await websocket.send(json.dumps({
                            "type": "ping",
                            "timestamp": int(time.time() * 1000)
                        }))

                    except Exception as e:
                        print(f"[MONITOR] Error receiving message: {e}")
                        break

                print(f"[MONITOR] Monitoring complete. Captured {len(self.captions)} captions.")

        except Exception as e:
            print(f"[MONITOR] ❌ Connection failed: {e}")
            self.connected = False

    def generate_report(self):
        """Generate test results report"""
        report = f"""# Automated End-to-End Test Results
**Generated**: {time.strftime('%Y-%m-%d %H:%M:%S UTC')}
**Test Audio**: test.mp3
**Session ID**: {self.session_id or 'N/A'}

---

## Test Status

"""

        if not self.connected:
            report += "❌ **FAILED** - Could not connect to backend WebSocket\n\n"
        elif len(self.captions) == 0:
            report += "❌ **FAILED** - Connected but received NO captions\n\n"
        else:
            report += f"✅ **SUCCESS** - Received {len(self.captions)} captions\n\n"

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
        else:
            report += "*No transcript available*\n\n"

        report += "---\n\n## Evidence\n\n"
        report += f"- WebSocket connection: {'✓ Success' if self.connected else '❌ Failed'}\n"
        report += f"- Session established: {'✓ Yes' if self.session_id else '❌ No'}\n"
        report += f"- Captions received: {len(self.captions)}\n"
        report += f"- Final captions: {len([c for c in self.captions if c['is_final']])}\n"

        return report

# ═══════════════════════════════════════════════════════════════════════════
# MAIN TEST FLOW
# ═══════════════════════════════════════════════════════════════════════════

async def main():
    print("═══════════════════════════════════════════════════════════════")
    print("AUTOMATED END-TO-END LIVE CAPTION SYSTEM TEST")
    print("═══════════════════════════════════════════════════════════════\n")

    # Verify test.mp3 exists
    if not os.path.exists(TEST_AUDIO_PATH):
        print(f"❌ ERROR: test.mp3 not found at {TEST_AUDIO_PATH}")
        return

    print(f"✓ Test audio file found: {TEST_AUDIO_PATH}\n")

    # Create monitor
    monitor = TranscriptionMonitor()

    # Instructions for manual steps
    print("═══════════════════════════════════════════════════════════════")
    print("MANUAL STEPS REQUIRED:")
    print("═══════════════════════════════════════════════════════════════")
    print("1. Ensure Tauri app is running")
    print("2. Click 'Start Live Captions' button in the app")
    print("3. Play test.mp3 through speakers (will auto-start)")
    print("\nPress ENTER when you've clicked 'Start Live Captions'...")
    input()

    print("\n[TEST] Starting test in 3 seconds...")
    await asyncio.sleep(3)

    # Play test.mp3 in background
    print(f"[TEST] Playing {TEST_AUDIO_PATH}...")
    try:
        subprocess.Popen([TEST_AUDIO_PATH], shell=True)
        print("[TEST] ✓ Audio player started")
    except Exception as e:
        print(f"[TEST] ❌ Failed to start audio: {e}")

    # Monitor for 60 seconds
    await monitor.connect_and_monitor(duration=60)

    # Generate report
    print("\n[TEST] Generating report...")
    report = monitor.generate_report()

    # Save report
    with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"[TEST] ✓ Report saved to {RESULTS_FILE}")
    print("\n" + "═" * 67)
    print("TEST COMPLETE")
    print("═" * 67 + "\n")

    # Print summary
    if len(monitor.captions) > 0:
        print(f"✅ SUCCESS - Captured {len(monitor.captions)} captions")
        print(f"\nFull transcript:")
        full_text = " ".join([c['text'] for c in monitor.captions if c['is_final']])
        print(f"\"{full_text}\"")
    else:
        print("❌ FAILED - No captions received")
        print("\nCheck:")
        print("- Is the Tauri app running?")
        print("- Did you click 'Start Live Captions'?")
        print("- Is test.mp3 playing through speakers?")
        print("- Check backend logs for errors")

if __name__ == "__main__":
    asyncio.run(main())
