"""
API Key Management Endpoints.
Requires JWT authentication from existing auth system.
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models_v2 import APIKey
from app.api.dependencies.auth_deps import get_current_user
from app.models.auth import CurrentUser
from app.services.api_key_service import api_key_service, APIKeyError

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/keys", tags=["API Keys"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreateAPIKeyRequest(BaseModel):
    """Request to create new API key"""
    name: str = Field(..., min_length=1, max_length=255, description="Human-friendly key name")
    rate_limit_per_hour: int = Field(100, ge=1, le=10000, description="Requests per hour limit")
    max_file_size_mb: int = Field(500, ge=1, le=5000, description="Max file size in MB")
    allowed_formats: str = Field(
        "mp3,wav,mp4,avi,mov,mkv,flac",
        description="Comma-separated allowed file formats"
    )
    webhook_url: Optional[HttpUrl] = Field(None, description="Default webhook URL for callbacks")
    expires_in_days: Optional[int] = Field(None, ge=1, le=3650, description="Key expiration (days)")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Production API Key",
                "rate_limit_per_hour": 500,
                "max_file_size_mb": 1000,
                "allowed_formats": "mp3,wav,mp4,mov",
                "webhook_url": "https://your-app.com/webhooks/transcription",
                "expires_in_days": 365
            }
        }


class UpdateAPIKeyRequest(BaseModel):
    """Request to update API key settings"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    rate_limit_per_hour: Optional[int] = Field(None, ge=1, le=10000)
    max_file_size_mb: Optional[int] = Field(None, ge=1, le=5000)
    webhook_url: Optional[HttpUrl] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Key Name",
                "rate_limit_per_hour": 1000,
                "webhook_url": "https://new-webhook.com/callback"
            }
        }


class APIKeyResponse(BaseModel):
    """API key information (without full key)"""
    id: str
    name: str
    key_prefix: str  # First 8 chars for identification
    is_active: bool
    rate_limit_per_hour: int
    max_file_size_mb: int
    allowed_formats: List[str]
    webhook_url: Optional[str]
    total_requests: int
    total_minutes_transcribed: float
    last_used_at: Optional[datetime]
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "key_abc123xyz",
                "name": "Production API Key",
                "key_prefix": "tapi_AbC12345",
                "is_active": True,
                "rate_limit_per_hour": 500,
                "max_file_size_mb": 1000,
                "allowed_formats": ["mp3", "wav", "mp4", "mov"],
                "webhook_url": "https://your-app.com/webhooks/transcription",
                "total_requests": 1523,
                "total_minutes_transcribed": 245.5,
                "last_used_at": "2025-01-26T14:30:00Z",
                "created_at": "2025-01-01T10:00:00Z",
                "expires_at": "2026-01-01T10:00:00Z"
            }
        }


class CreateAPIKeyResponse(BaseModel):
    """Response when creating new API key"""
    api_key: str = Field(..., description="FULL API key - save this, it won't be shown again!")
    key_info: APIKeyResponse

    class Config:
        json_schema_extra = {
            "example": {
                "api_key": "tapi_AbC12345_xyz789abc...secret",
                "key_info": {
                    "id": "key_abc123xyz",
                    "name": "Production API Key",
                    "key_prefix": "tapi_AbC12345",
                    "is_active": True,
                    "rate_limit_per_hour": 500,
                    "max_file_size_mb": 1000,
                    "allowed_formats": ["mp3", "wav", "mp4"],
                    "webhook_url": None,
                    "total_requests": 0,
                    "total_minutes_transcribed": 0.0,
                    "last_used_at": None,
                    "created_at": "2025-01-26T10:00:00Z",
                    "expires_at": None
                }
            }
        }


class APIKeyStatsResponse(BaseModel):
    """Detailed usage statistics"""
    api_key_id: str
    name: str
    created_at: str
    last_used_at: Optional[str]
    total_requests: int
    total_minutes_transcribed: float
    last_24h: dict
    limits: dict

    class Config:
        json_schema_extra = {
            "example": {
                "api_key_id": "key_abc123xyz",
                "name": "Production API Key",
                "created_at": "2025-01-01T10:00:00Z",
                "last_used_at": "2025-01-26T14:30:00Z",
                "total_requests": 1523,
                "total_minutes_transcribed": 245.5,
                "last_24h": {
                    "requests": 87,
                    "minutes_transcribed": 12.3,
                    "total_size_mb": 456.7
                },
                "limits": {
                    "rate_limit_per_hour": 500,
                    "max_file_size_mb": 1000,
                    "allowed_formats": ["mp3", "wav", "mp4"]
                }
            }
        }


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("", response_model=CreateAPIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    request: CreateAPIKeyRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    **Create new API key**

    Creates a new API key for programmatic access to the transcription API.

    ⚠️ **IMPORTANT**: The full API key is returned ONLY ONCE at creation.
    Store it securely - you won't be able to retrieve it again.

    **Authentication:** Requires JWT token from login
    """

    try:
        api_key_record, full_api_key = api_key_service.create_api_key(
            db=db,
            user_id=current_user.id,
            name=request.name,
            rate_limit_per_hour=request.rate_limit_per_hour,
            max_file_size_mb=request.max_file_size_mb,
            allowed_formats=request.allowed_formats,
            webhook_url=str(request.webhook_url) if request.webhook_url else None,
            expires_in_days=request.expires_in_days
        )

        # Convert to response
        key_info = APIKeyResponse(
            id=api_key_record.id,
            name=api_key_record.name,
            key_prefix=api_key_record.key_prefix,
            is_active=api_key_record.is_active,
            rate_limit_per_hour=api_key_record.rate_limit_per_hour,
            max_file_size_mb=api_key_record.max_file_size_mb,
            allowed_formats=api_key_record.allowed_formats.split(","),
            webhook_url=api_key_record.webhook_url,
            total_requests=api_key_record.total_requests,
            total_minutes_transcribed=api_key_record.total_minutes_transcribed,
            last_used_at=api_key_record.last_used_at,
            created_at=api_key_record.created_at,
            expires_at=api_key_record.expires_at
        )

        return CreateAPIKeyResponse(
            api_key=full_api_key,
            key_info=key_info
        )

    except Exception as e:
        logger.error(f"Error creating API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create API key"
        )


@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(
    include_inactive: bool = False,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    **List all API keys**

    Get a list of all API keys for the authenticated user.

    **Query parameters:**
    - `include_inactive`: Include revoked/inactive keys (default: false)

    **Authentication:** Requires JWT token from login
    """

    keys = api_key_service.list_user_api_keys(
        db=db,
        user_id=current_user.id,
        include_inactive=include_inactive
    )

    return [
        APIKeyResponse(
            id=key.id,
            name=key.name,
            key_prefix=key.key_prefix,
            is_active=key.is_active,
            rate_limit_per_hour=key.rate_limit_per_hour,
            max_file_size_mb=key.max_file_size_mb,
            allowed_formats=key.allowed_formats.split(","),
            webhook_url=key.webhook_url,
            total_requests=key.total_requests,
            total_minutes_transcribed=key.total_minutes_transcribed,
            last_used_at=key.last_used_at,
            created_at=key.created_at,
            expires_at=key.expires_at
        )
        for key in keys
    ]


@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    **Get API key details**

    Get detailed information about a specific API key.

    **Authentication:** Requires JWT token from login
    """

    key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.user_id == current_user.id
    ).first()

    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    return APIKeyResponse(
        id=key.id,
        name=key.name,
        key_prefix=key.key_prefix,
        is_active=key.is_active,
        rate_limit_per_hour=key.rate_limit_per_hour,
        max_file_size_mb=key.max_file_size_mb,
        allowed_formats=key.allowed_formats.split(","),
        webhook_url=key.webhook_url,
        total_requests=key.total_requests,
        total_minutes_transcribed=key.total_minutes_transcribed,
        last_used_at=key.last_used_at,
        created_at=key.created_at,
        expires_at=key.expires_at
    )


@router.patch("/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: str,
    request: UpdateAPIKeyRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    **Update API key settings**

    Update settings for an existing API key.

    **Note:** Cannot update the key itself, only its settings.

    **Authentication:** Requires JWT token from login
    """

    try:
        updated_key = api_key_service.update_api_key(
            db=db,
            api_key_id=key_id,
            user_id=current_user.id,
            name=request.name,
            rate_limit_per_hour=request.rate_limit_per_hour,
            max_file_size_mb=request.max_file_size_mb,
            webhook_url=str(request.webhook_url) if request.webhook_url else None
        )

        return APIKeyResponse(
            id=updated_key.id,
            name=updated_key.name,
            key_prefix=updated_key.key_prefix,
            is_active=updated_key.is_active,
            rate_limit_per_hour=updated_key.rate_limit_per_hour,
            max_file_size_mb=updated_key.max_file_size_mb,
            allowed_formats=updated_key.allowed_formats.split(","),
            webhook_url=updated_key.webhook_url,
            total_requests=updated_key.total_requests,
            total_minutes_transcribed=updated_key.total_minutes_transcribed,
            last_used_at=updated_key.last_used_at,
            created_at=updated_key.created_at,
            expires_at=updated_key.expires_at
        )

    except APIKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    **Revoke API key**

    Permanently revoke (deactivate) an API key.
    This action cannot be undone.

    **Authentication:** Requires JWT token from login
    """

    try:
        api_key_service.revoke_api_key(
            db=db,
            api_key_id=key_id,
            user_id=current_user.id
        )

        return None

    except APIKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{key_id}/stats", response_model=APIKeyStatsResponse)
async def get_api_key_stats(
    key_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    **Get API key usage statistics**

    Get detailed usage statistics for an API key.

    **Authentication:** Requires JWT token from login
    """

    try:
        stats = api_key_service.get_api_key_stats(
            db=db,
            api_key_id=key_id,
            user_id=current_user.id
        )

        return APIKeyStatsResponse(**stats)

    except APIKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
