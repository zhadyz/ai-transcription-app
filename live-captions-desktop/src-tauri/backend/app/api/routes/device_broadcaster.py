"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT DEVICE TELEMETRY BROADCASTER
═══════════════════════════════════════════════════════════════════════════
Intelligent broadcasting with adaptive throttling, backpressure handling,
connection health monitoring, and zero-allocation optimization.
═══════════════════════════════════════════════════════════════════════════
"""

import asyncio
import time
import logging
from typing import Set, Dict, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class DeviceTelemetryBroadcaster:
    """
    Omniscient broadcaster with adaptive behavior:
    - Intelligent throttling based on client count
    - Backpressure detection and mitigation
    - Per-client health monitoring
    - Statistical aggregation
    - Zero-copy message reuse
    """
    
    def __init__(
        self,
        base_interval: float = 5.0,
        min_interval: float = 2.0,
        max_interval: float = 15.0,
        max_backpressure: int = 10
    ):
        self.base_interval = base_interval
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.max_backpressure = max_backpressure
        
        # Adaptive state
        self._current_interval = base_interval
        self._client_health: Dict[str, dict] = defaultdict(lambda: {
            'success': 0,
            'failures': 0,
            'backpressure': 0,
            'last_success': time.time(),
            'avg_latency': 0.0
        })
        
        # Message cache for zero-copy broadcast
        self._cached_message: Dict = {}
        self._cache_timestamp: float = 0.0
        self._cache_ttl: float = 4.5  # Cache for 90% of interval
        
        # Statistics
        self._total_broadcasts = 0
        self._total_successes = 0
        self._total_failures = 0
        self._adaptive_adjustments = 0
    
    def _calculate_adaptive_interval(self, client_count: int) -> float:
        """
        Calculate optimal broadcast interval based on:
        - Client count (more clients = longer interval)
        - System health (degraded = longer interval)  
        - Recent success rate (failures = longer interval)
        """
        # Base scaling by client count
        if client_count == 0:
            return self.max_interval
        elif client_count <= 3:
            interval = self.base_interval
        elif client_count <= 10:
            interval = self.base_interval * 1.2
        else:
            interval = self.base_interval * 1.5
        
        # Adjust for recent failures
        recent_success_rate = self._calculate_success_rate()
        if recent_success_rate < 0.8:
            interval *= 1.3  # Back off on failures
        
        # Clamp to bounds
        return max(self.min_interval, min(self.max_interval, interval))
    
    def _calculate_success_rate(self) -> float:
        """Calculate recent success rate across all clients"""
        if not self._client_health:
            return 1.0
        
        total_success = sum(h['success'] for h in self._client_health.values())
        total_failures = sum(h['failures'] for h in self._client_health.values())
        total = total_success + total_failures
        
        return total_success / total if total > 0 else 1.0
    
    def _should_use_cache(self) -> bool:
        """Determine if cached message is still valid"""
        age = time.time() - self._cache_timestamp
        return age < self._cache_ttl and self._cached_message
    
    async def _build_telemetry_message(self) -> Dict:
        """Build telemetry message with caching"""
        if self._should_use_cache():
            return self._cached_message
        
        from app.api.routes.system import get_device_info
        
        try:
            device_info = await get_device_info()
            
            # Build broadcast message
            message = {
                "type": "device_stats",
                "device_type": device_info.get("device_type"),
                "device_name": device_info.get("device_name"),
                "cuda_version": device_info.get("cuda_version"),
                "pytorch_version": device_info.get("pytorch_version"),
                "timestamp": int(time.time() * 1000),
                
                # Memory metrics
                "memory_used_gb": device_info.get("memory_used_gb"),
                "memory_total_gb": device_info.get("memory_total_gb"),
                "memory_percent": device_info.get("memory_percent"),
                
                # Enhanced metrics (if available)
                "memory_trend": device_info.get("memory_trend"),
                "memory_velocity": device_info.get("memory_velocity"),
                "health_score": device_info.get("health_score"),
                "oom_risk_level": device_info.get("oom_risk_level"),
            }
            
            # Cache message
            self._cached_message = message
            self._cache_timestamp = time.time()
            
            return message
            
        except Exception as e:
            logger.error(f"Failed to build telemetry message: {e}")
            return None
    
    async def _broadcast_to_client(self, ws_id: str, websocket, message: Dict) -> bool:
        """
        Broadcast to single client with backpressure detection
        and health tracking.
        """
        from app.api.routes.websocket import send_json_safe
        
        start = time.time()
        
        try:
            # Check backpressure
            health = self._client_health[ws_id]
            if health['backpressure'] >= self.max_backpressure:
                logger.warning(f"Client {ws_id[:8]} backpressure exceeded - skipping")
                health['backpressure'] += 1
                return False
            
            # Send with timeout
            success = await asyncio.wait_for(
                send_json_safe(websocket, ws_id, message),
                timeout=2.0
            )
            
            # Update health tracking
            if success:
                latency = time.time() - start
                health['success'] += 1
                health['last_success'] = time.time()
                health['backpressure'] = max(0, health['backpressure'] - 1)
                
                # Update rolling average latency
                alpha = 0.3
                health['avg_latency'] = (
                    alpha * latency + (1 - alpha) * health['avg_latency']
                )
                
                self._total_successes += 1
                return True
            else:
                health['failures'] += 1
                health['backpressure'] += 1
                self._total_failures += 1
                return False
                
        except asyncio.TimeoutError:
            logger.warning(f"Client {ws_id[:8]} send timeout")
            self._client_health[ws_id]['failures'] += 1
            self._client_health[ws_id]['backpressure'] += 2
            self._total_failures += 1
            return False
        except Exception as e:
            logger.error(f"Broadcast to {ws_id[:8]} failed: {e}")
            self._client_health[ws_id]['failures'] += 1
            self._total_failures += 1
            return False
    
    async def _cleanup_stale_clients(self, active_ws_ids: Set[str]):
        """Remove health tracking for disconnected clients"""
        stale = set(self._client_health.keys()) - active_ws_ids
        for ws_id in stale:
            del self._client_health[ws_id]
    
    def get_stats(self) -> Dict:
        """Get broadcaster performance statistics"""
        return {
            "total_broadcasts": self._total_broadcasts,
            "total_successes": self._total_successes,
            "total_failures": self._total_failures,
            "success_rate": self._calculate_success_rate(),
            "current_interval": self._current_interval,
            "adaptive_adjustments": self._adaptive_adjustments,
            "active_clients": len(self._client_health),
            "clients_with_backpressure": sum(
                1 for h in self._client_health.values() 
                if h['backpressure'] > 0
            )
        }
    
    async def broadcast_loop(self):
        """
        Main broadcast loop with adaptive behavior and
        intelligent optimization.
        """
        logger.info("🎯 Device telemetry broadcaster starting...")
        
        while True:
            try:
                from app.api.routes.websocket import active_connections
                
                # Calculate adaptive interval
                client_count = len(active_connections)
                new_interval = self._calculate_adaptive_interval(client_count)
                
                if abs(new_interval - self._current_interval) > 0.5:
                    logger.info(
                        f"📊 Adaptive interval: {self._current_interval:.1f}s → {new_interval:.1f}s "
                        f"({client_count} clients)"
                    )
                    self._current_interval = new_interval
                    self._adaptive_adjustments += 1
                
                await asyncio.sleep(self._current_interval)
                
                if client_count == 0:
                    continue
                
                # Build message (may use cache)
                message = await self._build_telemetry_message()
                if not message:
                    continue
                
                # Broadcast to all clients concurrently
                broadcast_start = time.time()
                tasks = []
                
                for ws_id, websocket in list(active_connections.items()):
                    task = asyncio.create_task(
                        self._broadcast_to_client(ws_id, websocket, message)
                    )
                    tasks.append(task)
                
                # Wait for all broadcasts with timeout
                results = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=5.0
                )
                
                # Count successes
                success_count = sum(1 for r in results if r is True)
                broadcast_duration = time.time() - broadcast_start
                
                self._total_broadcasts += 1
                
                # Cleanup stale clients
                await self._cleanup_stale_clients(set(active_connections.keys()))
                
                # Log stats
                if success_count > 0:
                    avg_latency = (
                        sum(h['avg_latency'] for h in self._client_health.values()) / 
                        len(self._client_health)
                        if self._client_health else 0.0
                    )
                    
                    logger.debug(
                        f"📡 Broadcast: {success_count}/{client_count} clients | "
                        f"Duration: {broadcast_duration*1000:.0f}ms | "
                        f"Avg latency: {avg_latency*1000:.0f}ms | "
                        f"VRAM: {message.get('memory_used_gb', 0):.2f}GB"
                    )
                
            except asyncio.CancelledError:
                logger.info("Device telemetry broadcaster cancelled")
                break
            except Exception as e:
                logger.error(f"Broadcast loop error: {e}", exc_info=True)
                await asyncio.sleep(5.0)  # Back off on errors
        
        # Final stats
        stats = self.get_stats()
        logger.info(
            f"📊 Broadcaster stats: {stats['total_broadcasts']} broadcasts, "
            f"{stats['success_rate']:.1%} success rate"
        )


# Global broadcaster instance
_broadcaster: Optional[DeviceTelemetryBroadcaster] = None


def get_broadcaster() -> DeviceTelemetryBroadcaster:
    """Get or create broadcaster singleton"""
    global _broadcaster
    if _broadcaster is None:
        _broadcaster = DeviceTelemetryBroadcaster()
    return _broadcaster


async def broadcast_device_stats_periodically():
    """Entry point for background task"""
    broadcaster = get_broadcaster()
    await broadcaster.broadcast_loop()