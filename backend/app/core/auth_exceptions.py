"""
Authentication-specific exception handlers.
Centralized error handling for authentication system with proper HTTP responses.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# ERROR RESPONSE MODELS
# ============================================================================

class ErrorResponse:
    """Standard error response format"""

    @staticmethod
    def create(
        error_code: str,
        message: str,
        details: dict = None,
        status_code: int = 400
    ) -> JSONResponse:
        """Create standardized error response"""
        content = {
            "error": {
                "code": error_code,
                "message": message,
            }
        }

        if details:
            content["error"]["details"] = details

        return JSONResponse(
            status_code=status_code,
            content=content
        )


# ============================================================================
# VALIDATION ERROR HANDLER
# ============================================================================

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors.
    Formats validation errors into user-friendly messages.
    """
    errors = []

    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"] if loc != "body")
        message = error["msg"]

        # Customize common validation messages
        if error["type"] == "value_error.email":
            message = "Invalid email address format"
        elif error["type"] == "value_error.any_str.min_length":
            message = f"{field} is too short"
        elif error["type"] == "value_error.any_str.max_length":
            message = f"{field} is too long"

        errors.append({
            "field": field,
            "message": message,
            "type": error["type"]
        })

    logger.warning(f"Validation error on {request.url.path}: {errors}")

    return ErrorResponse.create(
        error_code="VALIDATION_ERROR",
        message="Request validation failed",
        details={"errors": errors},
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
    )


# ============================================================================
# AUTHENTICATION ERROR CODES
# ============================================================================

class AuthErrorCode:
    """Standard authentication error codes"""

    # Authentication errors (401)
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    TOKEN_INVALID = "TOKEN_INVALID"
    TOKEN_MISSING = "TOKEN_MISSING"
    SESSION_EXPIRED = "SESSION_EXPIRED"

    # Authorization errors (403)
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"
    ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED"

    # Resource errors (404)
    USER_NOT_FOUND = "USER_NOT_FOUND"
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"

    # Validation errors (400)
    WEAK_PASSWORD = "WEAK_PASSWORD"
    PASSWORD_MISMATCH = "PASSWORD_MISMATCH"
    EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS"
    INVALID_EMAIL_DOMAIN = "INVALID_EMAIL_DOMAIN"

    # Rate limiting (429)
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"
    TOO_MANY_LOGIN_ATTEMPTS = "TOO_MANY_LOGIN_ATTEMPTS"

    # Server errors (500)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"


# ============================================================================
# ERROR MESSAGES
# ============================================================================

AUTH_ERROR_MESSAGES = {
    # 401 Unauthorized
    AuthErrorCode.INVALID_CREDENTIALS: "Invalid email or password",
    AuthErrorCode.TOKEN_EXPIRED: "Your session has expired. Please login again.",
    AuthErrorCode.TOKEN_INVALID: "Invalid authentication token",
    AuthErrorCode.TOKEN_MISSING: "Authentication required. Please provide a valid token.",
    AuthErrorCode.SESSION_EXPIRED: "Your session has expired. Please login again.",

    # 403 Forbidden
    AuthErrorCode.INSUFFICIENT_PERMISSIONS: "You don't have permission to perform this action",
    AuthErrorCode.ACCOUNT_INACTIVE: "Your account is inactive. Please contact support.",
    AuthErrorCode.ACCOUNT_LOCKED: "Your account has been locked due to multiple failed login attempts",
    AuthErrorCode.EMAIL_NOT_VERIFIED: "Please verify your email address to continue",

    # 404 Not Found
    AuthErrorCode.USER_NOT_FOUND: "User not found",
    AuthErrorCode.SESSION_NOT_FOUND: "Session not found",

    # 400 Bad Request
    AuthErrorCode.WEAK_PASSWORD: "Password does not meet security requirements",
    AuthErrorCode.PASSWORD_MISMATCH: "Passwords do not match",
    AuthErrorCode.EMAIL_ALREADY_EXISTS: "An account with this email already exists",
    AuthErrorCode.INVALID_EMAIL_DOMAIN: "Email domain is not allowed",

    # 429 Too Many Requests
    AuthErrorCode.TOO_MANY_REQUESTS: "Too many requests. Please try again later.",
    AuthErrorCode.TOO_MANY_LOGIN_ATTEMPTS: "Too many login attempts. Please try again in 30 minutes.",

    # 500 Internal Server Error
    AuthErrorCode.INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
    AuthErrorCode.DATABASE_ERROR: "Database error. Please try again later.",
}


# ============================================================================
# EXCEPTION FACTORY
# ============================================================================

class AuthException:
    """Factory for creating authentication exceptions with proper HTTP responses"""

    @staticmethod
    def invalid_credentials(details: dict = None):
        """401 - Invalid credentials"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.INVALID_CREDENTIALS,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.INVALID_CREDENTIALS],
            details=details,
            status_code=status.HTTP_401_UNAUTHORIZED
        )

    @staticmethod
    def token_expired(details: dict = None):
        """401 - Token expired"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.TOKEN_EXPIRED,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.TOKEN_EXPIRED],
            details=details,
            status_code=status.HTTP_401_UNAUTHORIZED
        )

    @staticmethod
    def token_invalid(details: dict = None):
        """401 - Invalid token"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.TOKEN_INVALID,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.TOKEN_INVALID],
            details=details,
            status_code=status.HTTP_401_UNAUTHORIZED
        )

    @staticmethod
    def token_missing():
        """401 - Token missing"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.TOKEN_MISSING,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.TOKEN_MISSING],
            status_code=status.HTTP_401_UNAUTHORIZED
        )

    @staticmethod
    def session_expired():
        """401 - Session expired"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.SESSION_EXPIRED,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.SESSION_EXPIRED],
            status_code=status.HTTP_401_UNAUTHORIZED
        )

    @staticmethod
    def insufficient_permissions(required_role: str = None):
        """403 - Insufficient permissions"""
        details = {"required_role": required_role} if required_role else None
        return ErrorResponse.create(
            error_code=AuthErrorCode.INSUFFICIENT_PERMISSIONS,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.INSUFFICIENT_PERMISSIONS],
            details=details,
            status_code=status.HTTP_403_FORBIDDEN
        )

    @staticmethod
    def account_inactive():
        """403 - Account inactive"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.ACCOUNT_INACTIVE,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.ACCOUNT_INACTIVE],
            status_code=status.HTTP_403_FORBIDDEN
        )

    @staticmethod
    def account_locked(locked_until: str = None):
        """403 - Account locked"""
        details = {"locked_until": locked_until} if locked_until else None
        return ErrorResponse.create(
            error_code=AuthErrorCode.ACCOUNT_LOCKED,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.ACCOUNT_LOCKED],
            details=details,
            status_code=status.HTTP_403_FORBIDDEN
        )

    @staticmethod
    def email_not_verified():
        """403 - Email not verified"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.EMAIL_NOT_VERIFIED,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.EMAIL_NOT_VERIFIED],
            status_code=status.HTTP_403_FORBIDDEN
        )

    @staticmethod
    def user_not_found():
        """404 - User not found"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.USER_NOT_FOUND,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.USER_NOT_FOUND],
            status_code=status.HTTP_404_NOT_FOUND
        )

    @staticmethod
    def weak_password(requirements: list = None):
        """400 - Weak password"""
        details = {"requirements": requirements} if requirements else None
        return ErrorResponse.create(
            error_code=AuthErrorCode.WEAK_PASSWORD,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.WEAK_PASSWORD],
            details=details,
            status_code=status.HTTP_400_BAD_REQUEST
        )

    @staticmethod
    def email_already_exists():
        """400 - Email already exists"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.EMAIL_ALREADY_EXISTS,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.EMAIL_ALREADY_EXISTS],
            status_code=status.HTTP_400_BAD_REQUEST
        )

    @staticmethod
    def too_many_login_attempts(retry_after: int = None):
        """429 - Too many login attempts"""
        details = {"retry_after_seconds": retry_after} if retry_after else None
        return ErrorResponse.create(
            error_code=AuthErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.TOO_MANY_LOGIN_ATTEMPTS],
            details=details,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
        )

    @staticmethod
    def internal_error():
        """500 - Internal error"""
        return ErrorResponse.create(
            error_code=AuthErrorCode.INTERNAL_ERROR,
            message=AUTH_ERROR_MESSAGES[AuthErrorCode.INTERNAL_ERROR],
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# SECURITY UTILITIES
# ============================================================================

def is_suspicious_activity(
    failed_attempts: int,
    time_window_minutes: int = 30
) -> bool:
    """
    Detect suspicious authentication activity.

    Args:
        failed_attempts: Number of failed login attempts
        time_window_minutes: Time window to consider

    Returns:
        True if activity is suspicious
    """
    # More than 5 failed attempts in 30 minutes
    return failed_attempts >= 5


def calculate_lockout_duration(failed_attempts: int) -> int:
    """
    Calculate account lockout duration based on failed attempts.

    Args:
        failed_attempts: Number of failed attempts

    Returns:
        Lockout duration in minutes
    """
    if failed_attempts < 5:
        return 0
    elif failed_attempts < 10:
        return 30  # 30 minutes
    elif failed_attempts < 15:
        return 60  # 1 hour
    else:
        return 1440  # 24 hours
