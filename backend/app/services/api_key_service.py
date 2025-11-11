"""
API Key management service.
Secure generation, validation, and lifecycle management of API keys.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models_v2 import APIKey
from app.core.exceptions import TranscriptionBaseException

import logging
logger = logging.getLogger(__name__)


class APIKeyError(TranscriptionBaseException):
    """API key related errors"""
    def __init__(self, message: str, context: dict = None):
        super().__init__(
            message=message,
            error_code="API_KEY_ERROR",
            context=context,
            recoverable=False
        )


class APIKeyService:
    """
    API key management with secure practices.

    Key Format: tapi_<prefix>_<secret>
    Example: tapi_AbC12345_xyz789...

    - Only the hash is stored in database
    - Full key shown only once at creation
    - Prefix used for key identification (first 8 chars)
    """

    KEY_PREFIX = "tapi"  # Transcription API
    PREFIX_LENGTH = 8
    SECRET_LENGTH = 32

    @staticmethod
    def generate_api_key() -> Tuple[str, str, str]:
        """
        Generate new API key with prefix and hash.

        Returns:
            Tuple of (full_key, key_prefix, key_hash)
        """
        # Generate random components
        prefix_secret = secrets.token_urlsafe(6)[:APIKeyService.PREFIX_LENGTH]
        key_secret = secrets.token_urlsafe(APIKeyService.SECRET_LENGTH)

        # Construct full key: tapi_AbC12345_xyz789...
        full_key = f"{APIKeyService.KEY_PREFIX}_{prefix_secret}_{key_secret}"

        # Create prefix for identification
        key_prefix = f"{APIKeyService.KEY_PREFIX}_{prefix_secret}"

        # Hash for storage
        key_hash = APIKeyService.hash_key(full_key)

        return full_key, key_prefix, key_hash

    @staticmethod
    def hash_key(key: str) -> str:
        """Hash API key using SHA-256"""
        return hashlib.sha256(key.encode()).hexdigest()

    @staticmethod
    def validate_key_format(key: str) -> bool:
        """Validate API key format"""
        if not key.startswith(f"{APIKeyService.KEY_PREFIX}_"):
            return False

        parts = key.split("_")
        if len(parts) != 3:
            return False

        # Check prefix length (approximately)
        if len(parts[1]) < 6:
            return False

        # Check secret length (approximately)
        if len(parts[2]) < 20:
            return False

        return True

    def create_api_key(
        self,
        db: Session,
        user_id: str,
        name: str,
        rate_limit_per_hour: int = 100,
        max_file_size_mb: int = 500,
        allowed_formats: str = "mp3,wav,mp4,avi,mov,mkv,flac",
        webhook_url: Optional[str] = None,
        expires_in_days: Optional[int] = None
    ) -> Tuple[APIKey, str]:
        """
        Create new API key for user.

        Args:
            db: Database session
            user_id: User ID
            name: Human-friendly key name
            rate_limit_per_hour: Requests per hour limit
            max_file_size_mb: Max file size in MB
            allowed_formats: Comma-separated formats
            webhook_url: Default webhook URL
            expires_in_days: Key expiration (None = never)

        Returns:
            Tuple of (APIKey object, full_api_key_string)

        Security Note:
            The full API key is returned ONLY at creation time.
            Store it securely - it cannot be retrieved later.
        """
        # Generate key
        full_key, key_prefix, key_hash = self.generate_api_key()

        # Generate webhook secret if URL provided
        webhook_secret = None
        if webhook_url:
            webhook_secret = secrets.token_urlsafe(32)

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        # Create database record
        api_key = APIKey(
            user_id=user_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            rate_limit_per_hour=rate_limit_per_hour,
            max_file_size_mb=max_file_size_mb,
            allowed_formats=allowed_formats,
            webhook_url=webhook_url,
            webhook_secret=webhook_secret,
            expires_at=expires_at
        )

        db.add(api_key)
        db.commit()
        db.refresh(api_key)

        logger.info(
            f"Created API key {api_key.id} for user {user_id}: "
            f"{name} (prefix: {key_prefix})"
        )

        return api_key, full_key

    def validate_api_key(
        self,
        db: Session,
        api_key: str,
        check_rate_limit: bool = False
    ) -> APIKey:
        """
        Validate API key and return associated record.

        Args:
            db: Database session
            api_key: Full API key string
            check_rate_limit: Whether to enforce rate limit

        Returns:
            APIKey object if valid

        Raises:
            APIKeyError: If key invalid, expired, or rate limited
        """
        # Validate format
        if not self.validate_key_format(api_key):
            logger.warning(f"Invalid API key format: {api_key[:20]}...")
            raise APIKeyError("Invalid API key format")

        # Hash key for lookup
        key_hash = self.hash_key(api_key)

        # Find key in database
        api_key_record = db.query(APIKey).filter(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True
        ).first()

        if not api_key_record:
            logger.warning(f"API key not found or inactive: {api_key[:20]}...")
            raise APIKeyError("Invalid or inactive API key")

        # Check expiration
        if api_key_record.expires_at and api_key_record.expires_at < datetime.utcnow():
            logger.warning(f"API key expired: {api_key_record.id}")
            raise APIKeyError(
                "API key has expired",
                context={"expired_at": api_key_record.expires_at.isoformat()}
            )

        # Rate limiting check
        if check_rate_limit:
            self._check_rate_limit(db, api_key_record)

        # Update last used timestamp
        api_key_record.last_used_at = datetime.utcnow()
        db.commit()

        return api_key_record

    def _check_rate_limit(self, db: Session, api_key_record: APIKey):
        """
        Check if API key has exceeded rate limit.

        Raises:
            APIKeyError: If rate limit exceeded
        """
        from app.db.models_v2 import UsageRecord

        # Count requests in last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)

        recent_requests = db.query(UsageRecord).filter(
            and_(
                UsageRecord.api_key_id == api_key_record.id,
                UsageRecord.timestamp >= one_hour_ago
            )
        ).count()

        if recent_requests >= api_key_record.rate_limit_per_hour:
            logger.warning(
                f"Rate limit exceeded for API key {api_key_record.id}: "
                f"{recent_requests}/{api_key_record.rate_limit_per_hour}"
            )
            raise APIKeyError(
                "Rate limit exceeded",
                context={
                    "limit": api_key_record.rate_limit_per_hour,
                    "period": "1 hour",
                    "reset_at": (one_hour_ago + timedelta(hours=1)).isoformat()
                }
            )

    def revoke_api_key(self, db: Session, api_key_id: str, user_id: str) -> bool:
        """
        Revoke (deactivate) an API key.

        Args:
            db: Database session
            api_key_id: API key ID
            user_id: User ID (for authorization check)

        Returns:
            True if revoked successfully

        Raises:
            APIKeyError: If key not found or unauthorized
        """
        api_key = db.query(APIKey).filter(
            APIKey.id == api_key_id,
            APIKey.user_id == user_id
        ).first()

        if not api_key:
            raise APIKeyError(
                "API key not found or unauthorized",
                context={"api_key_id": api_key_id}
            )

        api_key.is_active = False
        api_key.revoked_at = datetime.utcnow()

        db.commit()

        logger.info(f"Revoked API key {api_key_id} for user {user_id}")

        return True

    def list_user_api_keys(self, db: Session, user_id: str, include_inactive: bool = False):
        """
        List all API keys for a user.

        Args:
            db: Database session
            user_id: User ID
            include_inactive: Include revoked/inactive keys

        Returns:
            List of APIKey objects (without full key)
        """
        query = db.query(APIKey).filter(APIKey.user_id == user_id)

        if not include_inactive:
            query = query.filter(APIKey.is_active == True)

        return query.order_by(APIKey.created_at.desc()).all()

    def update_api_key(
        self,
        db: Session,
        api_key_id: str,
        user_id: str,
        name: Optional[str] = None,
        rate_limit_per_hour: Optional[int] = None,
        max_file_size_mb: Optional[int] = None,
        webhook_url: Optional[str] = None
    ) -> APIKey:
        """
        Update API key settings.

        Args:
            db: Database session
            api_key_id: API key ID
            user_id: User ID (for authorization)
            name: New name
            rate_limit_per_hour: New rate limit
            max_file_size_mb: New file size limit
            webhook_url: New webhook URL

        Returns:
            Updated APIKey object

        Raises:
            APIKeyError: If key not found or unauthorized
        """
        api_key = db.query(APIKey).filter(
            APIKey.id == api_key_id,
            APIKey.user_id == user_id
        ).first()

        if not api_key:
            raise APIKeyError(
                "API key not found or unauthorized",
                context={"api_key_id": api_key_id}
            )

        # Update fields
        if name is not None:
            api_key.name = name
        if rate_limit_per_hour is not None:
            api_key.rate_limit_per_hour = rate_limit_per_hour
        if max_file_size_mb is not None:
            api_key.max_file_size_mb = max_file_size_mb
        if webhook_url is not None:
            api_key.webhook_url = webhook_url
            # Regenerate webhook secret if URL changed
            if webhook_url:
                api_key.webhook_secret = secrets.token_urlsafe(32)

        db.commit()
        db.refresh(api_key)

        logger.info(f"Updated API key {api_key_id} for user {user_id}")

        return api_key

    def get_api_key_stats(self, db: Session, api_key_id: str, user_id: str) -> dict:
        """
        Get usage statistics for an API key.

        Returns:
            Dictionary with usage stats
        """
        from app.db.models_v2 import UsageRecord

        api_key = db.query(APIKey).filter(
            APIKey.id == api_key_id,
            APIKey.user_id == user_id
        ).first()

        if not api_key:
            raise APIKeyError("API key not found or unauthorized")

        # Calculate stats
        total_usage = db.query(UsageRecord).filter(
            UsageRecord.api_key_id == api_key_id
        ).all()

        # Last 24 hours
        last_24h = datetime.utcnow() - timedelta(hours=24)
        recent_usage = [u for u in total_usage if u.timestamp >= last_24h]

        return {
            "api_key_id": api_key_id,
            "name": api_key.name,
            "created_at": api_key.created_at.isoformat(),
            "last_used_at": api_key.last_used_at.isoformat() if api_key.last_used_at else None,
            "total_requests": api_key.total_requests,
            "total_minutes_transcribed": api_key.total_minutes_transcribed,
            "last_24h": {
                "requests": len(recent_usage),
                "minutes_transcribed": sum(u.duration_seconds / 60 for u in recent_usage),
                "total_size_mb": sum(u.file_size_bytes for u in recent_usage) / (1024 * 1024)
            },
            "limits": {
                "rate_limit_per_hour": api_key.rate_limit_per_hour,
                "max_file_size_mb": api_key.max_file_size_mb,
                "allowed_formats": api_key.allowed_formats.split(",")
            }
        }


# Global service instance
api_key_service = APIKeyService()
