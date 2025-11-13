"""
FastAPI dependencies for API key authentication.
"""

from typing import Optional
from fastapi import Header, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.api_key_service import api_key_service, APIKeyError
from app.db.models_v2 import APIKey


async def get_api_key_from_header(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None)
) -> str:
    """
    Extract API key from Authorization header or X-API-Key header.

    Supports two formats:
    1. Authorization: Bearer tapi_xxx_xxx
    2. X-API-Key: tapi_xxx_xxx
    """
    api_key = None

    # Try Authorization header first
    if authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]  # Remove "Bearer " prefix
        else:
            api_key = authorization

    # Fallback to X-API-Key header
    if not api_key and x_api_key:
        api_key = x_api_key

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide via 'Authorization: Bearer <key>' or 'X-API-Key: <key>' header",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return api_key


async def validate_api_key(
    api_key: str = Depends(get_api_key_from_header),
    db: Session = Depends(get_db)
) -> APIKey:
    """
    Validate API key and return associated record.

    Use this dependency for endpoints that require API key authentication.
    """
    try:
        api_key_record = api_key_service.validate_api_key(
            db=db,
            api_key=api_key,
            check_rate_limit=True
        )
        return api_key_record

    except APIKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_optional_api_key(
    api_key: Optional[str] = Depends(get_api_key_from_header),
    db: Session = Depends(get_db)
) -> Optional[APIKey]:
    """
    Optional API key validation.

    Returns API key record if present and valid, None otherwise.
    Use for endpoints that work both with and without authentication.
    """
    if not api_key:
        return None

    try:
        return api_key_service.validate_api_key(
            db=db,
            api_key=api_key,
            check_rate_limit=True
        )
    except APIKeyError:
        return None


def check_file_size_limit(api_key: APIKey, file_size_bytes: int):
    """
    Check if file size is within API key limits.

    Raises:
        HTTPException: If file exceeds limit
    """
    max_bytes = api_key.max_file_size_mb * 1024 * 1024

    if file_size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {file_size_bytes / (1024*1024):.2f} MB exceeds limit of {api_key.max_file_size_mb} MB"
        )


def check_format_allowed(api_key: APIKey, file_extension: str):
    """
    Check if file format is allowed by API key.

    Raises:
        HTTPException: If format not allowed
    """
    allowed_formats = api_key.allowed_formats.split(",")
    file_ext = file_extension.lower().lstrip(".")

    if file_ext not in allowed_formats:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File format '.{file_ext}' not allowed. Allowed formats: {', '.join(allowed_formats)}"
        )
