"""
Session endpoints for mobile file uploads via QR code pairing.

Provides temporary sessions that link mobile and desktop devices for
file transfer and real-time transcription monitoring via WebSocket.

Session Flow:
    1. Desktop creates session → QR code generated
    2. Mobile scans QR → receives session ID
    3. Mobile uploads file to session
    4. Desktop receives notification via WebSocket
    5. Either device can start transcription
    6. Both devices receive real-time progress updates
    7. Session expires after 1 hour
"""

from fastapi import APIRouter, HTTPException, UploadFile, BackgroundTasks, Request, Depends
from fastapi.responses import FileResponse
from typing import Optional
import uuid
import logging
from pathlib import Path
import socket

from app.services.session_service import session_service
from app.services.validation_service import validate_file_type, validate_file_size, sanitize_filename
from app.middleware.rate_limit import limiter
from app.middleware.rate_limit_config import SESSION_CREATE_LIMIT, SESSION_UPLOAD_LIMIT

from app.middleware.auth import maybe_require_api_key
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/session", tags=["session"])


def get_local_ip() -> str:
    """
    Get the local network IP address for QR code generation.
    
    Returns:
        Local IP address or 'localhost' if detection fails
    """
    try:
        # Connect to external DNS to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        logger.warning(f"Could not detect local IP: {e}")
        return "localhost"


@router.post("/create")
@limiter.limit(SESSION_CREATE_LIMIT)
async def create_session(
    request: Request,
    _auth: Optional[str] = Depends(maybe_require_api_key)
):
    """
    Create a new upload session for mobile-desktop pairing.
    
    Rate limit: 50 sessions per hour per IP.
    Authentication: Required if REQUIRE_AUTH=True in config.
    
    Returns:
        Session ID, QR code data, WebSocket URL, and expiration info
        
    Example response:
        {
            "session_id": "abc-123-def",
            "qr_data": "http://192.168.1.100:3000/mobile-upload?session=abc-123-def",
            "ws_url": "ws://192.168.1.100:8000/ws/abc-123-def",
            "expires_in": 3600
        }
    """
    try:
        session_id = session_service.create_session()
        session_info = session_service.get_session_info(session_id)
        local_ip = get_local_ip()
        
        response = {
            "session_id": session_id,
            "upload_url": f"/session/{session_id}/upload",
            "websocket_url": f"/ws/{session_id}",
            "server_ip": local_ip,
            "backend_url": f"http://{local_ip}:8000",
            "qr_data": f"http://{local_ip}:3000/mobile-upload?session={session_id}",
            "ws_url": f"ws://{local_ip}:8000/ws/{session_id}",
            "expires_in": session_info["time_remaining"] if session_info else 3600
        }
        
        logger.info(f"Session created: {session_id[:8]} from {request.client.host}")
        return response
        
    except Exception as e:
        logger.error(f"Failed to create session: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Failed to create session: {str(e)}")


@router.get("/{session_id}/info")
async def get_session_info(session_id: str):
    """
    Get session metadata and status.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Session info including expiration time and file count
        
    Raises:
        404: Session not found or expired
    """
    info = session_service.get_session_info(session_id)
    if not info:
        raise HTTPException(404, "Session not found or expired")
    return info


@router.post("/{session_id}/upload")
@limiter.limit(SESSION_UPLOAD_LIMIT)
async def upload_to_session(
    request: Request,
    session_id: str,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    _auth: Optional[str] = Depends(maybe_require_api_key)
):
    """
    Upload a file to a session (mobile clients).
    
    Rate limit: 20 uploads per hour per IP.
    Authentication: Required if REQUIRE_AUTH=True in config.
    
    File is validated (size, type, magic bytes) and stored temporarily.
    Desktop client receives notification via WebSocket.
    
    Args:
        session_id: Session identifier from QR code
        file: Audio or video file
        
    Returns:
        Upload confirmation with file metadata
        
    Raises:
        404: Session not found or expired
        400: Invalid file type or size
        500: Upload failure
    """
    if not session_service.validate_session(session_id):
        raise HTTPException(404, "Session not found or expired")
    
    # Sanitize filename to prevent path traversal
    safe_filename = sanitize_filename(file.filename)
    file_ext = Path(safe_filename).suffix.lower()
    
    # Basic extension check
    allowed_extensions = {'.mp3', '.wav', '.m4a', '.mp4', '.avi', '.mov', '.flac', '.ogg'}
    if file_ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file extension: {file_ext}")
    
    file_id = str(uuid.uuid4())
    upload_dir = Path("./storage/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{file_id}{file_ext}"
    
    try:
        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Validate file size
        is_valid_size, size_message = validate_file_size(file_path, settings.MAX_FILE_SIZE_MB)
        if not is_valid_size:
            file_path.unlink()
            raise HTTPException(400, size_message)
        
        # Validate file content (magic bytes check)
        is_valid_type, mime_type, type_message = validate_file_type(file_path)
        if not is_valid_type:
            file_path.unlink()
            raise HTTPException(400, type_message)
        
        file_size = file_path.stat().st_size
        logger.info(
            f"File uploaded to session {session_id[:8]}: {safe_filename} "
            f"({file_size} bytes, {mime_type})"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(500, f"Upload failed: {str(e)}")
    
    # Store file info in session
    file_info = {
        "file_id": file_id,
        "filename": safe_filename,
        "path": str(file_path),
        "size": file_size,
        "extension": file_ext,
        "sessionId": session_id
    }
    
    session_service.add_file_to_session(session_id, file_info)
    
    # Notify desktop client via WebSocket
    from app.api.routes.websocket import broadcast_file_upload
    background_tasks.add_task(broadcast_file_upload, session_id, file_info)
    
    return {
        "success": True,
        "file_id": file_id,
        "filename": safe_filename,
        "size": file_size,
        "session_id": session_id,
        "message": "File uploaded successfully"
    }


@router.get("/file/{session_id}")
async def get_session_file(session_id: str):
    """
    Get the uploaded file from a session (desktop client).
    
    Args:
        session_id: Session identifier
        
    Returns:
        File download
        
    Raises:
        404: Session, file not found, or no file uploaded
    """
    if not session_service.validate_session(session_id):
        raise HTTPException(404, "Session not found or expired")
    
    files = session_service.get_session_files(session_id)
    if not files:
        raise HTTPException(404, "No file uploaded for this session")
    
    file_info = files[-1]  # Get most recent file
    file_path = Path(file_info["path"])
    
    if not file_path.exists():
        raise HTTPException(404, "File not found on server")
    
    return FileResponse(
        path=str(file_path),
        filename=file_info["filename"],
        media_type="application/octet-stream"
    )


@router.post("/{session_id}/task")
async def set_session_task(session_id: str, data: dict):
    """
    Store task ID for session (enables mobile to track transcription).
    
    Args:
        session_id: Session identifier
        data: Dictionary containing task_id
        
    Returns:
        Success confirmation
        
    Raises:
        404: Session not found
        400: Missing task_id
    """
    if not session_service.validate_session(session_id):
        raise HTTPException(404, "Session not found")
    
    task_id = data.get("task_id")
    if not task_id:
        raise HTTPException(400, "task_id required")
    
    session_service.set_task_id(session_id, task_id)
    return {"success": True}


@router.post("/{session_id}/start-transcription")
async def start_transcription_from_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    data: dict,
    _auth: Optional[str] = Depends(maybe_require_api_key)
):
    """
    Start transcription from uploaded session file.
    
    Can be initiated by either mobile or desktop client.
    Progress updates broadcast to both via WebSocket.
    
    Authentication: Required if REQUIRE_AUTH=True in config.
    
    Args:
        session_id: Session identifier
        data: Settings (language, quality, export_format)
        
    Returns:
        Task ID for tracking
        
    Raises:
        404: Session not found or no file uploaded
    """
    if not session_service.validate_session(session_id):
        raise HTTPException(404, "Session not found or expired")
    
    # Get the uploaded file from session
    files = session_service.get_session_files(session_id)
    if not files:
        raise HTTPException(404, "No file uploaded for this session")
    
    file_info = files[-1]
    file_path = Path(file_info["path"])
    
    if not file_path.exists():
        raise HTTPException(404, "File not found on server")
    
    # Get settings from request
    language = data.get("language", "auto")
    quality = data.get("quality", "small")
    export_format = data.get("export_format", "srt")
    
    # Import transcription modules
    from app.api.routes.transcribe import (
        tasks, TranscriptionProgress, TranscriptionRequest,
        TranscriptionLanguage, TranscriptionQuality, ExportFormat,
        process_transcription
    )
    
    # Create task
    task_id = str(uuid.uuid4())
    
    tasks[task_id] = TranscriptionProgress(
        task_id=task_id,
        status="queued",
        progress=0.0,
        current_step="Starting transcription..."
    )
    
    # Map settings
    quality_map = {
        "base": TranscriptionQuality.FAST,
        "small": TranscriptionQuality.BALANCED,
        "medium": TranscriptionQuality.DEEP
    }
    
    format_map = {
        "srt": ExportFormat.SRT,
        "vtt": ExportFormat.VTT,
        "txt": ExportFormat.TXT,
        "csv": ExportFormat.CSV,
        "json": ExportFormat.JSON
    }
    
    lang_enum = TranscriptionLanguage.AUTO if language == "auto" else TranscriptionLanguage(language)
    settings_param = TranscriptionRequest(
        language=lang_enum,
        quality=quality_map.get(quality, TranscriptionQuality.BALANCED),
        export_format=format_map.get(export_format, ExportFormat.SRT)
    )
    
    # Store task_id in session
    session_service.set_task_id(session_id, task_id)
    
    # Start transcription with session_id for WebSocket updates
    background_tasks.add_task(
        process_transcription, task_id, file_path, settings_param, session_id
    )

    # Broadcast to desktop via WebSocket
    from app.api.routes.websocket import notify_session
    await notify_session(session_id, {
        "type": "transcription_started",
        "task_id": task_id,
        "status": "queued",
        "filename": file_info["filename"],
        "size": file_info["size"],
        "path": file_info["path"],
        "sessionId": session_id
    })
    
    logger.info(
        f"Transcription started from session {session_id[:8]}: "
        f"task {task_id[:8]}"
    )
    
    return {
        "task_id": task_id,
        "status": "queued",
        "message": "Transcription started"
    }


@router.get("/{session_id}/status")
async def get_session_status(session_id: str):
    """
    Get session transcription status (mobile polling endpoint).
    
    WebSocket updates are preferred, but this endpoint provides
    fallback polling for mobile clients.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Current status including progress and results if complete
        
    Raises:
        404: Session not found
    """
    if not session_service.validate_session(session_id):
        raise HTTPException(404, "Session not found or expired")
    
    session = session_service.sessions[session_id]
    task_id = session.get("task_id")
    
    response = {
        "session_id": session_id,
        "has_file": len(session["files"]) > 0,
        "task_id": task_id,
        "status": "waiting"
    }
    
    if task_id:
        from app.api.routes.transcribe import tasks, task_results
        
        if task_id in tasks:
            task_progress = tasks[task_id]
            response["status"] = task_progress.status
            response["progress"] = task_progress.progress
            
            if task_progress.status == "completed" and task_id in task_results:
                result = task_results[task_id]
                response["result"] = {
                    "text": result.text,
                    "segments": [
                        {"start": s.start, "end": s.end, "text": s.text} 
                        for s in result.segments
                    ],
                    "language_detected": result.language_detected
                }
    
    return response


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    _auth: Optional[str] = Depends(maybe_require_api_key)
):
    """
    Manually delete a session and cleanup associated files.
    
    Authentication: Required if REQUIRE_AUTH=True in config.
    
    Sessions are automatically cleaned up after expiration, but this
    endpoint allows manual cleanup for immediate resource release.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Deletion confirmation
        
    Raises:
        404: Session not found
    """
    if session_id not in session_service.sessions:
        raise HTTPException(404, "Session not found")
    
    session_service.cleanup_session(session_id)
    logger.info(f"Session manually deleted: {session_id[:8]}")
    
    return {"message": "Session deleted successfully"}