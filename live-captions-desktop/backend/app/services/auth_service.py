"""
Authentication service.
Core authentication logic including JWT, password hashing, and user management.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple
import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.db.models import User, Session as DBSession, RefreshToken, AuditLog
from app.models.auth import TokenPayload, CurrentUser
from app.core.exceptions import TranscriptionBaseException
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

from app.config import settings

# JWT Configuration
JWT_SECRET_KEY = settings.JWT_SECRET_KEY
JWT_ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
PASSWORD_RESET_EXPIRE_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================================================
# CUSTOM EXCEPTIONS
# ============================================================================

class AuthenticationError(TranscriptionBaseException):
    """Authentication failed"""

    def __init__(self, message: str, context: dict = None):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_ERROR",
            context=context,
            recoverable=False
        )


class AuthorizationError(TranscriptionBaseException):
    """User not authorized"""

    def __init__(self, message: str, context: dict = None):
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            context=context,
            recoverable=False
        )


class TokenExpiredError(TranscriptionBaseException):
    """Token has expired"""

    def __init__(self, message: str = "Token has expired"):
        super().__init__(
            message=message,
            error_code="TOKEN_EXPIRED",
            context={},
            recoverable=True
        )


class InvalidTokenError(TranscriptionBaseException):
    """Invalid token"""

    def __init__(self, message: str = "Invalid token"):
        super().__init__(
            message=message,
            error_code="INVALID_TOKEN",
            context={},
            recoverable=False
        )


# ============================================================================
# PASSWORD UTILITIES
# ============================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token"""
    return secrets.token_urlsafe(length)


def hash_token(token: str) -> str:
    """Hash a token using SHA-256 for storage"""
    return hashlib.sha256(token.encode()).hexdigest()


# ============================================================================
# JWT UTILITIES
# ============================================================================

def create_access_token(
    user_id: str,
    email: str,
    role: str,
    session_id: str
) -> Tuple[str, int]:
    """
    Create a short-lived access token.

    Returns:
        Tuple of (token, expires_in_seconds)
    """
    now = datetime.utcnow()
    expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = now + expires_delta

    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "session_id": session_id,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": secrets.token_urlsafe(16)
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, int(expires_delta.total_seconds())


def create_refresh_token(
    user_id: str,
    email: str,
    role: str,
    session_id: str,
    remember_me: bool = False
) -> Tuple[str, datetime, str]:
    """
    Create a long-lived refresh token.

    Returns:
        Tuple of (token, expires_at, jti)
    """
    now = datetime.utcnow()
    expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS * (2 if remember_me else 1))
    expire = now + expires_delta

    jti = secrets.token_urlsafe(16)

    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "refresh",
        "session_id": session_id,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": jti
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, expire, jti


def decode_token(token: str) -> TokenPayload:
    """
    Decode and validate JWT token.

    Raises:
        TokenExpiredError: If token has expired
        InvalidTokenError: If token is invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError("Token has expired")
    except jwt.JWTError as e:
        raise InvalidTokenError(f"Invalid token: {str(e)}")


# ============================================================================
# USER MANAGEMENT
# ============================================================================

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email address"""
    return db.query(User).filter(
        User.email == email.lower(),
        User.is_deleted == False
    ).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Get user by ID"""
    return db.query(User).filter(
        User.id == user_id,
        User.is_deleted == False
    ).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    organization: Optional[str] = None,
    role: str = "user"
) -> User:
    """
    Create a new user account.

    Args:
        db: Database session
        email: User email (will be normalized)
        password: Plain text password (will be hashed)
        full_name: User's full name
        organization: Optional organization name
        role: User role (default: "user")

    Returns:
        Created User object
    """
    # Check if user already exists
    existing_user = get_user_by_email(db, email)
    if existing_user:
        raise AuthenticationError(
            "User with this email already exists",
            context={"email": email}
        )

    # Hash password
    password_hash = hash_password(password)

    # Generate email verification token
    verification_token = generate_secure_token()

    # Create user
    user = User(
        email=email.lower(),
        password_hash=password_hash,
        full_name=full_name,
        organization=organization,
        role=role,
        email_verification_token=verification_token,
        email_verification_sent_at=datetime.utcnow()
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"Created new user: {user.id} ({user.email})")

    return user


def authenticate_user(
    db: Session,
    email: str,
    password: str
) -> Optional[User]:
    """
    Authenticate user with email and password.

    Returns:
        User object if authentication successful, None otherwise
    """
    user = get_user_by_email(db, email)

    if not user:
        logger.warning(f"Login attempt for non-existent user: {email}")
        return None

    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.utcnow():
        logger.warning(f"Login attempt for locked account: {email}")
        raise AuthenticationError(
            f"Account is locked until {user.locked_until.isoformat()}",
            context={"locked_until": user.locked_until}
        )

    # Verify password
    if not verify_password(password, user.password_hash):
        # Increment failed login attempts
        user.failed_login_attempts += 1

        # Lock account after 5 failed attempts
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.utcnow() + timedelta(minutes=30)
            logger.warning(f"Account locked after 5 failed attempts: {email}")

        db.commit()
        logger.warning(f"Failed login attempt for {email} (attempt {user.failed_login_attempts})")
        return None

    # Check if account is active
    if not user.is_active:
        logger.warning(f"Login attempt for inactive account: {email}")
        raise AuthenticationError(
            "Account is inactive. Please contact support.",
            context={"user_id": user.id}
        )

    # Reset failed login attempts on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()

    db.commit()
    db.refresh(user)

    logger.info(f"Successful login: {user.id} ({user.email})")

    return user


def change_password(
    db: Session,
    user_id: str,
    current_password: str,
    new_password: str
) -> bool:
    """
    Change user password.

    Returns:
        True if password changed successfully

    Raises:
        AuthenticationError: If current password is incorrect
    """
    user = get_user_by_id(db, user_id)

    if not user:
        raise AuthenticationError("User not found")

    # Verify current password
    if not verify_password(current_password, user.password_hash):
        raise AuthenticationError("Current password is incorrect")

    # Hash and update new password
    user.password_hash = hash_password(new_password)
    db.commit()

    logger.info(f"Password changed for user: {user.id}")

    return True


def initiate_password_reset(db: Session, email: str) -> Optional[str]:
    """
    Initiate password reset process.

    Returns:
        Reset token if user found, None otherwise
    """
    user = get_user_by_email(db, email)

    if not user:
        # Don't reveal if user exists
        logger.info(f"Password reset requested for non-existent email: {email}")
        return None

    # Generate reset token
    reset_token = generate_secure_token()
    user.password_reset_token = reset_token
    user.password_reset_sent_at = datetime.utcnow()
    user.password_reset_expires_at = datetime.utcnow() + timedelta(hours=PASSWORD_RESET_EXPIRE_HOURS)

    db.commit()

    logger.info(f"Password reset initiated for user: {user.id}")

    return reset_token


def confirm_password_reset(
    db: Session,
    reset_token: str,
    new_password: str
) -> bool:
    """
    Confirm password reset with token.

    Returns:
        True if password reset successful

    Raises:
        InvalidTokenError: If token is invalid or expired
    """
    user = db.query(User).filter(
        User.password_reset_token == reset_token,
        User.is_deleted == False
    ).first()

    if not user:
        raise InvalidTokenError("Invalid or expired reset token")

    # Check if token has expired
    if user.password_reset_expires_at < datetime.utcnow():
        raise TokenExpiredError("Password reset token has expired")

    # Update password
    user.password_hash = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_sent_at = None
    user.password_reset_expires_at = None
    user.failed_login_attempts = 0
    user.locked_until = None

    db.commit()

    logger.info(f"Password reset completed for user: {user.id}")

    return True


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

def create_session(
    db: Session,
    user_id: str,
    device_info: Optional[str] = None,
    ip_address: Optional[str] = None,
    remember_me: bool = False
) -> DBSession:
    """Create a new user session"""
    expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS * (2 if remember_me else 1))

    session = DBSession(
        user_id=user_id,
        device_info=device_info,
        ip_address=ip_address,
        expires_at=datetime.utcnow() + expires_delta
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info(f"Created session {session.id} for user {user_id}")

    return session


def get_active_session(db: Session, session_id: str) -> Optional[DBSession]:
    """Get active session by ID"""
    return db.query(DBSession).filter(
        DBSession.id == session_id,
        DBSession.is_active == True,
        DBSession.expires_at > datetime.utcnow()
    ).first()


def revoke_session(db: Session, session_id: str, reason: str = "logout") -> bool:
    """Revoke a user session"""
    session = db.query(DBSession).filter(DBSession.id == session_id).first()

    if not session:
        return False

    session.is_active = False
    session.revoked_at = datetime.utcnow()
    session.revocation_reason = reason

    # Revoke all refresh tokens for this session
    db.query(RefreshToken).filter(
        RefreshToken.session_id == session_id
    ).update({
        "is_revoked": True,
        "revoked_at": datetime.utcnow()
    })

    db.commit()

    logger.info(f"Revoked session {session_id}: {reason}")

    return True


def revoke_all_user_sessions(db: Session, user_id: str, except_session_id: Optional[str] = None):
    """Revoke all sessions for a user (except optionally one)"""
    query = db.query(DBSession).filter(
        DBSession.user_id == user_id,
        DBSession.is_active == True
    )

    if except_session_id:
        query = query.filter(DBSession.id != except_session_id)

    sessions = query.all()

    for session in sessions:
        revoke_session(db, session.id, reason="logout_all_devices")

    logger.info(f"Revoked {len(sessions)} sessions for user {user_id}")


# ============================================================================
# REFRESH TOKEN MANAGEMENT
# ============================================================================

def store_refresh_token(
    db: Session,
    token: str,
    jti: str,
    user_id: str,
    session_id: str,
    expires_at: datetime
) -> RefreshToken:
    """Store refresh token in database"""
    token_hash = hash_token(token)

    refresh_token = RefreshToken(
        user_id=user_id,
        session_id=session_id,
        token_hash=token_hash,
        jti=jti,
        expires_at=expires_at
    )

    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)

    return refresh_token


def verify_refresh_token(db: Session, token: str) -> Optional[RefreshToken]:
    """Verify refresh token is valid and not revoked"""
    token_hash = hash_token(token)

    refresh_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.is_revoked == False,
        RefreshToken.is_used == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()

    return refresh_token


# ============================================================================
# AUDIT LOGGING
# ============================================================================

def log_audit_event(
    db: Session,
    event_type: str,
    event_status: str,
    user_id: Optional[str] = None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[str] = None
):
    """Log authentication event to audit log"""
    log_entry = AuditLog(
        user_id=user_id,
        event_type=event_type,
        event_status=event_status,
        event_description=description,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        metadata=metadata
    )

    db.add(log_entry)
    db.commit()
