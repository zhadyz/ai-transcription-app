import magic
import logging
import time
from pathlib import Path
from typing import Tuple
from app.config import settings

logger = logging.getLogger(__name__)

# Allowed MIME types for uploaded files
ALLOWED_MIME_TYPES = {
    # ==================== AUDIO FORMATS ====================
    # Standard Audio
    'audio/mpeg',           # MP3
    'audio/mp3',            # MP3 (alternative)
    'audio/wav',            # WAV
    'audio/x-wav',          # WAV (alternative)
    'audio/wave',           # WAV (alternative)
    'audio/vnd.wave',       # WAV (alternative)
    
    # MP4/M4A Audio
    'audio/mp4',            # M4A/MP4 audio
    'audio/x-m4a',          # M4A
    'audio/m4a',            # M4A (alternative)
    'audio/aac',            # AAC
    'audio/aacp',           # AAC+
    
    # Compressed/Streaming
    'audio/ogg',            # OGG
    'audio/opus',           # Opus (Discord)
    'audio/webm',           # WebM audio (Discord)
    'audio/flac',           # FLAC
    'audio/x-flac',         # FLAC (alternative)
    
    # Voice Memos & Phone
    'audio/3gpp',           # 3GP (voice memos)
    'audio/3gpp2',          # 3GP2
    'audio/amr',            # AMR (voice recordings)
    'audio/amr-wb',         # AMR Wideband
    
    # Windows/Professional
    'audio/x-ms-wma',       # WMA
    'audio/wma',            # WMA (alternative)
    'audio/aiff',           # AIFF
    'audio/x-aiff',         # AIFF (alternative)
    
    # Other
    'audio/basic',          # Basic audio
    'audio/speex',          # Speex
    'audio/vorbis',         # Vorbis
    
    # ==================== VIDEO FORMATS ====================
    # MP4 Family
    'video/mp4',            # MP4
    'video/x-m4v',          # M4V (MP4 variant)
    'video/m4v',            # M4V
    
    # Common Video
    'video/quicktime',      # MOV
    'video/x-msvideo',      # AVI
    'video/avi',            # AVI (alternative)
    'video/msvideo',        # AVI (alternative)
    
    # Modern/Streaming
    'video/webm',           # WebM (screen recordings)
    'video/x-matroska',     # MKV
    'video/matroska',       # MKV (alternative)
    
    # MPEG Family
    'video/mpeg',           # MPEG
    'video/x-mpeg',         # MPEG (alternative)
    'video/mpg',            # MPG
    
    # Windows
    'video/x-ms-wmv',       # WMV
    'video/x-ms-asf',       # ASF (Windows Media)
    
    # Mobile/3GP
    'video/3gpp',           # 3GP (phone videos)
    'video/3gpp2',          # 3GP2
    'video/3gp',            # 3GP (alternative)
    
    # Other
    'video/ogg',            # OGG video
    'video/x-ogg',          # OGG (alternative)
}


def validate_file_type(file_path: Path) -> Tuple[bool, str, str]:
    """
    Validate file type using magic bytes (actual file content).
    Retries up to 3 times to handle race conditions with disk sync.
    
    Args:
        file_path: Path to the file to validate
        
    Returns:
        Tuple of (is_valid, mime_type, message)
    """
    max_attempts = 3
    retry_delay = 0.2  # 200ms between retries
    
    for attempt in range(max_attempts):
        try:
            # Check if file exists and has size
            if not file_path.exists():
                if attempt < max_attempts - 1:
                    logger.warning(f"File not found on attempt {attempt + 1}, retrying...")
                    time.sleep(retry_delay)
                    continue
                return False, "unknown", f"File not found: {file_path}"
            
            file_size = file_path.stat().st_size
            
            # Check if file is empty
            if file_size == 0:
                if attempt < max_attempts - 1:
                    logger.warning(f"File empty on attempt {attempt + 1}/{max_attempts}, retrying...")
                    time.sleep(retry_delay)
                    continue
                return False, "unknown", "File is empty after multiple checks"
            
            # Get MIME type from file content
            mime = magic.from_file(str(file_path), mime=True)
            
            # If detected as inode/blockdevice, file might not be fully synced yet
            if mime == "inode/blockdevice":
                if attempt < max_attempts - 1:
                    logger.warning(
                        f"File not synced on attempt {attempt + 1}/{max_attempts} "
                        f"(detected as {mime}), retrying..."
                    )
                    time.sleep(retry_delay)
                    continue
                else:
                    logger.error(
                        f"File still detected as {mime} after {max_attempts} attempts. "
                        f"File size: {file_size} bytes. This indicates a disk sync issue."
                    )
                    return False, mime, (
                        f"File validation failed: detected as {mime}. "
                        "This may indicate incomplete file transfer or disk sync issue."
                    )
            
            # Successful detection
            logger.info(f"File {file_path.name} detected as: {mime} ({file_size:,} bytes)")
            
            if mime in ALLOWED_MIME_TYPES:
                return True, mime, "Valid file type"
            else:
                logger.warning(f"Rejected file type: {mime} for file {file_path.name}")
                return False, mime, f"Invalid file type: {mime}. Only audio/video files are allowed."
                
        except Exception as e:
            if attempt < max_attempts - 1:
                logger.warning(f"Validation error on attempt {attempt + 1}/{max_attempts}: {e}")
                time.sleep(retry_delay)
                continue
            else:
                logger.error(f"File validation failed for {file_path} after {max_attempts} attempts: {e}")
                return False, "unknown", f"File validation failed: {str(e)}"
    
    # Should never reach here, but just in case
    return False, "unknown", "File validation failed after retries"


def validate_file_size(file_path: Path, max_size_mb: int = None) -> tuple[bool, str]:
    """Validate file size against limit"""
    if max_size_mb is None:
        max_size_mb = settings.MAX_FILE_SIZE_MB
    
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    
    if file_size_mb > max_size_mb:
        return False, f"File size {file_size_mb:.2f}MB exceeds limit of {max_size_mb}MB"
    
    return True, f"File size OK: {file_size_mb:.2f}MB"


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and other issues.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename
    """
    # Remove path components
    filename = Path(filename).name
    
    # Remove any remaining path separators
    filename = filename.replace('/', '_').replace('\\', '_')
    
    # Remove any null bytes
    filename = filename.replace('\x00', '')
    
    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:240] + ('.' + ext if ext else '')
    
    return filename