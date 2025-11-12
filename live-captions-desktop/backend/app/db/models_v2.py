"""
API v2 Database Models.
Extends existing auth system with API keys, persistent tasks, and usage tracking.
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Float, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import secrets

Base = declarative_base()


class APIKey(Base):
    """
    API keys for external application integration.
    Extends the existing User model for authentication.
    """
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=lambda: f"key_{secrets.token_urlsafe(16)}")
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Key identification
    name = Column(String(255), nullable=False)  # User-friendly name
    key_prefix = Column(String(16), nullable=False, unique=True)  # First 8 chars for identification
    key_hash = Column(String(64), nullable=False, unique=True)  # SHA-256 hash

    # Permissions and limits
    is_active = Column(Boolean, default=True, nullable=False)
    rate_limit_per_hour = Column(Integer, default=100)
    max_file_size_mb = Column(Integer, default=500)
    allowed_formats = Column(Text, default="mp3,wav,mp4,avi,mov,mkv,flac")  # Comma-separated

    # Webhook configuration
    webhook_url = Column(String(2048), nullable=True)
    webhook_secret = Column(String(64), nullable=True)

    # Usage tracking
    total_requests = Column(Integer, default=0)
    total_minutes_transcribed = Column(Float, default=0.0)
    last_used_at = Column(DateTime, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration
    revoked_at = Column(DateTime, nullable=True)

    # Indexes for performance
    __table_args__ = (
        Index('idx_apikey_user', 'user_id'),
        Index('idx_apikey_prefix', 'key_prefix'),
        Index('idx_apikey_active', 'is_active'),
    )

    # Relationships
    user = relationship("User", back_populates="api_keys")
    tasks = relationship("TranscriptionTask", back_populates="api_key", cascade="all, delete-orphan")
    usage_records = relationship("UsageRecord", back_populates="api_key", cascade="all, delete-orphan")


class TranscriptionTask(Base):
    """
    Persistent transcription tasks for API v2.
    Replaces session-based temporary storage with 24h retention.
    """
    __tablename__ = "transcription_tasks"

    id = Column(String(36), primary_key=True)  # UUID format: task_xxx
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    api_key_id = Column(String(36), ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=True)

    # Input information
    input_type = Column(String(16), nullable=False)  # 'file', 'url', 'stream'
    input_url = Column(String(2048), nullable=True)  # For URL-based inputs
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    file_path = Column(String(512), nullable=False)  # Server file path

    # Transcription settings
    language = Column(String(16), nullable=True)
    task_type = Column(String(32), default="transcribe")  # transcribe or translate
    output_format = Column(String(16), default="srt")

    # Processing status
    status = Column(String(32), default="pending", nullable=False)
    # Status values: pending, processing, completed, failed, expired
    progress = Column(Float, default=0.0)
    current_step = Column(String(128), nullable=True)

    # Results
    transcript_text = Column(Text, nullable=True)
    output_file_path = Column(String(512), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    word_count = Column(Integer, nullable=True)

    # Error handling
    error_message = Column(Text, nullable=True)
    error_code = Column(String(64), nullable=True)
    retry_count = Column(Integer, default=0)

    # Webhook tracking
    webhook_url = Column(String(2048), nullable=True)
    webhook_delivered = Column(Boolean, default=False)
    webhook_attempts = Column(Integer, default=0)
    webhook_last_attempt = Column(DateTime, nullable=True)

    # Timing
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)  # Auto-delete after 24h

    # Metadata
    client_metadata = Column(Text, nullable=True)  # JSON string
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(512), nullable=True)

    # Indexes for performance
    __table_args__ = (
        Index('idx_task_user', 'user_id'),
        Index('idx_task_apikey', 'api_key_id'),
        Index('idx_task_status', 'status'),
        Index('idx_task_created', 'created_at'),
        Index('idx_task_expires', 'expires_at'),
    )

    # Relationships
    user = relationship("User", back_populates="transcription_tasks")
    api_key = relationship("APIKey", back_populates="tasks")


class UsageRecord(Base):
    """
    Detailed usage tracking for billing and analytics.
    """
    __tablename__ = "usage_records"

    id = Column(String(36), primary_key=True, default=lambda: f"usg_{secrets.token_urlsafe(16)}")
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    api_key_id = Column(String(36), ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=True)
    task_id = Column(String(36), ForeignKey("transcription_tasks.id", ondelete="CASCADE"), nullable=True)

    # Usage metrics
    operation = Column(String(64), nullable=False)  # transcribe, translate, etc.
    duration_seconds = Column(Float, nullable=False)  # Audio duration
    processing_time_seconds = Column(Float, nullable=True)  # Time to process
    file_size_bytes = Column(Integer, nullable=False)
    word_count = Column(Integer, nullable=True)

    # Cost calculation (for future billing)
    cost_cents = Column(Integer, default=0)  # Cost in cents

    # Request info
    endpoint = Column(String(128), nullable=False)
    status_code = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Indexes for analytics queries
    __table_args__ = (
        Index('idx_usage_user', 'user_id'),
        Index('idx_usage_apikey', 'api_key_id'),
        Index('idx_usage_timestamp', 'timestamp'),
        Index('idx_usage_operation', 'operation'),
    )

    # Relationships
    user = relationship("User", back_populates="usage_records")
    api_key = relationship("APIKey", back_populates="usage_records")


class WebhookLog(Base):
    """
    Webhook delivery attempt logs for debugging and monitoring.
    """
    __tablename__ = "webhook_logs"

    id = Column(String(36), primary_key=True, default=lambda: f"whl_{secrets.token_urlsafe(16)}")
    task_id = Column(String(36), ForeignKey("transcription_tasks.id", ondelete="CASCADE"), nullable=False)

    # Webhook details
    webhook_url = Column(String(2048), nullable=False)
    event_type = Column(String(64), nullable=False)  # task.completed, task.failed, task.progress

    # Delivery status
    status = Column(String(32), nullable=False)  # pending, delivered, failed
    http_status_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Timing
    attempt_number = Column(Integer, default=1, nullable=False)
    attempted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)

    # Payload snapshot
    payload = Column(Text, nullable=False)  # JSON string

    # Indexes
    __table_args__ = (
        Index('idx_webhook_task', 'task_id'),
        Index('idx_webhook_status', 'status'),
        Index('idx_webhook_attempted', 'attempted_at'),
        Index('idx_webhook_retry', 'next_retry_at'),
    )

    # Relationships
    task = relationship("TranscriptionTask", backref="webhook_logs")
