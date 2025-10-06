import logging
import logging.handlers
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
import contextvars

# Context variable for request tracking
request_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('request_id', default=None)


class ContextFilter(logging.Filter):
    """Add request ID to log records for distributed tracing"""
    
    def filter(self, record):
        record.request_id = request_id_var.get() or 'no-request-id'
        return True


class ColoredFormatter(logging.Formatter):
    """Colored console output for better readability during development"""
    
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        # Add color to level name
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.RESET}"
        
        result = super().format(record)
        
        # Reset levelname for other formatters
        record.levelname = levelname
        return result


def setup_logging(log_level: str = "INFO", log_dir: str = "./logs") -> None:
    """
    Configure application-wide logging.
    
    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory for log files
    """
    # Create logs directory
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Console handler - human-readable with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = ColoredFormatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    console_handler.addFilter(ContextFilter())
    
    # File handler - detailed logs with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        filename=log_path / "transcription_app.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(request_id)s | %(name)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    file_handler.addFilter(ContextFilter())
    
    # Error file handler - separate file for errors
    error_handler = logging.handlers.RotatingFileHandler(
        filename=log_path / "errors.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=3,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    error_handler.addFilter(ContextFilter())
    
    # Add handlers to root logger
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(error_handler)
    
    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    
    # Log startup message
    root_logger.info("=" * 80)
    root_logger.info(f"Logging system initialized | Level: {log_level} | Log dir: {log_path.absolute()}")
    root_logger.info("=" * 80)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a module.
    
    Args:
        name: Module name (use __name__)
        
    Returns:
        Logger instance
    """
    return logging.getLogger(name)


def set_request_id(request_id: str) -> None:
    """Set request ID for current context (for tracing)"""
    request_id_var.set(request_id)


def clear_request_id() -> None:
    """Clear request ID from current context"""
    request_id_var.set(None)