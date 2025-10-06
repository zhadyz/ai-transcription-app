"""
═══════════════════════════════════════════════════════════════════════════
AI TRANSCRIPTION API - MAIN APPLICATION
═══════════════════════════════════════════════════════════════════════════
Enterprise-grade audio/video transcription with AI
- GPU-accelerated processing
- Real-time WebSocket updates
- Mobile device support
- Multi-language translation
- Large file support (configurable up to 5GB+)
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import uuid
import time
from slowapi.errors import RateLimitExceeded

from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from app.api.routes import system
from app.api.routes import transcribe, session, websocket, translate_text
from app.services.session_service import session_service
from app.config import settings
from app.logging_config import setup_logging, get_logger, set_request_id, clear_request_id
from app.api.routes import capabilities, stream_upload
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

# Initialize logging system
setup_logging(log_level=settings.LOG_LEVEL, log_dir="./logs")
logger = get_logger(__name__)


async def cleanup_sessions_periodically():
    """Clean up expired sessions every 10 minutes"""
    while True:
        try:
            await asyncio.sleep(settings.CLEANUP_INTERVAL_SECONDS)
            logger.debug("Starting periodic cleanup")
            session_service.cleanup_expired_sessions()
            session_service.cleanup_orphaned_uploads(max_age_minutes=15)
            session_service.cleanup_old_transcripts(max_files=10)
            logger.debug("Periodic cleanup completed")
        except asyncio.CancelledError:
            logger.info("Cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting AI Transcription API v1.2.0")
    logger.info(f"Configuration: GPU={'enabled' if settings.WHISPER_DEVICE != 'cpu' else 'disabled'}, "
                f"Max concurrent: {settings.MAX_CONCURRENT_TRANSCRIPTIONS}, "
                f"Max file size: {settings.MAX_FILE_SIZE_MB}MB")
    
    # Preload default Whisper model
    from app.services.whisper_service import whisper_service
    from app.models.transcription import TranscriptionQuality
    
    logger.info(f"Preloading Whisper model: {settings.WHISPER_MODEL}")
    preload_start = time.time()
    
    try:
        # Load model in background to not block startup
        default_quality = TranscriptionQuality.BALANCED  # 'small' model
        await asyncio.to_thread(whisper_service._get_model, default_quality)
        preload_time = time.time() - preload_start
        logger.info(f"Model preloaded successfully in {preload_time:.2f}s")
    except Exception as e:
        logger.error(f"Failed to preload model: {e}. Will load on first request.", exc_info=True)
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(cleanup_sessions_periodically())
    logger.info("Background cleanup task started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down gracefully...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    # Unload models to free memory
    logger.info("Unloading Whisper models...")
    for quality in list(whisper_service.models.keys()):
        try:
            whisper_service.unload_model(TranscriptionQuality(quality))
        except Exception as e:
            logger.warning(f"Error unloading model {quality}: {e}")
    
    logger.info("Shutdown complete")


# ═══════════════════════════════════════════════════════════════════════════
# CREATE FASTAPI APPLICATION
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="AI Transcription API",
    version="1.2.0",
    description="Enterprise-grade audio/video transcription with AI",
    lifespan=lifespan
)

# ═══════════════════════════════════════════════════════════════════════════
# LARGE FILE UPLOAD SUPPORT
# ═══════════════════════════════════════════════════════════════════════════
# Increase request body size limit from default 16MB to configured limit
# This allows large file uploads (up to MAX_FILE_SIZE_MB)

StarletteRequest.max_body_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024

logger.info(f"Max request body size: {settings.MAX_FILE_SIZE_MB}MB ({settings.MAX_FILE_SIZE_MB * 1024 * 1024} bytes)")

# ═══════════════════════════════════════════════════════════════════════════
# REQUEST ID MIDDLEWARE FOR DISTRIBUTED TRACING
# ═══════════════════════════════════════════════════════════════════════════

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID for tracing"""
    request_id = str(uuid.uuid4())[:8]
    set_request_id(request_id)
    
    start_time = time.time()
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.3f}s"
        
        logger.info(
            f"{request.method} {request.url.path} | "
            f"Status: {response.status_code} | "
            f"Time: {process_time:.3f}s"
        )
        
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"{request.method} {request.url.path} | "
            f"Error: {str(e)} | "
            f"Time: {process_time:.3f}s",
            exc_info=True
        )
        raise
    finally:
        clear_request_id()


# ═══════════════════════════════════════════════════════════════════════════
# GLOBAL EXCEPTION HANDLER
# ═══════════════════════════════════════════════════════════════════════════

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions"""
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: {str(exc)}",
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred. Please try again.",
            "request_id": request.headers.get("X-Request-ID", "unknown")
        }
    )


# ═══════════════════════════════════════════════════════════════════════════
# CORS MIDDLEWARE - ALLOW ALL ORIGINS FOR LOCAL/NETWORK USE
# ═══════════════════════════════════════════════════════════════════════════

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development/local network
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "x-supports-streaming",
        "x-max-chunk-size",
        "x-supports-resume",
        "x-supports-parallel",
        "X-Request-ID",
        "X-Process-Time"
    ]
)

# ═══════════════════════════════════════════════════════════════════════════
# INCLUDE API ROUTERS
# ═══════════════════════════════════════════════════════════════════════════

app.include_router(transcribe.router)
app.include_router(session.router)
app.include_router(websocket.router)
app.include_router(translate_text.router)
app.include_router(system.router)
app.include_router(capabilities.router)
app.include_router(stream_upload.router)

# ═══════════════════════════════════════════════════════════════════════════
# ROOT & HEALTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/", tags=["Root"])
async def root():
    """API root endpoint"""
    return {
        "name": "AI Transcription API",
        "version": "1.2.0",
        "status": "operational",
        "features": [
            "Multi-format audio/video transcription",
            "GPU-accelerated processing",
            "Mobile device upload via QR code",
            "Real-time WebSocket progress updates",
            "Multi-language translation support",
            f"Large file support (up to {settings.MAX_FILE_SIZE_MB}MB)"
        ],
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "transcribe": "/transcribe/upload",
            "session": "/session/create"
        }
    }


@app.get("/health", tags=["Health"])
async def health():
    """Health check endpoint for monitoring"""
    try:
        # Check critical services
        from app.services.whisper_service import whisper_service
        
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "version": "1.2.0",
            "services": {
                "whisper": {
                    "status": "operational",
                    "device": whisper_service.device,
                    "gpu_available": whisper_service.gpu_available
                },
                "sessions": {
                    "status": "operational",
                    "active_count": len(session_service.sessions),
                    "active_websockets": sum(
                        len(ws_list) for ws_list in session_service.websocket_connections.values()
                    )
                },
                "transcription": {
                    "status": "operational",
                    "active_tasks": sum(
                        1 for task in transcribe.tasks.values() 
                        if task.status == "processing"
                    ),
                    "max_concurrent": settings.MAX_CONCURRENT_TRANSCRIPTIONS
                }
            },
            "limits": {
                "max_file_size_mb": settings.MAX_FILE_SIZE_MB,
                "max_concurrent_transcriptions": settings.MAX_CONCURRENT_TRANSCRIPTIONS
            }
        }
        
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )


@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Prometheus-style metrics endpoint"""
    from app.api.routes.transcribe import tasks
    
    total_tasks = len(tasks)
    completed = sum(1 for t in tasks.values() if t.status == "completed")
    failed = sum(1 for t in tasks.values() if t.status == "failed")
    processing = sum(1 for t in tasks.values() if t.status == "processing")
    
    return {
        "transcription_tasks_total": total_tasks,
        "transcription_tasks_completed": completed,
        "transcription_tasks_failed": failed,
        "transcription_tasks_processing": processing,
        "active_sessions": len(session_service.sessions),
        "active_websockets": sum(
            len(ws_list) for ws_list in session_service.websocket_connections.values()
        ),
        "max_file_size_mb": settings.MAX_FILE_SIZE_MB
    }


# ═══════════════════════════════════════════════════════════════════════════
# DEVELOPMENT SERVER (FOR TESTING ONLY)
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
        log_config=None,  # Use our custom logging
        ssl_keyfile="./localhost+2-key.pem",
        ssl_certfile="./localhost+2.pem"
    )