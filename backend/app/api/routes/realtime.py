"""
═══════════════════════════════════════════════════════════════════════════
REAL-TIME TRANSCRIPTION WEBSOCKET ENDPOINT
═══════════════════════════════════════════════════════════════════════════

WebSocket endpoint for streaming real-time transcription:
- Receives audio chunks from browser (Float32Array from Web Audio API)
- Processes audio with RealtimeTranscriptionService
- Streams transcription results back in real-time
- Optional: Real-time translation integration

Protocol:
1. Client connects: WS /ws/realtime
2. Client sends config: {"type": "config", "language": "en", "translate_to": "es"}
3. Client streams audio: Binary frames (Float32Array as bytes)
4. Server sends captions: {"type": "caption", "text": "...", "language": "en"}
5. Server sends translations: {"type": "translation", "text": "...", "language": "es"}
"""

import asyncio
import json
import logging
import time
import uuid
import struct
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import numpy as np

from app.services.realtime_transcription_service import (
    get_realtime_service,
    AudioBuffer,
    RealtimeSegment
)
from app.services.translation_service import get_translation_service

logger = logging.getLogger(__name__)
router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════
# ACTIVE SESSION TRACKING
# ═══════════════════════════════════════════════════════════════════════════

active_realtime_sessions: Dict[str, dict] = {}


# ═══════════════════════════════════════════════════════════════════════════
# WEBSOCKET ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@router.websocket("/ws/realtime")
async def realtime_transcription_websocket(websocket: WebSocket):
    """
    Real-time transcription WebSocket endpoint.

    Handles streaming audio from browser microphone and returns
    real-time transcription results.
    """
    session_id = str(uuid.uuid4())
    logger.info(f"[Realtime {session_id[:8]}] New connection request")

    # Accept connection
    try:
        await websocket.accept()
        logger.info(f"[Realtime {session_id[:8]}] Connection accepted")
    except Exception as e:
        logger.error(f"[Realtime {session_id[:8]}] Failed to accept connection: {e}")
        return

    # Initialize session
    audio_buffer = AudioBuffer(sample_rate=16000, max_duration=30.0)
    transcription_service = get_realtime_service()

    session_info = {
        "session_id": session_id,
        "connected_at": time.time(),
        "audio_buffer": audio_buffer,
        "config": {
            "language": None,  # Auto-detect by default
            "translate_to": None,
            "min_chunk_duration": 0.15,  # Minimum 0.15s to capture single short words
            "model_size": "tiny",  # Default to tiny (realtime mode)
        },
        "stats": {
            "audio_chunks_received": 0,
            "transcriptions_sent": 0,
            "total_audio_duration": 0.0,
        }
    }

    active_realtime_sessions[session_id] = session_info

    # Send connection confirmation WITH CURRENT MODEL INFO
    try:
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "timestamp": int(time.time() * 1000),
            "config": {
                "sample_rate": 16000,
                "min_chunk_duration": session_info["config"]["min_chunk_duration"]
            },
            # 🎯 DEBUG: Include actual model info on connection
            "model_info": {
                "model_size": transcription_service.model_size,
                "device": transcription_service.device,
                "compute_type": transcription_service.compute_type,
            }
        })
    except Exception as e:
        logger.error(f"[Realtime {session_id[:8]}] Failed to send confirmation: {e}")
        cleanup_session(session_id)
        return

    # Transcription task
    transcription_task = None

    try:
        # Start background transcription loop
        transcription_task = asyncio.create_task(
            transcription_loop(websocket, session_id, transcription_service, audio_buffer, session_info)
        )

        # ───────────────────────────────────────────────────────────────────
        # MAIN MESSAGE LOOP
        # ───────────────────────────────────────────────────────────────────
        while True:
            try:
                message_data = await asyncio.wait_for(
                    websocket.receive(),
                    timeout=60.0  # 60s timeout
                )

                # Log EVERYTHING about the received message
                logger.info(f"[Realtime {session_id[:8]}] ─── MESSAGE RECEIVED ───")
                logger.info(f"[Realtime {session_id[:8]}] message_data type: {type(message_data)}")
                logger.info(f"[Realtime {session_id[:8]}] message_data keys: {list(message_data.keys())}")
                logger.info(f"[Realtime {session_id[:8]}] message_data content: {str(message_data)[:200]}")

                if 'bytes' in message_data:
                    bytes_data = message_data.get('bytes')
                    logger.info(f"[Realtime {session_id[:8]}] ✓ BINARY message: {len(bytes_data) if bytes_data else 0} bytes")
                if 'text' in message_data:
                    text_data = message_data.get('text')
                    logger.info(f"[Realtime {session_id[:8]}] TEXT message: {len(text_data) if text_data else 0} chars")

                # ═══════════════════════════════════════════════════════════
                # HANDLE AUDIO DATA (Binary)
                # ═══════════════════════════════════════════════════════════
                if 'bytes' in message_data and message_data['bytes'] is not None:
                    await handle_audio_data(
                        websocket,
                        session_id,
                        message_data['bytes'],
                        audio_buffer,
                        session_info
                    )

                # ═══════════════════════════════════════════════════════════
                # HANDLE JSON MESSAGES (Config, Ping, etc.)
                # ═══════════════════════════════════════════════════════════
                elif 'text' in message_data and message_data['text'] is not None:
                    await handle_text_message(
                        websocket,
                        session_id,
                        message_data['text'],
                        session_info
                    )

            except asyncio.TimeoutError:
                # No message for 60s - send ping
                try:
                    await websocket.send_json({
                        "type": "ping",
                        "timestamp": int(time.time() * 1000)
                    })
                except:
                    logger.warning(f"[Realtime {session_id[:8]}] Ping failed, closing")
                    break

            except WebSocketDisconnect:
                logger.info(f"[Realtime {session_id[:8]}] Client disconnected")
                break

            except Exception as e:
                logger.error(f"[Realtime {session_id[:8]}] Message handling error: {e}")
                break

    except Exception as e:
        logger.error(f"[Realtime {session_id[:8]}] Fatal error: {e}", exc_info=True)

    finally:
        # Cancel transcription task
        if transcription_task:
            transcription_task.cancel()
            try:
                await transcription_task
            except asyncio.CancelledError:
                pass

        # Cleanup
        cleanup_session(session_id)
        logger.info(f"[Realtime {session_id[:8]}] Session ended")


# ═══════════════════════════════════════════════════════════════════════════
# MESSAGE HANDLERS
# ═══════════════════════════════════════════════════════════════════════════

async def handle_audio_data(
    websocket: WebSocket,
    session_id: str,
    audio_bytes: bytes,
    audio_buffer: AudioBuffer,
    session_info: dict
):
    """Handle incoming audio data from browser"""
    try:
        # Convert bytes to Float32Array
        # Browser sends Float32Array as raw bytes (little-endian)
        num_samples = len(audio_bytes) // 4  # 4 bytes per float32
        audio_array = np.frombuffer(audio_bytes, dtype=np.float32)

        # Validate audio
        if len(audio_array) == 0:
            logger.warning(f"[Realtime {session_id[:8]}] Empty audio chunk received")
            return

        # Add to buffer
        audio_buffer.append(audio_array)

        # Update stats
        session_info["stats"]["audio_chunks_received"] += 1

        # Log every 10th chunk
        if session_info["stats"]["audio_chunks_received"] % 10 == 0:
            logger.info(f"[Realtime {session_id[:8]}] ✓ Received {session_info['stats']['audio_chunks_received']} audio chunks ({len(audio_array)} samples)")
        duration = len(audio_array) / 16000  # 16kHz sample rate
        session_info["stats"]["total_audio_duration"] += duration

        logger.debug(
            f"[Realtime {session_id[:8]}] Audio chunk: {num_samples} samples "
            f"({duration:.2f}s) | Buffer: {audio_buffer.get_duration():.2f}s"
        )

    except Exception as e:
        logger.error(f"[Realtime {session_id[:8]}] Audio handling error: {e}")


async def handle_text_message(
    websocket: WebSocket,
    session_id: str,
    text_data: str,
    session_info: dict
):
    """Handle JSON text messages (config, ping, etc.)"""
    try:
        message = json.loads(text_data)
        message_type = message.get('type', 'unknown')

        logger.debug(f"[Realtime {session_id[:8]}] JSON message: {message_type}")

        # ───────────────────────────────────────────────────────────────────
        # CONFIG - Update transcription settings
        # ───────────────────────────────────────────────────────────────────
        if message_type == 'config':
            if 'language' in message:
                session_info["config"]["language"] = message['language']
            if 'translate_to' in message:
                session_info["config"]["translate_to"] = message['translate_to']
            if 'min_chunk_duration' in message:
                session_info["config"]["min_chunk_duration"] = float(message['min_chunk_duration'])

            # Handle model size in config
            # NOTE: Hot-swap is DISABLED - it causes connection instability.
            # Model changes should happen via clean restart (stop capture → start with new model).
            # We just record what model the client requested, but use whatever model is loaded.
            if 'model_size' in message:
                requested_model = message['model_size']
                transcription_service = get_realtime_service()
                current_model = transcription_service.model_size

                # Just log the request, don't actually switch
                if requested_model != current_model:
                    logger.info(
                        f"[Realtime {session_id[:8]}] Client requested model '{requested_model}', "
                        f"but using current model '{current_model}' (hot-swap disabled for stability)"
                    )
                    # Inform client which model is actually being used
                    await websocket.send_json({
                        "type": "model_info",
                        "requested_model": requested_model,
                        "actual_model": current_model,
                        "message": f"Using '{current_model}' model. To switch models, stop and restart capture.",
                        "timestamp": int(time.time() * 1000)
                    })

                # Record the actual model being used (not the requested one)
                session_info["config"]["model_size"] = current_model

            logger.info(
                f"[Realtime {session_id[:8]}] Config updated: {session_info['config']}"
            )

            await websocket.send_json({
                "type": "config_updated",
                "config": session_info["config"]
            })

        # ───────────────────────────────────────────────────────────────────
        # PING - Heartbeat
        # ───────────────────────────────────────────────────────────────────
        elif message_type == 'ping':
            await websocket.send_json({
                "type": "pong",
                "timestamp": int(time.time() * 1000),
                "client_timestamp": message.get('timestamp')
            })

        # ───────────────────────────────────────────────────────────────────
        # STATS - Get session statistics
        # ───────────────────────────────────────────────────────────────────
        elif message_type == 'get_stats':
            uptime = time.time() - session_info["connected_at"]
            stats = {
                **session_info["stats"],
                "uptime_seconds": uptime,
                "buffer_duration": session_info["audio_buffer"].get_duration()
            }
            await websocket.send_json({
                "type": "stats",
                "stats": stats
            })

        # ───────────────────────────────────────────────────────────────────
        # GET_MODEL_INFO - Query actual model being used (for debugging)
        # ───────────────────────────────────────────────────────────────────
        elif message_type == 'get_model_info':
            transcription_service = get_realtime_service()
            await websocket.send_json({
                "type": "model_info",
                "model_size": transcription_service.model_size,
                "device": transcription_service.device,
                "compute_type": transcription_service.compute_type,
                "config_model_size": session_info["config"]["model_size"],  # What config thinks
                "is_switching": transcription_service._is_switching,
                "timestamp": int(time.time() * 1000)
            })
            logger.info(f"[Realtime {session_id[:8]}] 🎯 Model info requested: actual='{transcription_service.model_size}', config='{session_info['config']['model_size']}'")

        else:
            logger.debug(f"[Realtime {session_id[:8]}] Unknown message type: {message_type}")

    except json.JSONDecodeError as e:
        logger.warning(f"[Realtime {session_id[:8]}] Invalid JSON: {e}")
    except Exception as e:
        logger.error(f"[Realtime {session_id[:8]}] Text handler error: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# BACKGROUND TRANSCRIPTION LOOP
# ═══════════════════════════════════════════════════════════════════════════

async def transcription_loop(
    websocket: WebSocket,
    session_id: str,
    transcription_service,
    audio_buffer: AudioBuffer,
    session_info: dict
):
    """
    Background task that periodically transcribes audio buffer.
    Runs independently from audio ingestion.

    CRASH RECOVERY: Inner try/except allows loop to continue after individual errors.
    """
    try:
        logger.info(f"[Realtime {session_id[:8]}] ═══ TRANSCRIPTION LOOP STARTING ═══")
        logger.info(f"[Realtime {session_id[:8]}] transcription_service type: {type(transcription_service)}")
        logger.info(f"[Realtime {session_id[:8]}] audio_buffer type: {type(audio_buffer)}")
    except Exception as e:
        logger.error(f"[Realtime {session_id[:8]}] ERROR IN LOOP INIT: {e}", exc_info=True)

    last_transcription_time = time.time()
    max_chunk_duration = 2.0  # Maximum seconds before forcing transcription (reduced from 10s for faster captions)
    consecutive_errors = 0  # Track consecutive errors for exponential backoff

    while True:
        try:
            # Check very frequently for speech end (ultra-responsive)
            await asyncio.sleep(0.1)  # Check every 100ms

            # Get configured minimum duration
            min_duration = session_info["config"]["min_chunk_duration"]

            # Check if enough audio accumulated
            current_duration = audio_buffer.get_duration()
            if current_duration < min_duration:
                logger.debug(f"[Realtime {session_id[:8]}] Not enough audio: {current_duration:.2f}s < {min_duration}s")
                continue

            # Time since last transcription
            time_since_last = time.time() - last_transcription_time

            # Trigger transcription if:
            # 1. Speech has ended (user stopped talking)
            # 2. OR it's been too long since last transcription (prevent buffering too much)
            speech_ended = audio_buffer.has_speech_ended()
            timeout_reached = time_since_last >= max_chunk_duration
            should_transcribe = speech_ended or timeout_reached

            logger.info(f"[Realtime {session_id[:8]}] Transcription check: duration={current_duration:.2f}s, time_since_last={time_since_last:.2f}s, speech_ended={speech_ended}, timeout_reached={timeout_reached}, should_transcribe={should_transcribe}")

            if not should_transcribe:
                continue

            # Get NEW audio for transcription (only untranscribed audio)
            audio = audio_buffer.get_audio_for_transcription()
            if audio is None:
                continue

            # Transcribe
            language = session_info["config"]["language"]

            # Get ACTUAL model info from service (not config - this is the REAL model)
            actual_model_size = transcription_service.model_size
            actual_device = transcription_service.device

            logger.info(f"[Realtime {session_id[:8]}] 🎯 TRANSCRIBING with model='{actual_model_size}' on device='{actual_device}'")

            segments = await transcription_service.transcribe_chunk(audio, language=language)

            # Update last transcription time
            last_transcription_time = time.time()

            # Reset error counter on success
            consecutive_errors = 0

            # Send results WITH MODEL INFO for debugging
            for segment in segments:
                try:
                    await websocket.send_json({
                        "type": "caption",
                        "text": segment.text,
                        "language": segment.language,
                        "start": segment.start,
                        "end": segment.end,
                        "is_final": segment.is_final,
                        "timestamp": int(time.time() * 1000),
                        # 🎯 DEBUG: Include actual model info in every caption
                        "model_info": {
                            "model_size": actual_model_size,
                            "device": actual_device,
                        }
                    })

                    session_info["stats"]["transcriptions_sent"] += 1

                    logger.info(
                        f"[Realtime {session_id[:8]}] Caption sent: \"{segment.text}\" ({segment.language}) [model={actual_model_size}]"
                    )

                    # Optional: Translation with NLLB-200
                    translate_to = session_info["config"]["translate_to"]
                    if translate_to and translate_to != segment.language:
                        try:
                            # Lazy load translation service (only when needed)
                            translation_service = get_translation_service()

                            # Translate caption to target language
                            translation = await translation_service.translate(
                                text=segment.text,
                                source_lang=segment.language,
                                target_lang=translate_to
                            )

                            if translation:
                                await websocket.send_json({
                                    "type": "translation",
                                    "text": translation,
                                    "language": translate_to,
                                    "original_text": segment.text,
                                    "original_language": segment.language,
                                    "timestamp": int(time.time() * 1000)
                                })

                                logger.info(
                                    f"[Realtime {session_id[:8]}] Translation sent: "
                                    f"\"{segment.text}\" → \"{translation}\" ({segment.language}→{translate_to})"
                                )
                        except Exception as e:
                            logger.error(f"[Realtime {session_id[:8]}] Translation failed: {e}")

                except Exception as e:
                    logger.error(f"[Realtime {session_id[:8]}] Failed to send caption: {e}")

            # Mark audio as transcribed and reset speech detection state
            audio_buffer.mark_transcribed(len(audio))
            audio_buffer.reset_speech_state()

        except asyncio.CancelledError:
            logger.info(f"[Realtime {session_id[:8]}] Transcription loop cancelled")
            break  # Exit cleanly on cancellation

        except Exception as e:
            # CRASH RECOVERY: Log error and continue loop instead of terminating
            consecutive_errors += 1
            logger.error(
                f"[Realtime {session_id[:8]}] Transcription iteration error #{consecutive_errors}: {e}",
                exc_info=True
            )

            # Exponential backoff: wait longer after repeated failures
            backoff_time = min(1.0 * (2 ** consecutive_errors), 10.0)  # Max 10 seconds
            logger.warning(f"[Realtime {session_id[:8]}] Backing off for {backoff_time:.1f}s before retry...")
            await asyncio.sleep(backoff_time)

            # After 5 consecutive errors, try to clear CUDA cache (might help with memory issues)
            if consecutive_errors == 5:
                try:
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                        logger.info(f"[Realtime {session_id[:8]}] Cleared CUDA cache after 5 consecutive errors")
                except Exception:
                    pass

            # After 10 consecutive errors, give up (something is seriously wrong)
            if consecutive_errors >= 10:
                logger.error(f"[Realtime {session_id[:8]}] Too many consecutive errors ({consecutive_errors}), stopping loop")
                break

            # Continue the loop - don't crash!


# ═══════════════════════════════════════════════════════════════════════════
# SESSION CLEANUP
# ═══════════════════════════════════════════════════════════════════════════

def cleanup_session(session_id: str):
    """Clean up session resources"""
    if session_id in active_realtime_sessions:
        session_info = active_realtime_sessions[session_id]
        uptime = time.time() - session_info["connected_at"]

        logger.info(
            f"[Realtime {session_id[:8]}] Session stats: "
            f"uptime={uptime:.1f}s, "
            f"audio_chunks={session_info['stats']['audio_chunks_received']}, "
            f"transcriptions={session_info['stats']['transcriptions_sent']}, "
            f"total_audio={session_info['stats']['total_audio_duration']:.1f}s"
        )

        # Clear buffer
        session_info["audio_buffer"].clear()

        del active_realtime_sessions[session_id]

    logger.info(f"[Realtime] Active sessions: {len(active_realtime_sessions)}")
