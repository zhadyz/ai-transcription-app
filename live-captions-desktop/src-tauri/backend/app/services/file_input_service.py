"""
File input service for API v2.
Supports file uploads, URL downloads, and validation.
"""

import asyncio
import aiofiles
import httpx
from pathlib import Path
from typing import Tuple, Optional
from urllib.parse import urlparse
import mimetypes
import logging

from app.core.exceptions import TranscriptionBaseException

logger = logging.getLogger(__name__)


class FileInputError(TranscriptionBaseException):
    """File input errors"""
    def __init__(self, message: str, context: dict = None):
        super().__init__(
            message=message,
            error_code="FILE_INPUT_ERROR",
            context=context,
            recoverable=False
        )


class FileInputService:
    """
    Handle various file input methods with security and validation.
    """

    ALLOWED_EXTENSIONS = {
        "audio": ["mp3", "wav", "m4a", "flac", "aac", "ogg", "wma", "opus"],
        "video": ["mp4", "avi", "mov", "mkv", "webm", "flv", "wmv", "m4v"]
    }

    MAX_DOWNLOAD_SIZE = 5 * 1024 * 1024 * 1024  # 5GB
    DOWNLOAD_TIMEOUT = 600  # 10 minutes
    CHUNK_SIZE = 1024 * 1024  # 1MB chunks

    def __init__(self):
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.DOWNLOAD_TIMEOUT, connect=30.0),
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=50)
        )

    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()

    def validate_extension(self, filename: str) -> Tuple[bool, str]:
        """
        Validate file extension.

        Returns:
            Tuple of (is_valid, file_type)
        """
        ext = Path(filename).suffix.lower().lstrip(".")

        if ext in self.ALLOWED_EXTENSIONS["audio"]:
            return True, "audio"
        elif ext in self.ALLOWED_EXTENSIONS["video"]:
            return True, "video"
        else:
            return False, "unknown"

    def sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename to prevent path traversal attacks.

        Removes dangerous characters and path separators.
        """
        # Remove path separators
        filename = filename.replace("/", "_").replace("\\", "_")

        # Remove null bytes
        filename = filename.replace("\x00", "")

        # Remove parent directory references
        filename = filename.replace("..", "")

        # Limit length
        if len(filename) > 255:
            stem = Path(filename).stem[:200]
            ext = Path(filename).suffix
            filename = stem + ext

        return filename

    async def download_from_url(
        self,
        url: str,
        destination: Path,
        max_size_bytes: Optional[int] = None
    ) -> Tuple[int, str]:
        """
        Download file from URL with security checks.

        Args:
            url: URL to download from
            destination: Local file path to save to
            max_size_bytes: Maximum allowed file size

        Returns:
            Tuple of (file_size_bytes, content_type)

        Raises:
            FileInputError: On download failure, size limit, etc.
        """
        # Validate URL scheme
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            raise FileInputError(
                f"Invalid URL scheme: {parsed.scheme}. Only HTTP(S) allowed.",
                context={"url": url}
            )

        # Block localhost and private IPs (SSRF protection)
        if any(x in parsed.netloc.lower() for x in ["localhost", "127.0.0.1", "0.0.0.0"]):
            raise FileInputError(
                "Localhost URLs not allowed for security reasons",
                context={"url": url}
            )

        try:
            logger.info(f"Downloading file from URL: {url}")

            # Start download with HEAD request to check size
            head_response = await self.http_client.head(url)
            content_length = head_response.headers.get("content-length")
            content_type = head_response.headers.get("content-type", "application/octet-stream")

            if content_length:
                size = int(content_length)

                # Check against absolute max
                if size > self.MAX_DOWNLOAD_SIZE:
                    raise FileInputError(
                        f"File too large: {size / (1024*1024):.2f} MB exceeds maximum of {self.MAX_DOWNLOAD_SIZE / (1024*1024):.0f} MB",
                        context={"size_bytes": size}
                    )

                # Check against API key limit
                if max_size_bytes and size > max_size_bytes:
                    raise FileInputError(
                        f"File size {size / (1024*1024):.2f} MB exceeds your limit of {max_size_bytes / (1024*1024):.2f} MB",
                        context={"size_bytes": size, "limit_bytes": max_size_bytes}
                    )

            # Stream download to disk
            total_downloaded = 0
            destination.parent.mkdir(parents=True, exist_ok=True)

            async with self.http_client.stream("GET", url) as response:
                response.raise_for_status()

                async with aiofiles.open(destination, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=self.CHUNK_SIZE):
                        total_downloaded += len(chunk)

                        # Safety check during download
                        if total_downloaded > self.MAX_DOWNLOAD_SIZE:
                            await f.close()
                            destination.unlink(missing_ok=True)
                            raise FileInputError(
                                f"Download exceeded maximum size during transfer",
                                context={"downloaded_bytes": total_downloaded}
                            )

                        if max_size_bytes and total_downloaded > max_size_bytes:
                            await f.close()
                            destination.unlink(missing_ok=True)
                            raise FileInputError(
                                f"Download exceeded your size limit during transfer",
                                context={"downloaded_bytes": total_downloaded, "limit_bytes": max_size_bytes}
                            )

                        await f.write(chunk)

            logger.info(
                f"Successfully downloaded {total_downloaded / (1024*1024):.2f} MB from {url} "
                f"to {destination}"
            )

            return total_downloaded, content_type

        except httpx.HTTPStatusError as e:
            raise FileInputError(
                f"HTTP error downloading file: {e.response.status_code}",
                context={"url": url, "status_code": e.response.status_code}
            )

        except httpx.TimeoutException:
            raise FileInputError(
                f"Download timeout after {self.DOWNLOAD_TIMEOUT}s",
                context={"url": url}
            )

        except httpx.RequestError as e:
            raise FileInputError(
                f"Network error downloading file: {str(e)}",
                context={"url": url}
            )

        except Exception as e:
            # Cleanup on error
            if destination.exists():
                destination.unlink(missing_ok=True)
            raise FileInputError(
                f"Unexpected error downloading file: {str(e)}",
                context={"url": url}
            )

    def infer_filename_from_url(self, url: str) -> str:
        """
        Infer filename from URL.

        Falls back to generic name if unable to determine.
        """
        parsed = urlparse(url)
        path = Path(parsed.path)

        if path.name and "." in path.name:
            filename = path.name
        else:
            # Generate generic name
            filename = "download.mp4"

        return self.sanitize_filename(filename)

    async def validate_file(
        self,
        file_path: Path,
        allowed_formats: Optional[list] = None
    ) -> dict:
        """
        Validate file exists and is a supported format.

        Returns:
            Dictionary with file metadata
        """
        if not file_path.exists():
            raise FileInputError(
                "File not found",
                context={"path": str(file_path)}
            )

        # Get file info
        file_size = file_path.stat().st_size
        file_ext = file_path.suffix.lower().lstrip(".")

        # Validate extension
        is_valid, file_type = self.validate_extension(file_path.name)

        if not is_valid:
            raise FileInputError(
                f"Unsupported file format: .{file_ext}",
                context={"extension": file_ext}
            )

        # Check against allowed formats
        if allowed_formats and file_ext not in allowed_formats:
            raise FileInputError(
                f"File format .{file_ext} not allowed. Allowed: {', '.join(allowed_formats)}",
                context={"extension": file_ext, "allowed": allowed_formats}
            )

        # Detect MIME type
        mime_type, _ = mimetypes.guess_type(str(file_path))

        return {
            "file_path": str(file_path),
            "file_name": file_path.name,
            "file_size_bytes": file_size,
            "file_size_mb": file_size / (1024 * 1024),
            "extension": file_ext,
            "file_type": file_type,
            "mime_type": mime_type or "application/octet-stream"
        }


# Global service instance
file_input_service = FileInputService()


async def cleanup_file_input_service():
    """Cleanup function for app shutdown"""
    await file_input_service.close()
