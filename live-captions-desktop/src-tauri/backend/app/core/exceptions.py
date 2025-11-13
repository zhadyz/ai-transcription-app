"""
Custom exception hierarchy for the transcription system.
Provides structured error handling with context preservation.
"""

from typing import Optional, Dict, Any
from datetime import datetime


class TranscriptionBaseException(Exception):
    """Base exception for all transcription-related errors"""
    
    def __init__(
        self,
        message: str,
        error_code: str,
        context: Optional[Dict[str, Any]] = None,
        recoverable: bool = False
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.context = context or {}
        self.recoverable = recoverable
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize exception for logging/API responses"""
        return {
            "error_code": self.error_code,
            "message": self.message,
            "recoverable": self.recoverable,
            "context": self.context,
            "timestamp": self.timestamp.isoformat()
        }


class FileValidationError(TranscriptionBaseException):
    """File validation failed (size, type, corruption)"""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="FILE_VALIDATION_ERROR",
            context=context,
            recoverable=False
        )


class AudioExtractionError(TranscriptionBaseException):
    """FFmpeg failed to extract audio"""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="AUDIO_EXTRACTION_ERROR",
            context=context,
            recoverable=True  # Can retry with different settings
        )


class TranscriptionError(TranscriptionBaseException):
    """Whisper model transcription failed"""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="TRANSCRIPTION_ERROR",
            context=context,
            recoverable=True  # Can retry with different model
        )


class ModelLoadError(TranscriptionBaseException):
    """Failed to load Whisper model"""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="MODEL_LOAD_ERROR",
            context=context,
            recoverable=False  # System-level issue
        )


class ResourceExhaustedError(TranscriptionBaseException):
    """Out of memory or disk space"""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="RESOURCE_EXHAUSTED",
            context=context,
            recoverable=True  # Can retry after cleanup
        )


class TranslationError(TranscriptionBaseException):
    """Translation service failure"""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="TRANSLATION_ERROR",
            context=context,
            recoverable=True  # Can retry or skip translation
        )


class SessionError(TranscriptionBaseException):
    """Session-related errors (expired, not found, etc)"""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="SESSION_ERROR",
            context=context,
            recoverable=False
        )