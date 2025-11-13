"""
Authentication domain models.
Pydantic schemas for all authentication-related requests and responses.
"""

from pydantic import BaseModel, EmailStr, Field, validator, ConfigDict
from typing import Optional, Literal
from datetime import datetime
import re


# ============================================================================
# REQUEST MODELS
# ============================================================================

class UserRegistrationRequest(BaseModel):
    """User registration payload"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (8-128 characters, must contain uppercase, lowercase, number, special char)"
    )
    full_name: str = Field(..., min_length=1, max_length=255, description="User's full name")
    organization: Optional[str] = Field(None, max_length=255, description="Organization name")

    @validator('password')
    def validate_password_strength(cls, v):
        """
        Enforce strong password requirements:
        - At least 8 characters
        - Contains uppercase letter
        - Contains lowercase letter
        - Contains digit
        - Contains special character
        """
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')

        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')

        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')

        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')

        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')

        return v

    @validator('email')
    def validate_email_domain(cls, v):
        """Optional: Add custom email domain validation"""
        # Example: block disposable email domains
        blocked_domains = ['tempmail.com', 'throwaway.email']
        domain = v.split('@')[1].lower()
        if domain in blocked_domains:
            raise ValueError(f'Email domain {domain} is not allowed')
        return v.lower()

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "SecureP@ssw0rd",
                "full_name": "John Doe",
                "organization": "Acme Corp"
            }
        }
    )


class LoginRequest(BaseModel):
    """User login credentials"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    remember_me: bool = Field(False, description="Extended session duration")

    @validator('email')
    def normalize_email(cls, v):
        return v.lower()

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "SecureP@ssw0rd",
                "remember_me": False
            }
        }
    )


class TokenRefreshRequest(BaseModel):
    """Request to refresh access token using refresh token"""
    refresh_token: str = Field(..., description="Valid refresh token")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }
    )


class PasswordResetRequest(BaseModel):
    """Request password reset email"""
    email: EmailStr = Field(..., description="Registered email address")

    @validator('email')
    def normalize_email(cls, v):
        return v.lower()

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com"
            }
        }
    )


class PasswordResetConfirm(BaseModel):
    """Confirm password reset with token and new password"""
    reset_token: str = Field(..., description="Password reset token from email")
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password"
    )

    @validator('new_password')
    def validate_password_strength(cls, v):
        """Same validation as registration"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "reset_token": "a1b2c3d4e5f6...",
                "new_password": "NewSecureP@ssw0rd"
            }
        }
    )


class PasswordChangeRequest(BaseModel):
    """Change password for authenticated user"""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password"
    )

    @validator('new_password')
    def validate_password_strength(cls, v):
        """Same validation as registration"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v

    @validator('new_password')
    def passwords_different(cls, v, values):
        if 'current_password' in values and v == values['current_password']:
            raise ValueError('New password must be different from current password')
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "current_password": "OldP@ssw0rd",
                "new_password": "NewSecureP@ssw0rd"
            }
        }
    )


class LogoutRequest(BaseModel):
    """Logout request - invalidates current session"""
    all_devices: bool = Field(
        False,
        description="If true, logout from all devices/sessions"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "all_devices": False
            }
        }
    )


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class TokenResponse(BaseModel):
    """JWT token pair response"""
    access_token: str = Field(..., description="Short-lived access token (15 min)")
    refresh_token: str = Field(..., description="Long-lived refresh token (30 days)")
    token_type: str = Field("bearer", description="Token type (always 'bearer')")
    expires_in: int = Field(..., description="Access token expiry in seconds")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwiZXhwIjoxNjE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwidHlwZSI6InJlZnJlc2gifQ.IjoxNjE2MjM5MDIyfQ",
                "token_type": "bearer",
                "expires_in": 900
            }
        }
    )


class UserResponse(BaseModel):
    """Public user information"""
    id: str = Field(..., description="Unique user ID")
    email: str = Field(..., description="User email")
    full_name: str = Field(..., description="User's full name")
    organization: Optional[str] = Field(None, description="Organization name")
    is_active: bool = Field(..., description="Account is active")
    is_verified: bool = Field(..., description="Email is verified")
    created_at: datetime = Field(..., description="Account creation timestamp")
    last_login_at: Optional[datetime] = Field(None, description="Last login timestamp")
    role: str = Field(..., description="User role (user, admin, etc)")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "usr_1234567890abcdef",
                "email": "user@example.com",
                "full_name": "John Doe",
                "organization": "Acme Corp",
                "is_active": True,
                "is_verified": True,
                "created_at": "2025-01-15T10:30:00Z",
                "last_login_at": "2025-01-20T14:22:00Z",
                "role": "user"
            }
        }
    )


class LoginResponse(BaseModel):
    """Successful login response"""
    user: UserResponse
    tokens: TokenResponse

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user": {
                    "id": "usr_1234567890abcdef",
                    "email": "user@example.com",
                    "full_name": "John Doe",
                    "organization": "Acme Corp",
                    "is_active": True,
                    "is_verified": True,
                    "created_at": "2025-01-15T10:30:00Z",
                    "last_login_at": "2025-01-20T14:22:00Z",
                    "role": "user"
                },
                "tokens": {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 900
                }
            }
        }
    )


class RegistrationResponse(BaseModel):
    """Successful registration response"""
    user: UserResponse
    tokens: TokenResponse
    message: str = Field(..., description="Success message")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user": {
                    "id": "usr_1234567890abcdef",
                    "email": "user@example.com",
                    "full_name": "John Doe",
                    "organization": "Acme Corp",
                    "is_active": True,
                    "is_verified": False,
                    "created_at": "2025-01-15T10:30:00Z",
                    "last_login_at": None,
                    "role": "user"
                },
                "tokens": {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 900
                },
                "message": "Registration successful. Please check your email to verify your account."
            }
        }
    )


class PasswordResetResponse(BaseModel):
    """Password reset email sent confirmation"""
    message: str = Field(..., description="Confirmation message")
    email: str = Field(..., description="Email where reset link was sent")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message": "Password reset instructions have been sent to your email",
                "email": "user@example.com"
            }
        }
    )


class PasswordResetConfirmResponse(BaseModel):
    """Password reset successful"""
    message: str = Field(..., description="Success message")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message": "Password has been reset successfully. You can now login with your new password."
            }
        }
    )


class SessionInfo(BaseModel):
    """Individual session information"""
    session_id: str = Field(..., description="Session ID")
    device_info: str = Field(..., description="Device/browser information")
    ip_address: str = Field(..., description="IP address")
    created_at: datetime = Field(..., description="Session creation time")
    last_activity: datetime = Field(..., description="Last activity time")
    is_current: bool = Field(..., description="Is this the current session")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "session_id": "ses_abc123",
                "device_info": "Chrome 120 on Windows 10",
                "ip_address": "192.168.1.100",
                "created_at": "2025-01-20T10:00:00Z",
                "last_activity": "2025-01-20T14:30:00Z",
                "is_current": True
            }
        }
    )


class SessionListResponse(BaseModel):
    """List of active sessions"""
    sessions: list[SessionInfo] = Field(..., description="Active sessions")
    total: int = Field(..., description="Total number of sessions")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sessions": [
                    {
                        "session_id": "ses_abc123",
                        "device_info": "Chrome 120 on Windows 10",
                        "ip_address": "192.168.1.100",
                        "created_at": "2025-01-20T10:00:00Z",
                        "last_activity": "2025-01-20T14:30:00Z",
                        "is_current": True
                    }
                ],
                "total": 1
            }
        }
    )


class MessageResponse(BaseModel):
    """Generic success message response"""
    message: str = Field(..., description="Response message")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message": "Operation completed successfully"
            }
        }
    )


# ============================================================================
# INTERNAL MODELS (for JWT payload)
# ============================================================================

class TokenPayload(BaseModel):
    """JWT token payload structure"""
    sub: str = Field(..., description="Subject (user ID)")
    email: str = Field(..., description="User email")
    role: str = Field(..., description="User role")
    type: Literal["access", "refresh"] = Field(..., description="Token type")
    session_id: str = Field(..., description="Session ID for token revocation")
    exp: int = Field(..., description="Expiration timestamp")
    iat: int = Field(..., description="Issued at timestamp")
    jti: str = Field(..., description="JWT ID for token tracking")


class CurrentUser(BaseModel):
    """Currently authenticated user context"""
    id: str
    email: str
    full_name: str
    role: str
    session_id: str
    is_active: bool
    is_verified: bool

    model_config = ConfigDict(from_attributes=True)
