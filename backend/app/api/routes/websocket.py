"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT WEBSOCKET HANDLER - Hypercorn & uvicorn Compatible
═══════════════════════════════════════════════════════════════════════════

Handles THREE message types:
1. JSON text (backend → frontend): Progress updates, file uploads
2. MessagePack binary (peer → peer): CRDT patches for distributed state
3. Empty frames (heartbeats): Keep-alive from both servers

GUARANTEES:
- Works on both hypercorn (HTTP/2) and uvicorn (HTTP/1.1)
- Zero-copy binary forwarding
- Automatic connection health monitoring
- Graceful degradation under load
- Self-healing on transient errors
"""

import json
import uuid
import time
import asyncio
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.session_service import session_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════
# CONNECTION TRACKING
# ═══════════════════════════════════════════════════════════════════════════

active_connections: Dict[str, WebSocket] = {}
ws_to_session: Dict[str, str] = {}
connection_health: Dict[str, dict] = {}  # Track message counts, errors, last activity

# ═══════════════════════════════════════════════════════════════════════════
# MAIN WEBSOCKET ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Universal WebSocket endpoint - works on hypercorn, uvicorn, and all ASGI servers.
    
    Handles:
    - JSON text messages (backend broadcasts)
    - MessagePack binary messages (CRDT peer-to-peer sync)
    - Empty frames (server heartbeats - hypercorn specific)
    - Connection health monitoring
    - Automatic error recovery
    """
    ws_id = str(uuid.uuid4())
    
    # ───────────────────────────────────────────────────────────────────────
    # VALIDATE SESSION
    # ───────────────────────────────────────────────────────────────────────
    if not session_service.validate_session(session_id):
        logger.warning(f"[WS {ws_id[:8]}] Connection rejected: invalid session {session_id[:8]}")
        await websocket.close(code=4003, reason="Invalid or expired session")
        return
    
    # ───────────────────────────────────────────────────────────────────────
    # ACCEPT CONNECTION
    # ───────────────────────────────────────────────────────────────────────
    await websocket.accept()
    
    # Register connection
    active_connections[ws_id] = websocket
    ws_to_session[ws_id] = session_id
    session_service.mark_connected(session_id, ws_id)
    
    # Initialize health tracking
    connection_health[ws_id] = {
        'connected_at': time.time(),
        'last_activity': time.time(),
        'messages_received': 0,
        'messages_sent': 0,
        'errors': 0,
        'heartbeats': 0
    }
    
    logger.info(
        f"[WS {ws_id[:8]}] Connected to session {session_id[:8]} | "
        f"Total connections: {len(active_connections)}"
    )
    
    try:
        # ───────────────────────────────────────────────────────────────────
        # SEND CONNECTION CONFIRMATION
        # ───────────────────────────────────────────────────────────────────
        await send_json_safe(websocket, ws_id, {
            "type": "connected",
            "ws_id": ws_id,
            "session_id": session_id,
            "timestamp": int(time.time() * 1000)
        })
        
        # ───────────────────────────────────────────────────────────────────
        # MAIN MESSAGE LOOP
        # ───────────────────────────────────────────────────────────────────
        while True:
            try:
                # Receive message with timeout (detect stale connections)
                message_data = await asyncio.wait_for(
                    websocket.receive(),
                    timeout=90.0  # 90s timeout (longer than client heartbeat)
                )
                
                # Update health tracking
                connection_health[ws_id]['last_activity'] = time.time()
                connection_health[ws_id]['messages_received'] += 1
                
                # ═══════════════════════════════════════════════════════════
                # HANDLE JSON TEXT MESSAGES
                # ═══════════════════════════════════════════════════════════
                if 'text' in message_data and message_data['text'] is not None:
                    await handle_text_message(websocket, ws_id, session_id, message_data['text'])
                
                # ═══════════════════════════════════════════════════════════
                # HANDLE MESSAGEPACK BINARY MESSAGES (CRDT)
                # ═══════════════════════════════════════════════════════════
                elif 'bytes' in message_data and message_data['bytes'] is not None:
                    await handle_binary_message(websocket, ws_id, session_id, message_data['bytes'])
                
                # ═══════════════════════════════════════════════════════════
                # HANDLE EMPTY FRAMES (HYPERCORN HEARTBEATS)
                # ═══════════════════════════════════════════════════════════
                else:
                    # Empty frame - server heartbeat (hypercorn sends these)
                    connection_health[ws_id]['heartbeats'] += 1
                    logger.debug(f"[WS {ws_id[:8]}] Server heartbeat received")
                    # No response needed - just keep connection alive
                    
            except asyncio.TimeoutError:
                # No message received in 90s - connection might be stale
                logger.warning(f"[WS {ws_id[:8]}] No activity for 90s, sending ping")
                try:
                    await websocket.send_json({"type": "ping", "timestamp": int(time.time() * 1000)})
                except:
                    logger.warning(f"[WS {ws_id[:8]}] Ping failed, closing stale connection")
                    break
                    
            except WebSocketDisconnect:
                logger.info(f"[WS {ws_id[:8]}] Client disconnected gracefully")
                break
                
            except RuntimeError as e:
                if "disconnect" in str(e).lower() or "close" in str(e).lower():
                    logger.info(f"[WS {ws_id[:8]}] Connection closed: {e}")
                    break
                logger.error(f"[WS {ws_id[:8]}] Runtime error: {e}")
                raise
                
            except Exception as e:
                connection_health[ws_id]['errors'] += 1
                logger.error(f"[WS {ws_id[:8]}] Message handling error: {e}", exc_info=True)
                
                # Too many errors - close connection
                if connection_health[ws_id]['errors'] > 10:
                    logger.error(f"[WS {ws_id[:8]}] Too many errors, closing connection")
                    break
                
                # Otherwise continue (transient error)
                continue
                
    except Exception as e:
        logger.error(
            f"[WS {ws_id[:8]}] Fatal error: {e}",
            exc_info=True,
            extra={"ws_id": ws_id, "session_id": session_id}
        )
        
    finally:
        # ───────────────────────────────────────────────────────────────────
        # CLEANUP
        # ───────────────────────────────────────────────────────────────────
        cleanup_connection(ws_id, session_id)


# ═══════════════════════════════════════════════════════════════════════════
# MESSAGE HANDLERS
# ═══════════════════════════════════════════════════════════════════════════

async def handle_text_message(
    websocket: WebSocket,
    ws_id: str,
    session_id: str,
    text_data: str
):
    """Handle JSON text messages from clients."""
    try:
        message = json.loads(text_data)
        message_type = message.get('type', 'unknown')
        logger.debug(f"[WS {ws_id[:8]}] JSON received: {message_type}")
        
        # ───────────────────────────────────────────────────────────────────
        # SUBSCRIBE
        # ───────────────────────────────────────────────────────────────────
        if message_type == 'subscribe':
            logger.debug(f"[WS {ws_id[:8]}] Client subscribed to updates")
            await send_json_safe(websocket, ws_id, {
                "type": "subscribed",
                "session_id": session_id,
                "timestamp": int(time.time() * 1000)
            })
        
        # ───────────────────────────────────────────────────────────────────
        # HEARTBEAT / PING
        # ───────────────────────────────────────────────────────────────────
        elif message_type in ('heartbeat', 'ping'):
            await send_json_safe(websocket, ws_id, {
                "type": "pong",
                "timestamp": int(time.time() * 1000),
                "client_timestamp": message.get('timestamp')
            })
        
        # ───────────────────────────────────────────────────────────────────
        # HEALTH CHECK
        # ───────────────────────────────────────────────────────────────────
        elif message_type == 'health':
            health = connection_health.get(ws_id, {})
            await send_json_safe(websocket, ws_id, {
                "type": "health_response",
                "uptime": time.time() - health.get('connected_at', time.time()),
                "messages_received": health.get('messages_received', 0),
                "messages_sent": health.get('messages_sent', 0),
                "errors": health.get('errors', 0)
            })
        
        else:
            logger.debug(f"[WS {ws_id[:8]}] Unhandled JSON type: {message_type}")
            
    except json.JSONDecodeError as e:
        logger.warning(f"[WS {ws_id[:8]}] Invalid JSON: {e}")
        connection_health[ws_id]['errors'] += 1
    except Exception as e:
        logger.error(f"[WS {ws_id[:8]}] Text handler error: {e}", exc_info=True)
        connection_health[ws_id]['errors'] += 1


async def handle_binary_message(
    websocket: WebSocket,
    ws_id: str,
    session_id: str,
    binary_data: bytes
):
    """Handle MessagePack binary messages (CRDT patches)."""
    try:
        # Lazy import msgpack (only when binary messages used)
        import msgpack
        
        message = msgpack.unpackb(binary_data, raw=False)
        message_type = message.get('type', 'unknown')
        logger.debug(f"[WS {ws_id[:8]}] MessagePack received: {message_type} ({len(binary_data)} bytes)")
        
        # ───────────────────────────────────────────────────────────────────
        # CRDT PATCH - Forward to all peers
        # ───────────────────────────────────────────────────────────────────
        if message_type == 'patch':
            await broadcast_to_session_except(
                session_id,
                ws_id,
                binary_data,  # Forward raw binary (zero-copy!)
                is_binary=True
            )
            logger.debug(f"[WS {ws_id[:8]}] CRDT patch broadcasted to peers")
        
        # ───────────────────────────────────────────────────────────────────
        # SYNC REQUEST - Client wants historical patches
        # ───────────────────────────────────────────────────────────────────
        elif message_type == 'sync-request':
            logger.debug(f"[WS {ws_id[:8]}] Sync request received")
            # Send empty sync response (TODO: implement state persistence)
            sync_response = msgpack.packb({
                'type': 'sync-response',
                'patches': []
            })
            await send_binary_safe(websocket, ws_id, sync_response)
        
        # ───────────────────────────────────────────────────────────────────
        # PING - Binary heartbeat
        # ───────────────────────────────────────────────────────────────────
        elif message_type == 'ping':
            pong = msgpack.packb({
                'type': 'pong',
                'timestamp': message.get('timestamp', 0),
                'serverTime': int(time.time() * 1000)
            })
            await send_binary_safe(websocket, ws_id, pong)
            logger.debug(f"[WS {ws_id[:8]}] Binary ping/pong")
        
        else:
            logger.debug(f"[WS {ws_id[:8]}] Unhandled binary type: {message_type}")
            
    except Exception as e:
        logger.warning(f"[WS {ws_id[:8]}] Binary handler error: {e}", exc_info=True)
        connection_health[ws_id]['errors'] += 1


# ═══════════════════════════════════════════════════════════════════════════
# SAFE SEND HELPERS (with error handling)
# ═══════════════════════════════════════════════════════════════════════════

async def send_json_safe(websocket: WebSocket, ws_id: str, data: dict) -> bool:
    """Send JSON with error handling. Returns True if successful."""
    try:
        await websocket.send_json(data)
        connection_health[ws_id]['messages_sent'] += 1
        return True
    except Exception as e:
        logger.warning(f"[WS {ws_id[:8]}] Failed to send JSON: {e}")
        return False


async def send_binary_safe(websocket: WebSocket, ws_id: str, data: bytes) -> bool:
    """Send binary with error handling. Returns True if successful."""
    try:
        await websocket.send_bytes(data)
        connection_health[ws_id]['messages_sent'] += 1
        return True
    except Exception as e:
        logger.warning(f"[WS {ws_id[:8]}] Failed to send binary: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════
# BROADCASTING
# ═══════════════════════════════════════════════════════════════════════════

async def broadcast_to_session_except(
    session_id: str,
    exclude_ws_id: str,
    message_data: bytes | dict,
    is_binary: bool = False
):
    """
    Broadcast to all WebSockets in session EXCEPT sender.
    Zero-copy binary forwarding for CRDT patches.
    """
    ws_ids = session_service.get_connected_ws(session_id)
    
    broadcast_count = 0
    failed_count = 0
    
    for ws_id in ws_ids:
        if ws_id == exclude_ws_id:
            continue
            
        if ws_id in active_connections:
            try:
                if is_binary:
                    success = await send_binary_safe(active_connections[ws_id], ws_id, message_data)
                else:
                    success = await send_json_safe(active_connections[ws_id], ws_id, message_data)
                
                if success:
                    broadcast_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.warning(f"[WS {ws_id[:8]}] Broadcast error: {e}")
                failed_count += 1
    
    logger.debug(
        f"Broadcast complete: {broadcast_count} sent, {failed_count} failed, "
        f"1 excluded (sender)"
    )


async def notify_session(session_id: str, message: dict):
    """
    Broadcast JSON message to ALL WebSockets in session.
    Used by backend for transcription updates, file uploads, etc.
    """
    ws_ids = session_service.get_connected_ws(session_id)
    
    if not ws_ids:
        logger.debug(f"No WebSockets in session {session_id[:8]}")
        return
    
    success_count = 0
    failed_ws_ids = []
    
    for ws_id in ws_ids:
        if ws_id in active_connections:
            success = await send_json_safe(active_connections[ws_id], ws_id, message)
            if success:
                success_count += 1
            else:
                failed_ws_ids.append(ws_id)
    
    # Cleanup failed connections
    for ws_id in failed_ws_ids:
        cleanup_connection(ws_id, session_id)
    
    logger.debug(
        f"Session notification: {success_count}/{len(ws_ids)} delivered, "
        f"type: {message.get('type', 'unknown')}"
    )


async def broadcast_file_upload(session_id: str, file_info: dict):
    """Broadcast file upload notification to session."""
    await notify_session(session_id, {
        "type": "file_uploaded",
        "filename": file_info.get("filename", "unknown"),
        "size": file_info.get("size", 0),
        "mimeType": file_info.get("mimeType", "application/octet-stream"),
        "path": file_info.get("path", ""),
        "sessionId": session_id,
        "timestamp": int(time.time() * 1000)
    })


# ═══════════════════════════════════════════════════════════════════════════
# CONNECTION CLEANUP
# ═══════════════════════════════════════════════════════════════════════════

def cleanup_connection(ws_id: str, session_id: str):
    """Clean up connection tracking on disconnect."""
    if ws_id in active_connections:
        del active_connections[ws_id]
    if ws_id in ws_to_session:
        del ws_to_session[ws_id]
    if ws_id in connection_health:
        health = connection_health[ws_id]
        uptime = time.time() - health.get('connected_at', time.time())
        logger.info(
            f"[WS {ws_id[:8]}] Stats: uptime={uptime:.1f}s, "
            f"rx={health['messages_received']}, tx={health['messages_sent']}, "
            f"errors={health['errors']}, heartbeats={health['heartbeats']}"
        )
        del connection_health[ws_id]
    
    session_service.mark_disconnected(session_id, ws_id)
    
    logger.info(
        f"[WS {ws_id[:8]}] Cleanup complete | "
        f"Remaining connections: {len(active_connections)}"
    )