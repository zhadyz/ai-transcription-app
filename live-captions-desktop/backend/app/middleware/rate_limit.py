"""
Rate limiting middleware to prevent abuse.
Uses sliding window algorithm with IP-based tracking.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import logging
from .rate_limit_config import GENERAL_API_LIMIT 

logger = logging.getLogger(__name__)

# Create limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[GENERAL_API_LIMIT],  # Global default
    storage_uri="memory://",  # In-memory storage (use Redis for production)
    strategy="moving-window"
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors.
    Returns user-friendly error with retry information.
    """
    logger.warning(
        f"Rate limit exceeded: {request.client.host} on {request.url.path}",
        extra={"ip": request.client.host, "path": request.url.path}
    )
    
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": "Too many requests. Please slow down.",
            "retry_after": str(exc.detail)
        },
        headers={
            "Retry-After": str(exc.detail)
        }
    )