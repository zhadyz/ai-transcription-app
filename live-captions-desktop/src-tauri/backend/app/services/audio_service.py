import ffmpeg
import os
from pathlib import Path
import logging
from typing import Optional, Tuple
import shutil

from app.core.exceptions import AudioExtractionError, ResourceExhaustedError
from app.core.retry import retry_with_backoff

logger = logging.getLogger(__name__)


class AudioService:
    """Service for audio extraction and conversion using FFmpeg."""
    
    def __init__(self, output_dir: str = "./storage/processed"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._validate_storage()
    
    def _validate_storage(self) -> None:
        """Ensure sufficient disk space for processing"""
        try:
            stat = shutil.disk_usage(self.output_dir)
            free_gb = stat.free / (1024 ** 3)
            
            if free_gb < 1.0:  # Less than 1GB free
                raise ResourceExhaustedError(
                    f"Low disk space: {free_gb:.2f}GB remaining",
                    context={"free_space_gb": free_gb, "path": str(self.output_dir)}
                )
            
            logger.debug(f"Storage validated: {free_gb:.2f}GB free")
        except ResourceExhaustedError:
            raise
        except Exception as e:
            logger.warning(f"Could not validate storage: {e}")
    
    def _validate_input_file(self, input_path: str) -> Tuple[bool, Optional[str]]:
        """
        Validate input file exists and is accessible.
        
        Returns:
            (is_valid, error_message)
        """
        path = Path(input_path)
        
        if not path.exists():
            return False, f"Input file not found: {input_path}"
        
        if not path.is_file():
            return False, f"Input path is not a file: {input_path}"
        
        if path.stat().st_size == 0:
            return False, "Input file is empty"
        
        # Check if file is readable
        if not os.access(path, os.R_OK):
            return False, f"Input file is not readable: {input_path}"
        
        return True, None
    
    @retry_with_backoff(
        max_attempts=3,
        initial_delay=2.0,
        exceptions=(AudioExtractionError,)
    )
    def extract_audio(self, input_path: str, task_id: str) -> str:
        """
        Extract audio from video/audio file and convert to 16kHz mono WAV.
        Automatically retries on transient failures.
        
        Args:
            input_path: Path to input file
            task_id: Unique task identifier
            
        Returns:
            Path to extracted audio file
            
        Raises:
            AudioExtractionError: If extraction fails after retries
            ResourceExhaustedError: If disk space insufficient
        """
        # Validate storage before processing
        self._validate_storage()
        
        # Validate input file
        is_valid, error_msg = self._validate_input_file(input_path)
        if not is_valid:
            raise AudioExtractionError(
                error_msg,
                context={"input_path": input_path, "task_id": task_id}
            )
        
        output_path = self.output_dir / f"{task_id}.wav"
        
        try:
            logger.info(f"Extracting audio: {Path(input_path).name} -> {output_path.name}")
            
            # Get input file info for better error context
            input_size_mb = Path(input_path).stat().st_size / (1024 * 1024)
            logger.debug(f"Input file size: {input_size_mb:.2f}MB")
            
            # FFmpeg command: convert to 16kHz mono WAV
            (
                ffmpeg
                .input(input_path)
                .output(
                    str(output_path),
                    acodec='pcm_s16le',  # 16-bit PCM
                    ac=1,                # Mono
                    ar='16000',          # 16kHz sample rate
                    loglevel='error'     # Only show errors
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            
            # Validate output
            if not output_path.exists():
                raise AudioExtractionError(
                    "FFmpeg completed but output file was not created",
                    context={
                        "input_path": input_path,
                        "output_path": str(output_path),
                        "task_id": task_id
                    }
                )
            
            output_size_mb = output_path.stat().st_size / (1024 * 1024)
            
            if output_size_mb == 0:
                raise AudioExtractionError(
                    "Output audio file is empty",
                    context={
                        "input_path": input_path,
                        "output_path": str(output_path),
                        "task_id": task_id
                    }
                )
            
            logger.info(
                f"Audio extracted successfully: {output_path.name} ({output_size_mb:.2f}MB)"
            )
            return str(output_path)
            
        except ffmpeg.Error as e:
            # Parse FFmpeg error for better diagnostics
            error_output = e.stderr.decode('utf-8') if e.stderr else str(e)
            
            # Clean up partial output if exists
            if output_path.exists():
                try:
                    output_path.unlink()
                except Exception:
                    pass
            
            # Determine if error is recoverable
            recoverable_errors = [
                'Invalid data found when processing input',
                'Temporary failure in name resolution',
                'Connection timed out'
            ]
            
            is_recoverable = any(err in error_output for err in recoverable_errors)
            
            logger.error(
                f"FFmpeg extraction failed: {error_output[:500]}",
                extra={"task_id": task_id, "recoverable": is_recoverable}
            )
            
            raise AudioExtractionError(
                f"Audio extraction failed: {error_output[:200]}",
                context={
                    "input_path": input_path,
                    "task_id": task_id,
                    "ffmpeg_error": error_output[:500]
                }
            )
        
        except Exception as e:
            # Unexpected error - clean up and re-raise
            if output_path.exists():
                try:
                    output_path.unlink()
                except Exception:
                    pass
            
            logger.error(f"Unexpected error during audio extraction: {e}", exc_info=True)
            raise AudioExtractionError(
                f"Unexpected error: {str(e)}",
                context={"input_path": input_path, "task_id": task_id}
            )
    
    def get_audio_duration(self, file_path: str) -> float:
        """
        Get audio duration in seconds.
        
        Args:
            file_path: Path to audio file
            
        Returns:
            Duration in seconds, or 0.0 if unable to determine
        """
        try:
            logger.debug(f"Probing audio duration: {Path(file_path).name}")
            probe = ffmpeg.probe(file_path)
            
            # Try format duration first
            if 'format' in probe and 'duration' in probe['format']:
                duration = float(probe['format']['duration'])
                logger.debug(f"Duration: {duration:.2f}s")
                return duration
            
            # Fallback to stream duration
            if 'streams' in probe and len(probe['streams']) > 0:
                for stream in probe['streams']:
                    if 'duration' in stream:
                        duration = float(stream['duration'])
                        logger.debug(f"Duration from stream: {duration:.2f}s")
                        return duration
            
            logger.warning(f"Could not determine duration for {file_path}")
            return 0.0
            
        except ffmpeg.Error as e:
            error_msg = e.stderr.decode('utf-8') if e.stderr else str(e)
            logger.error(f"FFmpeg probe failed for {file_path}: {error_msg}")
            return 0.0
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Failed to parse duration for {file_path}: {e}")
            return 0.0
        except Exception as e:
            logger.error(f"Unexpected error getting duration for {file_path}: {e}")
            return 0.0
    
    def cleanup(self, file_path: str) -> None:
        """
        Delete temporary audio file with error handling.
        
        Args:
            file_path: Path to file to delete
        """
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                logger.info(f"Cleaned up: {path.name}")
            else:
                logger.debug(f"File already removed: {file_path}")
        except PermissionError as e:
            logger.error(f"Permission denied cleaning up {file_path}: {e}")
        except OSError as e:
            logger.error(f"OS error cleaning up {file_path}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error cleaning up {file_path}: {e}")
    
    def cleanup_all_processed(self, older_than_hours: int = 24) -> int:
        """
        Clean up old processed audio files.
        
        Args:
            older_than_hours: Remove files older than this many hours
            
        Returns:
            Number of files deleted
        """
        import time
        
        deleted = 0
        cutoff_time = time.time() - (older_than_hours * 3600)
        
        try:
            for file_path in self.output_dir.glob("*.wav"):
                try:
                    if file_path.stat().st_mtime < cutoff_time:
                        file_path.unlink()
                        deleted += 1
                        logger.debug(f"Deleted old processed file: {file_path.name}")
                except Exception as e:
                    logger.warning(f"Could not delete {file_path.name}: {e}")
            
            if deleted > 0:
                logger.info(f"Cleaned up {deleted} old processed audio files")
            
            return deleted
        except Exception as e:
            logger.error(f"Error during batch cleanup: {e}")
            return deleted