"""
Database models for authentication system.
Uses SQLAlchemy ORM with async support via SQLite/PostgreSQL.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, Index, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()


def generate_id(prefix: str) -> str:
    """Generate unique ID with prefix (e.g., usr_abc123)"""
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


class User(Base):
    """
    User account model.

    Primary authentication entity with support for email verification,
    password resets, and session management.
    """
    __tablename__ = "users"

    # Primary key
    id = Column(String(32), primary_key=True, default=lambda: generate_id("usr"))

    # Authentication credentials
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # User profile
    full_name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)

    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)  # Soft delete

    # Role-based access control
    role = Column(String(50), default="user", nullable=False)  # user, admin, premium

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # Security tracking
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)  # Account lockout timestamp

    # Email verification
    email_verification_token = Column(String(64), nullable=True)
    email_verification_sent_at = Column(DateTime, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)

    # Password reset
    password_reset_token = Column(String(64), nullable=True)
    password_reset_sent_at = Column(DateTime, nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_email_active', 'email', 'is_active'),
        Index('idx_verification_token', 'email_verification_token'),
        Index('idx_reset_token', 'password_reset_token'),
    )

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


class Session(Base):
    """
    User session tracking.

    Tracks active login sessions for multi-device support and
    security auditing. Each login creates a new session.
    """
    __tablename__ = "sessions"

    # Primary key
    id = Column(String(32), primary_key=True, default=lambda: generate_id("ses"))

    # Foreign key
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Session metadata
    device_info = Column(String(500), nullable=True)  # User agent
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    location = Column(String(255), nullable=True)  # Optional geolocation

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_activity_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    # Session status
    is_active = Column(Boolean, default=True, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revocation_reason = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")
    refresh_tokens = relationship("RefreshToken", back_populates="session", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_user_active', 'user_id', 'is_active'),
        Index('idx_expires_at', 'expires_at'),
    )

    def __repr__(self):
        return f"<Session(id={self.id}, user_id={self.user_id}, active={self.is_active})>"


class RefreshToken(Base):
    """
    Refresh token tracking.

    Stores refresh tokens for secure token rotation.
    Each refresh token is single-use and tracked for security.
    """
    __tablename__ = "refresh_tokens"

    # Primary key
    id = Column(String(32), primary_key=True, default=lambda: generate_id("rtk"))

    # Foreign keys
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(32), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)

    # Token data
    token_hash = Column(String(128), unique=True, nullable=False, index=True)  # SHA-256 hash
    jti = Column(String(64), unique=True, nullable=False, index=True)  # JWT ID

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    # Token rotation tracking
    replaced_by_token_id = Column(String(32), nullable=True)  # For token rotation chain

    # Status
    is_revoked = Column(Boolean, default=False, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
    session = relationship("Session", back_populates="refresh_tokens")

    # Indexes
    __table_args__ = (
        Index('idx_token_valid', 'token_hash', 'is_revoked', 'is_used'),
        Index('idx_expires_at', 'expires_at'),
        Index('idx_jti', 'jti'),
    )

    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, revoked={self.is_revoked})>"


class AuditLog(Base):
    """
    Security audit log.

    Tracks all authentication-related events for security monitoring,
    compliance, and troubleshooting.
    """
    __tablename__ = "audit_logs"

    # Primary key
    id = Column(String(32), primary_key=True, default=lambda: generate_id("log"))

    # Foreign key (optional - some events may not be user-specific)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Event details
    event_type = Column(String(50), nullable=False)  # login, logout, password_change, etc.
    event_status = Column(String(20), nullable=False)  # success, failure, error
    event_description = Column(Text, nullable=True)

    # Request metadata
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_id = Column(String(64), nullable=True)  # For distributed tracing

    # Additional context (JSON serialized)
    metadata = Column(Text, nullable=True)  # Store as JSON string

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    # Indexes
    __table_args__ = (
        Index('idx_user_event', 'user_id', 'event_type'),
        Index('idx_event_time', 'event_type', 'created_at'),
        Index('idx_created_at', 'created_at'),
    )

    def __repr__(self):
        return f"<AuditLog(id={self.id}, event={self.event_type}, status={self.event_status})>"


class RateLimitEntry(Base):
    """
    Rate limiting tracking.

    Tracks API usage for rate limiting and abuse prevention.
    Alternative to Redis for simple deployments.
    """
    __tablename__ = "rate_limits"

    # Composite key
    id = Column(String(32), primary_key=True, default=lambda: generate_id("rlt"))

    # Identifier (IP address or user ID)
    identifier = Column(String(255), nullable=False, index=True)
    identifier_type = Column(String(20), nullable=False)  # ip, user, api_key

    # Endpoint being rate limited
    endpoint = Column(String(255), nullable=False)

    # Rate limit tracking
    request_count = Column(Integer, default=0, nullable=False)
    window_start = Column(DateTime, default=datetime.utcnow, nullable=False)
    window_end = Column(DateTime, nullable=False)

    # Status
    is_blocked = Column(Boolean, default=False, nullable=False)
    blocked_until = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Indexes
    __table_args__ = (
        Index('idx_identifier_endpoint', 'identifier', 'endpoint'),
        Index('idx_window_end', 'window_end'),
    )

    def __repr__(self):
        return f"<RateLimitEntry(identifier={self.identifier}, endpoint={self.endpoint}, count={self.request_count})>"


# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def create_all_tables(engine):
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)


def drop_all_tables(engine):
    """Drop all database tables (USE WITH CAUTION)"""
    Base.metadata.drop_all(bind=engine)
