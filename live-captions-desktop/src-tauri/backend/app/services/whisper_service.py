import os
import logging
import time
from pathlib import Path
from typing import Optional, List, Dict
from faster_whisper import WhisperModel
from app.models.transcription import TranscriptionQuality, Segment
from app.core.exceptions import TranscriptionError, ModelLoadError, ResourceExhaustedError
from app.core.retry import retry_with_backoff


logger = logging.getLogger(__name__)


def detect_gpu() -> tuple[bool, str, str]:
    """
    Detect GPU availability and return configuration.
    Returns: (gpu_available, device, compute_type)
    """
    try:
        import torch
        
        if torch.cuda.is_available():
            # Test that CUDA actually works
            try:
                # Verify CUDA functionality
                test_tensor = torch.ones(1).cuda()
                del test_tensor
                torch.cuda.empty_cache()
                
                # Get GPU info
                gpu_name = torch.cuda.get_device_name(0)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                
                logger.info(
                    f"GPU detected: {gpu_name} with {gpu_memory:.1f}GB memory"
                )
                return True, "cuda", "float16"
            except Exception as e:
                logger.warning(f"CUDA detected but failed test: {e}")
                return False, "cpu", "int8"
        else:
            logger.info("No CUDA GPU detected, using CPU")
            return False, "cpu", "int8"
            
    except ImportError:
        logger.warning("PyTorch not installed, using CPU")
        return False, "cpu", "int8"
    except Exception as e:
        logger.error(f"GPU detection failed: {e}", exc_info=True)
        return False, "cpu", "int8"


class WhisperService:
    """Enterprise-grade audio transcription service using faster-whisper."""
    
    # Model size estimates (approximate memory usage in MB)
    MODEL_MEMORY_REQUIREMENTS = {
        "base": 140,
        "small": 460,
        "medium": 1440,
        "large-v2": 2880,
        "large-v3": 2880
    }
    
    def __init__(self):
        from app.config import settings
        
        
        # Detect GPU availability
        gpu_available, detected_device, detected_compute = detect_gpu()
        
        # Apply config overrides if specified
        if settings.WHISPER_DEVICE == "cpu":
            self.device = "cpu"
            self.compute_type = "int8"
            logger.info("Config override: Forcing CPU mode")
        elif settings.WHISPER_DEVICE == "cuda" and gpu_available:
            self.device = "cuda"
            self.compute_type = settings.WHISPER_COMPUTE_TYPE if settings.WHISPER_COMPUTE_TYPE != "auto" else "float16"
            logger.info(f"Using GPU with compute type: {self.compute_type}")
        else:
            # Use auto-detected values
            self.device = detected_device
            self.compute_type = detected_compute
            logger.info(f"Auto-detected: device={self.device}, compute={self.compute_type}")
        
        self.models: Dict[str, WhisperModel] = {}
        self.gpu_available = gpu_available
        self.model_load_times: Dict[str, float] = {}
        
        logger.info(
            f"WhisperService initialized | Device: {self.device} | "
            f"Compute: {self.compute_type} | GPU: {gpu_available}"
        )
    
    def _check_memory_availability(self, model_name: str) -> None:
        """
        Check if sufficient memory is available for model.
        
        Raises:
            ResourceExhaustedError: If insufficient memory
        """
        required_mb = self.MODEL_MEMORY_REQUIREMENTS.get(model_name, 500)
        
        if self.device == "cuda":
            try:
                import torch
                gpu_memory_free = torch.cuda.mem_get_info()[0] / (1024**2)
                
                if gpu_memory_free < required_mb:
                    raise ResourceExhaustedError(
                        f"Insufficient GPU memory for {model_name} model. "
                        f"Required: {required_mb}MB, Available: {gpu_memory_free:.0f}MB",
                        context={
                            "model": model_name,
                            "required_mb": required_mb,
                            "available_mb": gpu_memory_free
                        }
                    )
                
                logger.debug(
                    f"GPU memory check passed: {gpu_memory_free:.0f}MB available, "
                    f"{required_mb}MB required"
                )
            except ImportError:
                logger.warning("PyTorch not available for memory check")
            except ResourceExhaustedError:
                raise
            except Exception as e:
                logger.warning(f"Could not check GPU memory: {e}")
        else:
            # CPU memory check (simplified)
            import psutil
            available_mb = psutil.virtual_memory().available / (1024**2)
            
            if available_mb < required_mb * 1.5:  # 50% buffer for CPU
                logger.warning(
                    f"Low system memory: {available_mb:.0f}MB available, "
                    f"{required_mb * 1.5:.0f}MB recommended for {model_name}"
                )
    
    @retry_with_backoff(
        max_attempts=2,
        initial_delay=5.0,
        exceptions=(ModelLoadError,)
    )
    def _get_model(self, quality: TranscriptionQuality) -> WhisperModel:
        """
        Get or create Whisper model for specified quality.
        Includes retry logic and comprehensive error handling.
        
        Args:
            quality: Transcription quality level
            
        Returns:
            Loaded WhisperModel instance
            
        Raises:
            ModelLoadError: If model fails to load after retries
            ResourceExhaustedError: If insufficient memory
        """
        model_name = quality.value
        
        # Return cached model if available
        if model_name in self.models:
            logger.debug(f"Using cached model: {model_name}")
            return self.models[model_name]
        
        # Check memory before loading
        try:
            self._check_memory_availability(model_name)
        except ResourceExhaustedError as e:
            logger.error(f"Cannot load model due to memory constraints: {e}")
            raise
        
        # Load model
        try:
            logger.info(f"Loading Whisper model: {model_name} on {self.device}")
            start_time = time.time()
            
            self.models[model_name] = WhisperModel(
                model_name,
                device=self.device,
                compute_type=self.compute_type,
                download_root="./models",  # Cache models locally
                local_files_only=False
            )
            
            load_time = time.time() - start_time
            self.model_load_times[model_name] = load_time
            
            logger.info(
                f"Model {model_name} loaded successfully in {load_time:.2f}s"
            )
            
            return self.models[model_name]
            
        except Exception as e:
            error_msg = str(e)
            
            # Determine if this is a recoverable error
            recoverable = any(
                phrase in error_msg.lower() for phrase in
                ['timeout', 'connection', 'temporary', 'network']
            )
            
            logger.error(
                f"Failed to load model {model_name}: {error_msg}",
                exc_info=True,
                extra={"recoverable": recoverable}
            )
            
            raise ModelLoadError(
                f"Failed to load {model_name} model: {error_msg}",
                context={
                    "model_name": model_name,
                    "device": self.device,
                    "compute_type": self.compute_type,
                    "error": error_msg
                }
            )
    
    def _validate_audio_file(self, audio_path: str) -> None:
        """
        Validate audio file before transcription.
        
        Raises:
            TranscriptionError: If file is invalid
        """
        path = Path(audio_path)
        
        if not path.exists():
            raise TranscriptionError(
                f"Audio file not found: {audio_path}",
                context={"audio_path": audio_path}
            )
        
        if path.stat().st_size == 0:
            raise TranscriptionError(
                "Audio file is empty",
                context={"audio_path": audio_path}
            )
        
        # Check file extension
        valid_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg'}
        if path.suffix.lower() not in valid_extensions:
            logger.warning(
                f"Unusual audio format: {path.suffix}. Proceeding anyway."
            )
    
    @retry_with_backoff(
        max_attempts=2,
        initial_delay=3.0,
        exceptions=(TranscriptionError,)
    )
    def transcribe(
        self,
        audio_path: str,
        quality: TranscriptionQuality,
        language: Optional[str] = None
    ) -> tuple[str, str, List[Segment]]:
        """
        Transcribe audio file with enterprise-grade error handling.
        
        Args:
            audio_path: Path to audio file
            quality: Transcription quality level
            language: Language code (None for auto-detect)
            
        Returns:
            Tuple of (full_text, detected_language, segments)
            
        Raises:
            TranscriptionError: If transcription fails after retries
            ModelLoadError: If model cannot be loaded
            ResourceExhaustedError: If insufficient resources
        """
        # Validate input
        self._validate_audio_file(audio_path)
        
        # Get model
        try:
            model = self._get_model(quality)
        except (ModelLoadError, ResourceExhaustedError):
            raise
        except Exception as e:
            raise ModelLoadError(
                f"Unexpected error loading model: {str(e)}",
                context={"quality": quality.value}
            )
        
        # Handle language parameter
        lang = None if language == "auto" else language
        
        logger.info(
            f"Starting transcription: {Path(audio_path).name} | "
            f"Model: {quality.value} | Language: {lang or 'auto'}"
        )
        
        start_time = time.time()
        
        try:
            # Transcribe with optimized parameters
            segments_raw, info = model.transcribe(
                audio_path,
                language=lang,
                beam_size=5,
                best_of=5,
                patience=1.0,
                word_timestamps=False,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    threshold=0.5
                ),
                condition_on_previous_text=True,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.6
            )
            
            # Convert segments to our model
            segments = []
            full_text_parts = []
            
            for seg in segments_raw:
                text = seg.text.strip()
                if text:  # Skip empty segments
                    segment = Segment(
                        start=seg.start,
                        end=seg.end,
                        text=text
                    )
                    segments.append(segment)
                    full_text_parts.append(text)
            
            # Validate output
            if not segments:
                logger.warning("Transcription produced no segments")
                raise TranscriptionError(
                    "No speech detected in audio file",
                    context={
                        "audio_path": audio_path,
                        "quality": quality.value,
                        "language": lang
                    }
                )
            
            full_text = " ".join(full_text_parts)
            detected_language = info.language
            transcription_time = time.time() - start_time
            
            logger.info(
                f"Transcription complete: {len(segments)} segments | "
                f"Language: {detected_language} | "
                f"Time: {transcription_time:.2f}s | "
                f"Speed: {info.duration / transcription_time:.2f}x realtime"
            )
            
            return full_text, detected_language, segments
            
        except Exception as e:
            transcription_time = time.time() - start_time
            
            logger.error(
                f"Transcription failed after {transcription_time:.2f}s: {str(e)}",
                exc_info=True
            )
            
            raise TranscriptionError(
                f"Transcription failed: {str(e)}",
                context={
                    "audio_path": audio_path,
                    "quality": quality.value,
                    "language": lang,
                    "duration": transcription_time,
                    "error": str(e)
                }
            )
    
    def unload_model(self, quality: TranscriptionQuality) -> None:
        """
        Unload a specific model to free memory.
        
        Args:
            quality: Quality level of model to unload
        """
        model_name = quality.value
        
        if model_name in self.models:
            del self.models[model_name]
            
            if self.device == "cuda":
                try:
                    import torch
                    torch.cuda.empty_cache()
                    logger.info(f"Unloaded model {model_name} and freed GPU memory")
                except Exception as e:
                    logger.warning(f"Could not clear CUDA cache: {e}")
            else:
                logger.info(f"Unloaded model {model_name}")
    
    def get_model_info(self) -> Dict[str, any]:
        """
        Get information about loaded models and service status.
        
        Returns:
            Dictionary with service information
        """
        return {
            "device": self.device,
            "compute_type": self.compute_type,
            "gpu_available": self.gpu_available,
            "loaded_models": list(self.models.keys()),
            "model_load_times": self.model_load_times.copy()
        }
whisper_service = WhisperService()