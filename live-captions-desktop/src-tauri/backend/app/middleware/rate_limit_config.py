"""
Centralized rate limit configuration.
Adjust all limits from this single file.
"""

from app.config import settings  # ← USE EXISTING CONFIG

# ═══════════════════════════════════════════════════════════════════════════
# RATE LIMIT DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════

# Development: Very high limits for testing
# Production: Strict limits for security

if settings.IS_DEVELOPMENT:
    # Development Limits (Generous)
    SESSION_CREATE_LIMIT = "99999/hour"
    SESSION_UPLOAD_LIMIT = "99999/hour"
    TRANSCRIPTION_UPLOAD_LIMIT = "99999/hour"
    GENERAL_API_LIMIT = "99999/minute"
else:
    # Production Limits (Strict)
    SESSION_CREATE_LIMIT = "50/hour"          # QR code generation
    SESSION_UPLOAD_LIMIT = "20/hour"          # Mobile file uploads
    TRANSCRIPTION_UPLOAD_LIMIT = "30/hour"    # Desktop file uploads
    GENERAL_API_LIMIT = "1000/hour"           # General API calls

# ═══════════════════════════════════════════════════════════════════════════
# EXPORT ALL LIMITS
# ═══════════════════════════════════════════════════════════════════════════

__all__ = [
    'SESSION_CREATE_LIMIT',
    'SESSION_UPLOAD_LIMIT', 
    'TRANSCRIPTION_UPLOAD_LIMIT',
    'GENERAL_API_LIMIT',
]