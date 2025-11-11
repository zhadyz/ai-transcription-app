"""
Application configuration management.
Centralized settings with environment variable support and validation.
"""

from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """
    Application settings with validation and environment variable support.
    
    Environment variables override defaults:
        export WHISPER_DEVICE=cpu
        export MAX_FILE_SIZE_MB=1000
        export ENV=production
    """
    
    # Environment
    ENV: Literal["development", "production"] = "development"  # ← ADD THIS
    
    # API Server Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Whisper Model Configuration
    WHISPER_MODEL: str = "small"
    WHISPER_DEVICE: Literal["auto", "cpu", "cuda"] = "auto"
    WHISPER_COMPUTE_TYPE: Literal["auto", "float16", "int8"] = "auto"
    
    # Processing Limits
    MAX_CONCURRENT_TRANSCRIPTIONS: int = 2
    MAX_FILE_SIZE_MB: int = 5000
    
    # Session Management
    SESSION_TIMEOUT_SECONDS: int = 3600  # 1 hour
    CLEANUP_INTERVAL_SECONDS: int = 600  # 10 minutes
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # Translation Service
    LIBRETRANSLATE_URL: str = "http://localhost:5000"
    
    # API Authentication (Legacy - Simple API Keys)
    REQUIRE_AUTH: bool = False
    ALLOWED_API_KEYS: list[str] = [
        "dev-key-12345",      # Development key
        "prod-key-67890",     # Production key
        "mobile-key-abcde"    # Mobile client key
    ]

    # JWT Authentication (New System)
    JWT_SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION_USE_SECURE_RANDOM_KEY"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./db/auth.db"  # Override with PostgreSQL in production

    # Security Note: In production, load keys from environment variables:
    # export JWT_SECRET_KEY='your-very-secure-secret-key'
    # export DATABASE_URL='postgresql://user:pass@localhost/dbname'
    # export ALLOWED_API_KEYS='["key1","key2","key3"]'
    
    # ═══════════════════════════════════════════════════════════════════════
    # COMPUTED PROPERTIES
    # ═══════════════════════════════════════════════════════════════════════
    
    @property
    def IS_DEVELOPMENT(self) -> bool:  # ← ADD THIS
        """Check if running in development mode."""
        return self.ENV == "development"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()