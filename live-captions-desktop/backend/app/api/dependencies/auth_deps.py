"""
Authentication dependencies for FastAPI routes.
Provides dependency injection for user authentication and authorization.
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import logging

from app.db.database import get_db
from app.services import auth_service
from app.models.auth import CurrentUser

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)


# ============================================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================================

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """
    Get currently authenticated user from JWT token.

    Usage:
        @app.get("/profile")
        def get_profile(current_user: CurrentUser = Depends(get_current_user)):
            return current_user

    Raises:
        HTTPException 401: If token is missing or invalid
        HTTPException 403: If user is inactive or session is revoked
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please provide a valid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Decode and validate token
        payload = auth_service.decode_token(token)

        # Verify it's an access token
        if payload.type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Expected access token.",
            )

        # Get user from database
        user = auth_service.get_user_by_id(db, payload.sub)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive. Please contact support.",
            )

        # Verify session is still active
        session = auth_service.get_active_session(db, payload.session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired or been revoked. Please login again.",
            )

        # Update session last activity
        session.last_activity_at = auth_service.datetime.utcnow()
        db.commit()

        # Create CurrentUser object
        current_user = CurrentUser(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            session_id=payload.session_id,
            is_active=user.is_active,
            is_verified=user.is_verified
        )

        return current_user

    except auth_service.TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please refresh your token or login again.",
        )
    except auth_service.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Authentication error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )


async def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    """
    Get current user and verify account is active.
    Alias for get_current_user (already checks is_active).
    """
    return current_user


async def get_current_verified_user(
    current_user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    """
    Get current user and verify email is verified.

    Usage:
        @app.post("/premium-feature")
        def premium_feature(current_user: CurrentUser = Depends(get_current_verified_user)):
            # Only verified users can access
            return {"status": "success"}

    Raises:
        HTTPException 403: If email is not verified
    """
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please verify your email to access this feature.",
        )
    return current_user


# ============================================================================
# ROLE-BASED AUTHORIZATION
# ============================================================================

class RoleChecker:
    """
    Role-based access control dependency.

    Usage:
        require_admin = RoleChecker(["admin"])

        @app.delete("/users/{user_id}")
        def delete_user(
            user_id: str,
            current_user: CurrentUser = Depends(require_admin)
        ):
            # Only admins can access
            pass
    """

    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(self.allowed_roles)}",
            )
        return current_user


# Pre-configured role checkers
require_admin = RoleChecker(["admin"])
require_premium = RoleChecker(["premium", "admin"])
require_user = RoleChecker(["user", "premium", "admin"])


# ============================================================================
# OPTIONAL AUTHENTICATION
# ============================================================================

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[CurrentUser]:
    """
    Get current user if authenticated, None otherwise.
    Useful for endpoints that work with or without authentication.

    Usage:
        @app.get("/public-content")
        def get_content(current_user: Optional[CurrentUser] = Depends(get_optional_current_user)):
            if current_user:
                # Show personalized content
                pass
            else:
                # Show public content
                pass
    """
    if not credentials:
        return None

    try:
        # Use dummy request object
        from fastapi import Request
        request = Request(scope={"type": "http"})
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None


# ============================================================================
# REQUEST CONTEXT HELPERS
# ============================================================================

def get_client_ip(request: Request) -> str:
    """Extract client IP address from request"""
    # Check for X-Forwarded-For header (proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    # Check for X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct client
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> str:
    """Extract user agent from request"""
    return request.headers.get("User-Agent", "unknown")


def get_device_info(request: Request) -> str:
    """
    Extract device information from request.
    Parses user agent to determine device type and browser.
    """
    user_agent = get_user_agent(request)

    # Simple device detection (can be enhanced with user-agents library)
    if "Mobile" in user_agent or "Android" in user_agent:
        device_type = "Mobile"
    elif "Tablet" in user_agent or "iPad" in user_agent:
        device_type = "Tablet"
    else:
        device_type = "Desktop"

    # Browser detection
    if "Chrome" in user_agent:
        browser = "Chrome"
    elif "Firefox" in user_agent:
        browser = "Firefox"
    elif "Safari" in user_agent:
        browser = "Safari"
    elif "Edge" in user_agent:
        browser = "Edge"
    else:
        browser = "Other"

    return f"{browser} on {device_type}"
