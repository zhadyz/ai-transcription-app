"""
Simple WebSocket test to verify binary message reception
"""
import asyncio
import websockets
import struct
import numpy as np

async def test_realtime_websocket():
    uri = "ws://localhost:8000/ws/realtime"

    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as websocket:
        print("[OK] Connected")

        # Wait for connection confirmation
        response = await websocket.recv()
        print(f"[OK] Received: {response}")

        # Send config
        config = {
            "type": "config",
            "language": "en",
            "model_size": "tiny"
        }
        await websocket.send(str(config).replace("'", '"'))
        print("[OK] Sent config")

        # Wait for config confirmation
        response = await websocket.recv()
        print(f"[OK] Config response: {response}")

        # Generate test audio (1 second of silence at 16kHz)
        sample_rate = 16000
        duration = 1.0  # seconds
        num_samples = int(sample_rate * duration)
        audio = np.zeros(num_samples, dtype=np.float32)

        print(f"\nSending {num_samples} samples as binary...")

        # Convert to bytes (little-endian Float32)
        audio_bytes = audio.tobytes()
        print(f"  Audio bytes length: {len(audio_bytes)}")

        # Send as binary WebSocket message
        await websocket.send(audio_bytes)
        print("[OK] Binary message sent!")

        # Wait a bit for processing
        print("\nWaiting for transcription response...")
        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"[OK] Received: {response}")
        except asyncio.TimeoutError:
            print("  (No response within 5s - this is OK for silence)")

        print("\nTest complete!")

if __name__ == "__main__":
    asyncio.run(test_realtime_websocket())
