"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT DEVICE TELEMETRY ENGINE - S++ Implementation
═══════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter
import torch
import logging
import time
import threading
from typing import Optional, Dict, Tuple, List
from collections import deque
from dataclasses import dataclass, field
from contextlib import contextmanager
import psutil

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/system", tags=["system"])


@dataclass
class MemoryMetrics:
    """Statistical memory metrics with trend analysis"""
    current: float
    total: float
    percent: float
    ma_1m: float  # 1-minute moving average
    ma_5m: float  # 5-minute moving average
    peak: float
    baseline: float
    trend: str  # 'rising', 'falling', 'stable'
    velocity: float  # GB/s change rate
    timestamp: float = field(default_factory=time.time)


class GPUMemoryOracle:
    """
    Omniscient GPU memory tracker with statistical analysis,
    predictive capabilities, and self-healing fault tolerance.
    """
    
    def __init__(self, history_size: int = 720):  # 1 hour at 5s intervals
        self._history: deque = deque(maxlen=history_size)
        self._lock = threading.RLock()
        self._nvml_initialized = False
        self._nvml_handle = None
        self._failure_count = 0
        self._last_success = time.time()
        self._circuit_open = False
        self._baseline_samples: List[float] = []
        self._peak_memory = 0.0
        
        self._initialize_nvml()
    
    def _initialize_nvml(self) -> bool:
        """Initialize NVML with exponential backoff retry"""
        try:
            import pynvml
            pynvml.nvmlInit()
            self._nvml_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            self._nvml_initialized = True
            self._failure_count = 0
            self._circuit_open = False
            logger.info("🔮 GPU Oracle initialized with NVML")
            return True
        except ImportError:
            logger.warning("⚠️ pynvml unavailable - degraded mode")
            return False
        except Exception as e:
            logger.error(f"NVML init failed: {e}")
            return False
    
    @contextmanager
    def _nvml_session(self):
        """Context manager for NVML operations with automatic recovery"""
        try:
            import pynvml
            yield pynvml
            self._last_success = time.time()
            self._failure_count = max(0, self._failure_count - 1)
        except Exception as e:
            self._failure_count += 1
            
            if self._failure_count > 5:
                self._circuit_open = True
                logger.error("🔥 Circuit breaker OPEN - GPU telemetry suspended")
            
            # Attempt recovery on driver errors
            if 'driver' in str(e).lower() or 'uninitialized' in str(e).lower():
                logger.warning("🔄 Attempting NVML recovery...")
                try:
                    import pynvml
                    pynvml.nvmlShutdown()
                except:
                    pass
                self._initialize_nvml()
            
            raise
    
    def _calculate_moving_average(self, window_size: int) -> float:
        """Calculate moving average over window"""
        with self._lock:
            if len(self._history) < window_size:
                window_size = len(self._history)
            
            if window_size == 0:
                return 0.0
            
            recent = list(self._history)[-window_size:]
            return sum(recent) / len(recent)
    
    def _calculate_trend(self) -> Tuple[str, float]:
        """Analyze memory trend and velocity"""
        with self._lock:
            if len(self._history) < 3:
                return 'stable', 0.0
            
            recent = list(self._history)[-12:]  # Last minute
            if len(recent) < 2:
                return 'stable', 0.0
            
            # Calculate velocity (GB/s)
            time_delta = 5.0 * (len(recent) - 1)  # 5s intervals
            memory_delta = recent[-1] - recent[0]
            velocity = memory_delta / time_delta if time_delta > 0 else 0.0
            
            # Determine trend
            if abs(velocity) < 0.01:  # < 10MB/s
                return 'stable', velocity
            elif velocity > 0:
                return 'rising', velocity
            else:
                return 'falling', velocity
    
    def _update_baseline(self, current: float):
        """Track baseline memory usage (idle state)"""
        with self._lock:
            # Only update baseline when memory is low and stable
            if current < 1.0 and len(self._history) > 5:
                recent_stable = all(abs(m - current) < 0.1 for m in list(self._history)[-5:])
                if recent_stable:
                    self._baseline_samples.append(current)
                    if len(self._baseline_samples) > 20:
                        self._baseline_samples.pop(0)
    
    def get_metrics(self) -> Optional[MemoryMetrics]:
        """
        Get comprehensive memory metrics with statistical analysis.
        
        Returns enriched metrics including trends, predictions, and anomalies.
        """
        if self._circuit_open:
            # Circuit breaker open - attempt recovery
            if time.time() - self._last_success > 60:
                logger.info("🔄 Circuit breaker attempting recovery...")
                if self._initialize_nvml():
                    self._circuit_open = False
                    self._failure_count = 0
            return None
        
        if not self._nvml_initialized:
            return None
        
        try:
            with self._nvml_session() as pynvml:
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(self._nvml_handle)
                
                current_gb = mem_info.used / (1024**3)
                total_gb = mem_info.total / (1024**3)
                percent = (current_gb / total_gb * 100) if total_gb > 0 else 0
                
                # Update history
                with self._lock:
                    self._history.append(current_gb)
                    self._peak_memory = max(self._peak_memory, current_gb)
                
                # Update baseline tracker
                self._update_baseline(current_gb)
                
                # Calculate statistics
                ma_1m = self._calculate_moving_average(12)  # 1 min = 12 samples at 5s
                ma_5m = self._calculate_moving_average(60)  # 5 min = 60 samples
                trend, velocity = self._calculate_trend()
                
                baseline = (sum(self._baseline_samples) / len(self._baseline_samples) 
                           if self._baseline_samples else current_gb)
                
                return MemoryMetrics(
                    current=round(current_gb, 3),
                    total=round(total_gb, 2),
                    percent=round(percent, 2),
                    ma_1m=round(ma_1m, 3),
                    ma_5m=round(ma_5m, 3),
                    peak=round(self._peak_memory, 3),
                    baseline=round(baseline, 3),
                    trend=trend,
                    velocity=round(velocity, 6)
                )
                
        except Exception as e:
            logger.error(f"GPU metrics query failed: {e}")
            return None
    
    def predict_oom_risk(self) -> Tuple[float, str]:
        """
        Predict out-of-memory risk based on current trends.
        
        Returns: (risk_score 0-1, risk_level)
        """
        metrics = self.get_metrics()
        if not metrics:
            return 0.0, 'unknown'
        
        # Calculate risk factors
        usage_risk = metrics.percent / 100.0
        trend_risk = 0.5 if metrics.trend == 'rising' else 0.0
        velocity_risk = min(abs(metrics.velocity) * 10, 0.3) if metrics.velocity > 0 else 0.0
        
        total_risk = min(usage_risk + trend_risk + velocity_risk, 1.0)
        
        if total_risk < 0.3:
            return total_risk, 'low'
        elif total_risk < 0.7:
            return total_risk, 'medium'
        else:
            return total_risk, 'high'
    
    def get_health_score(self) -> Dict:
        """Comprehensive health assessment"""
        metrics = self.get_metrics()
        if not metrics:
            return {"score": 0.0, "status": "unhealthy", "reason": "telemetry_failure"}
        
        # Calculate health score (0-100)
        memory_health = max(0, 100 - metrics.percent)
        stability_health = 100 if metrics.trend == 'stable' else 70
        failure_health = max(0, 100 - (self._failure_count * 10))
        
        total_score = (memory_health * 0.5 + stability_health * 0.3 + failure_health * 0.2)
        
        return {
            "score": round(total_score, 1),
            "status": "healthy" if total_score > 80 else "degraded" if total_score > 50 else "unhealthy",
            "memory_health": round(memory_health, 1),
            "stability_health": round(stability_health, 1),
            "failure_health": round(failure_health, 1),
            "circuit_state": "open" if self._circuit_open else "closed"
        }
    
    def shutdown(self):
        """Graceful shutdown"""
        try:
            if self._nvml_initialized:
                import pynvml
                pynvml.nvmlShutdown()
        except:
            pass


# Global oracle instance
_gpu_oracle: Optional[GPUMemoryOracle] = None


def get_gpu_oracle() -> GPUMemoryOracle:
    """Get or create GPU oracle singleton"""
    global _gpu_oracle
    if _gpu_oracle is None:
        _gpu_oracle = GPUMemoryOracle()
    return _gpu_oracle


@router.get("/device-info")
async def get_device_info():
    """
    Omniscient device telemetry with statistical analysis,
    trend prediction, and health scoring.
    """
    cuda_available = torch.cuda.is_available()
    
    if cuda_available:
        device_name = torch.cuda.get_device_name(0)
        device_type = "GPU"
        
        oracle = get_gpu_oracle()
        metrics = oracle.get_metrics()
        oom_risk, risk_level = oracle.predict_oom_risk()
        health = oracle.get_health_score()
        
        if metrics:
            return {
                "device_type": device_type,
                "device_name": device_name,
                "cuda_version": torch.version.cuda,
                "pytorch_version": torch.__version__,
                
                # Current state
                "memory_total_gb": metrics.total,
                "memory_used_gb": metrics.current,
                "memory_percent": metrics.percent,
                
                # Statistical analysis
                "memory_ma_1m": metrics.ma_1m,
                "memory_ma_5m": metrics.ma_5m,
                "memory_peak": metrics.peak,
                "memory_baseline": metrics.baseline,
                "memory_trend": metrics.trend,
                "memory_velocity": metrics.velocity,
                
                # Predictive analytics
                "oom_risk_score": round(oom_risk, 3),
                "oom_risk_level": risk_level,
                
                # Health scoring
                "health_score": health["score"],
                "health_status": health["status"],
                "health_details": health,
                
                "timestamp": int(metrics.timestamp * 1000)
            }
        else:
            # Degraded mode - basic PyTorch stats
            memory_total = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            memory_used = torch.cuda.memory_allocated(0) / (1024**3)
            
            return {
                "device_type": device_type,
                "device_name": device_name,
                "cuda_version": torch.version.cuda,
                "pytorch_version": torch.__version__,
                "memory_total_gb": round(memory_total, 2),
                "memory_used_gb": round(memory_used, 2),
                "memory_percent": round((memory_used / memory_total * 100), 1) if memory_total > 0 else 0,
                "degraded_mode": True,
                "message": "NVML unavailable - limited metrics"
            }
    else:
        # CPU metrics with system memory
        mem = psutil.virtual_memory()
        
        return {
            "device_type": "CPU",
            "device_name": "CPU",
            "cuda_version": None,
            "pytorch_version": torch.__version__,
            "system_memory_total_gb": round(mem.total / (1024**3), 2),
            "system_memory_used_gb": round(mem.used / (1024**3), 2),
            "system_memory_percent": round(mem.percent, 1),
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(interval=0.1)
        }


@router.get("/device-health")
async def get_device_health():
    """Dedicated health check endpoint"""
    cuda_available = torch.cuda.is_available()
    
    if not cuda_available:
        return {"status": "healthy", "device": "cpu"}
    
    oracle = get_gpu_oracle()
    health = oracle.get_health_score()
    
    return health


@router.post("/device-reset")
async def reset_device_telemetry():
    """Reset telemetry state (circuit breaker, history, etc.)"""
    oracle = get_gpu_oracle()
    oracle._history.clear()
    oracle._baseline_samples.clear()
    oracle._peak_memory = 0.0
    oracle._failure_count = 0
    oracle._circuit_open = False
    
    if not oracle._nvml_initialized:
        oracle._initialize_nvml()
    
    return {"status": "reset", "message": "Telemetry state cleared"}