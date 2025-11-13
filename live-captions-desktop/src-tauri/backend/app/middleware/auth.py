"""
API Key authentication middleware.
Simple header-based authentication suitable for offline/air-gapped deployment.
"""

from fastapi import Security, HTTPException, status, Depends
from fastapi.security import APIKeyHeader
from typing import Optional
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# API Key header name
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> str:
    """
    Verify API key from request header.
    
    Args:
        api_key: API key from X-API-Key header
        
    Returns:
        Valid API key
        
    Raises:
        HTTPException: If key is missing or invalid
    """
    if not api_key:
        logger.warning("Request without API key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Include 'X-API-Key' header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    if api_key not in settings.ALLOWED_API_KEYS:
        logger.warning(f"Invalid API key attempted: {api_key[:8]}...")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )
    
    logger.debug(f"Valid API key used: {api_key[:8]}...")
    return api_key


async def maybe_require_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> Optional[str]:
    """
    Conditional API key verification.
    Only enforces authentication if REQUIRE_AUTH is True.
    
    This allows auth to be implemented but dormant until explicitly enabled.
    """
    if not settings.REQUIRE_AUTH:
        # Auth disabled - allow all requests through
        return None
    
    # Auth enabled - verify the key
    return await verify_api_key(api_key)