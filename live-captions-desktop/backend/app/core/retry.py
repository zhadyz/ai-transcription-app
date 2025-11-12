"""
Retry logic with exponential backoff and circuit breaker pattern.
Prevents cascading failures and enables graceful degradation.
"""

import asyncio
import time
from typing import Callable, TypeVar, Any, Optional, Type, Tuple
from functools import wraps
from enum import Enum
import logging

from app.core.exceptions import TranscriptionBaseException

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered


class CircuitBreaker:
    """
    Circuit breaker pattern implementation.
    Prevents repeated calls to failing services.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = CircuitState.CLOSED
    
    def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """Execute function with circuit breaker protection"""
        
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                logger.info("Circuit breaker entering HALF_OPEN state")
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit breaker is OPEN - service unavailable")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise
    
    def _on_success(self):
        """Reset circuit breaker on successful call"""
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            logger.info("Circuit breaker recovered, entering CLOSED state")
            self.state = CircuitState.CLOSED
    
    def _on_failure(self):
        """Record failure and potentially open circuit"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            logger.error(
                f"Circuit breaker OPEN after {self.failure_count} failures"
            )
            self.state = CircuitState.OPEN


def retry_with_backoff(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[Exception, int], None]] = None
):
    """
    Decorator for automatic retry with exponential backoff.
    
    Args:
        max_attempts: Maximum number of retry attempts
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries
        exponential_base: Base for exponential backoff calculation
        exceptions: Tuple of exceptions to catch and retry
        on_retry: Callback function called before each retry
    
    Example:
        @retry_with_backoff(max_attempts=3, exceptions=(AudioExtractionError,))
        async def extract_audio(path: str):
            # Implementation
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            last_exception = None
            
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    # Check if error is recoverable
                    if isinstance(e, TranscriptionBaseException) and not e.recoverable:
                        logger.error(f"Non-recoverable error in {func.__name__}: {e}")
                        raise
                    
                    if attempt == max_attempts:
                        logger.error(
                            f"Max retries ({max_attempts}) exceeded for {func.__name__}"
                        )
                        raise
                    
                    # Calculate delay with exponential backoff
                    delay = min(
                        initial_delay * (exponential_base ** (attempt - 1)),
                        max_delay
                    )
                    
                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )
                    
                    if on_retry:
                        on_retry(e, attempt)
                    
                    await asyncio.sleep(delay)
            
            # Should never reach here, but satisfy type checker
            raise last_exception
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            last_exception = None
            
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    if isinstance(e, TranscriptionBaseException) and not e.recoverable:
                        logger.error(f"Non-recoverable error in {func.__name__}: {e}")
                        raise
                    
                    if attempt == max_attempts:
                        logger.error(
                            f"Max retries ({max_attempts}) exceeded for {func.__name__}"
                        )
                        raise
                    
                    delay = min(
                        initial_delay * (exponential_base ** (attempt - 1)),
                        max_delay
                    )
                    
                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )
                    
                    if on_retry:
                        on_retry(e, attempt)
                    
                    time.sleep(delay)
            
            raise last_exception
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def fallback_on_error(fallback_value: Any):
    """
    Decorator that returns a fallback value on exception.
    Useful for non-critical operations.
    
    Example:
        @fallback_on_error(fallback_value=[])
        def get_optional_data():
            # May fail, return [] if it does
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                logger.warning(
                    f"{func.__name__} failed, returning fallback value: {e}"
                )
                return fallback_value
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.warning(
                    f"{func.__name__} failed, returning fallback value: {e}"
                )
                return fallback_value
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator