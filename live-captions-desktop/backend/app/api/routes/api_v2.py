"""
API v2 Routes - API-first transcription service.
Supports webhooks, URL inputs, API keys, and async processing.
"""

import json
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl, Field, validator
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models_v2 import TranscriptionTask, UsageRecord, APIKey
from app.api.dependencies.api_key_deps import (
    validate_api_key,
    check_file_size_limit,
    check_format_allowed
)
from app.services.file_input_service import file_input_service, FileInputError
from app.services.webhook_service import webhook_service
from app.core.exceptions import TranscriptionBaseException
from app.models.transcription import TranscriptionSettings

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2", tags=["API v2"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class TranscribeURLRequest(BaseModel):
    """Request to transcribe from URL"""
    url: HttpUrl = Field(..., description="URL of audio/video file to transcribe")
    language: Optional[str] = Field(None, max_length=16, description="Language code (auto-detect if not provided)")
    task: str = Field("transcribe", description="Task type: transcribe or translate")
    output_format: str = Field("srt", description="Output format: srt, vtt, txt, json, csv")
    webhook_url: Optional[HttpUrl] = Field(None, description="Webhook URL for completion callback")
    metadata: Optional[dict] = Field(None, description="Custom metadata to include in webhook")

    @validator("task")
    def validate_task(cls, v):
        if v not in ["transcribe", "translate"]:
            raise ValueError("task must be 'transcribe' or 'translate'")
        return v

    @validator("output_format")
    def validate_format(cls, v):
        if v not in ["srt", "vtt", "txt", "json", "csv"]:
            raise ValueError("output_format must be one of: srt, vtt, txt, json, csv")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://example.com/audio.mp3",
                "language": "en",
                "task": "transcribe",
                "output_format": "srt",
                "webhook_url": "https://your-app.com/webhooks/transcription",
                "metadata": {"order_id": "12345", "customer": "acme_corp"}
            }
        }


class TaskResponse(BaseModel):
    """Transcription task response"""
    task_id: str
    status: str
    progress: float
    current_step: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    expires_at: datetime
    estimated_completion: Optional[datetime]

    # Results (only when completed)
    result: Optional[dict] = None

    # Error info (only when failed)
    error: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "task_id": "task_abc123xyz",
                "status": "processing",
                "progress": 45.0,
                "current_step": "Transcribing with Whisper",
                "created_at": "2025-01-26T10:00:00Z",
                "started_at": "2025-01-26T10:00:05Z",
                "completed_at": None,
                "expires_at": "2025-01-27T10:00:00Z",
                "estimated_completion": "2025-01-26T10:15:00Z"
            }
        }


class TaskListResponse(BaseModel):
    """List of tasks"""
    tasks: list[TaskResponse]
    total: int
    page: int
    page_size: int


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def create_transcription_task(
    db: Session,
    api_key: APIKey,
    file_path: Path,
    file_name: str,
    file_size: int,
    input_type: str,
    input_url: Optional[str],
    language: Optional[str],
    task_type: str,
    output_format: str,
    webhook_url: Optional[str],
    metadata: Optional[dict],
    ip_address: Optional[str],
    user_agent: Optional[str]
) -> TranscriptionTask:
    """Create new transcription task in database"""

    task_id = f"task_{secrets.token_urlsafe(16)}"

    task = TranscriptionTask(
        id=task_id,
        user_id=api_key.user_id,
        api_key_id=api_key.id,
        input_type=input_type,
        input_url=input_url,
        file_name=file_name,
        file_size_bytes=file_size,
        file_path=str(file_path),
        language=language,
        task_type=task_type,
        output_format=output_format,
        status="pending",
        webhook_url=webhook_url or api_key.webhook_url,
        expires_at=datetime.utcnow() + timedelta(hours=24),
        client_metadata=json.dumps(metadata) if metadata else None,
        ip_address=ip_address,
        user_agent=user_agent
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    logger.info(f"Created transcription task {task_id} for API key {api_key.id}")

    return task


async def process_transcription_task(
    task_id: str,
    db: Session
):
    """
    Background task to process transcription.

    This wraps the existing transcription pipeline from v1.
    """
    from app.api.routes.transcribe import process_transcription
    from app.models.transcription import TranscriptionRequest

    task = db.query(TranscriptionTask).filter(TranscriptionTask.id == task_id).first()

    if not task:
        logger.error(f"Task {task_id} not found")
        return

    try:
        # Update status
        task.status = "processing"
        task.started_at = datetime.utcnow()
        db.commit()

        # Build settings for v1 pipeline
        settings = TranscriptionRequest(
            language=task.language,
            task=task.task_type,
            output_format=task.output_format
        )

        # Run existing transcription pipeline
        await process_transcription(
            task_id=task_id,
            file_path=Path(task.file_path),
            settings_param=settings,
            session_id=None  # No session for API v2
        )

        # Task completion is handled by the existing pipeline
        # We need to hook into its completion to trigger webhook

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        task.status = "failed"
        task.error_message = str(e)
        task.error_code = "PROCESSING_ERROR"
        task.completed_at = datetime.utcnow()
        db.commit()

        # Send failure webhook
        if task.webhook_url:
            await webhook_service.send_task_failed(
                db,
                task,
                webhook_url=task.webhook_url,
                webhook_secret=None  # Retrieved from API key
            )


def task_to_response(task: TranscriptionTask) -> TaskResponse:
    """Convert TranscriptionTask to TaskResponse"""

    response = TaskResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        current_step=task.current_step,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
        expires_at=task.expires_at,
        estimated_completion=None  # TODO: Calculate based on file size
    )

    # Add result if completed
    if task.status == "completed" and task.transcript_text:
        response.result = {
            "transcript": task.transcript_text,
            "word_count": task.word_count,
            "duration_seconds": task.duration_seconds,
            "download_url": f"/api/v2/tasks/{task.id}/download",
            "output_format": task.output_format
        }

    # Add error if failed
    if task.status == "failed":
        response.error = {
            "message": task.error_message,
            "code": task.error_code
        }

    return response


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/transcribe/url", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def transcribe_from_url(
    request: TranscribeURLRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    api_key: APIKey = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    **Transcribe audio/video from URL**

    Downloads the file from the provided URL and queues it for transcription.
    Returns immediately with a task ID for status polling.

    **Security:**
    - SSRF protection (no localhost/private IPs)
    - File size validation
    - Format validation
    - Rate limiting

    **Webhook:**
    If webhook_url provided, you'll receive a POST request when complete:
    ```json
    {
        "event": "task.completed",
        "task_id": "task_xxx",
        "status": "completed",
        "transcript": {...},
        "output": {...}
    }
    ```

    **Rate Limit:** Based on your API key settings
    """

    # Generate temporary file path
    upload_dir = Path("uploads/api_v2")
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = file_input_service.infer_filename_from_url(str(request.url))
    file_path = upload_dir / f"{secrets.token_urlsafe(16)}_{filename}"

    try:
        # Download file
        logger.info(f"Downloading file for API key {api_key.id}: {request.url}")

        file_size, content_type = await file_input_service.download_from_url(
            url=str(request.url),
            destination=file_path,
            max_size_bytes=api_key.max_file_size_mb * 1024 * 1024
        )

        # Validate file
        file_info = await file_input_service.validate_file(
            file_path,
            allowed_formats=api_key.allowed_formats.split(",")
        )

        # Create task
        task = await create_transcription_task(
            db=db,
            api_key=api_key,
            file_path=file_path,
            file_name=filename,
            file_size=file_size,
            input_type="url",
            input_url=str(request.url),
            language=request.language,
            task_type=request.task,
            output_format=request.output_format,
            webhook_url=str(request.webhook_url) if request.webhook_url else None,
            metadata=request.metadata,
            ip_address=http_request.client.host if http_request.client else None,
            user_agent=http_request.headers.get("user-agent")
        )

        # Queue for processing
        background_tasks.add_task(process_transcription_task, task.id, db)

        return task_to_response(task)

    except FileInputError as e:
        # Cleanup on error
        if file_path.exists():
            file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except Exception as e:
        # Cleanup on error
        if file_path.exists():
            file_path.unlink(missing_ok=True)

        logger.error(f"Error processing URL request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process request"
        )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(
    task_id: str,
    api_key: APIKey = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    **Get transcription task status**

    Check the status and progress of a transcription task.

    **Status values:**
    - `pending`: Waiting in queue
    - `processing`: Currently transcribing
    - `completed`: Finished successfully
    - `failed`: Error occurred
    - `expired`: Task expired (24h retention)
    """

    task = db.query(TranscriptionTask).filter(
        TranscriptionTask.id == task_id,
        TranscriptionTask.api_key_id == api_key.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or unauthorized"
        )

    return task_to_response(task)


@router.get("/tasks/{task_id}/download")
async def download_task_result(
    task_id: str,
    api_key: APIKey = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    **Download transcription result file**

    Downloads the transcribed file in the requested format.
    Available for 24 hours after completion.
    """

    task = db.query(TranscriptionTask).filter(
        TranscriptionTask.id == task_id,
        TranscriptionTask.api_key_id == api_key.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or unauthorized"
        )

    if task.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task not completed (status: {task.status})"
        )

    if not task.output_file_path or not Path(task.output_file_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result file not found (may have expired)"
        )

    return FileResponse(
        path=task.output_file_path,
        filename=f"{Path(task.file_name).stem}.{task.output_format}",
        media_type="application/octet-stream"
    )


@router.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    api_key: APIKey = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    **List transcription tasks**

    Get a paginated list of your transcription tasks.

    **Query parameters:**
    - `status`: Filter by status (pending, processing, completed, failed)
    - `page`: Page number (default: 1)
    - `page_size`: Items per page (default: 20, max: 100)
    """

    if page_size > 100:
        page_size = 100

    query = db.query(TranscriptionTask).filter(
        TranscriptionTask.api_key_id == api_key.id
    )

    if status:
        query = query.filter(TranscriptionTask.status == status)

    total = query.count()

    tasks = query.order_by(
        TranscriptionTask.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()

    return TaskListResponse(
        tasks=[task_to_response(task) for task in tasks],
        total=total,
        page=page,
        page_size=page_size
    )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    api_key: APIKey = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    **Delete a transcription task**

    Deletes a task and its associated files.
    Cannot delete tasks that are currently processing.
    """

    task = db.query(TranscriptionTask).filter(
        TranscriptionTask.id == task_id,
        TranscriptionTask.api_key_id == api_key.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or unauthorized"
        )

    if task.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete task that is currently processing"
        )

    # Delete files
    if task.file_path and Path(task.file_path).exists():
        Path(task.file_path).unlink(missing_ok=True)

    if task.output_file_path and Path(task.output_file_path).exists():
        Path(task.output_file_path).unlink(missing_ok=True)

    # Delete task
    db.delete(task)
    db.commit()

    logger.info(f"Deleted task {task_id}")

    return None
