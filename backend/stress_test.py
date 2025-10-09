"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT DEVICE TELEMETRY - STRESS TEST SUITE
═══════════════════════════════════════════════════════════════════════════
Comprehensive testing: load, failure injection, resilience, performance
"""

import asyncio
import time
import websockets
import json
import random
from typing import List, Dict
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class ClientMetrics:
    """Per-client performance metrics"""
    messages_received: int = 0
    messages_failed: int = 0
    total_latency: float = 0.0
    max_latency: float = 0.0
    connection_drops: int = 0
    reconnects: int = 0
    
    @property
    def avg_latency(self) -> float:
        return self.total_latency / self.messages_received if self.messages_received > 0 else 0.0
    
    @property
    def success_rate(self) -> float:
        total = self.messages_received + self.messages_failed
        return self.messages_received / total if total > 0 else 0.0


class StressTestClient:
    """
    Single WebSocket client that measures performance
    and simulates real-world behavior (disconnects, slow networks, etc.)
    """
    
    def __init__(self, client_id: int, ws_url: str, chaos_mode: bool = False):
        self.client_id = client_id
        self.ws_url = ws_url
        self.chaos_mode = chaos_mode
        self.metrics = ClientMetrics()
        self.running = False
        self.websocket = None
    
    async def run(self, duration_seconds: int):
        """Run client for specified duration"""
        self.running = True
        start_time = time.time()
        
        while self.running and (time.time() - start_time) < duration_seconds:
            try:
                async with websockets.connect(self.ws_url) as websocket:
                    self.websocket = websocket
                    print(f"Client {self.client_id}: Connected")
                    
                    # Send initial subscribe
                    await websocket.send(json.dumps({"type": "subscribe"}))
                    
                    # Receive loop
                    while self.running and (time.time() - start_time) < duration_seconds:
                        try:
                            # Chaos mode: random delays
                            if self.chaos_mode and random.random() < 0.1:
                                await asyncio.sleep(random.uniform(0.5, 2.0))
                            
                            message_start = time.time()
                            message = await asyncio.wait_for(
                                websocket.recv(),
                                timeout=15.0
                            )
                            
                            latency = time.time() - message_start
                            
                            data = json.loads(message)
                            
                            if data.get('type') == 'device_stats':
                                self.metrics.messages_received += 1
                                self.metrics.total_latency += latency
                                self.metrics.max_latency = max(self.metrics.max_latency, latency)
                            
                            # Chaos mode: random disconnects
                            if self.chaos_mode and random.random() < 0.05:
                                print(f"Client {self.client_id}: Chaos disconnect")
                                self.metrics.connection_drops += 1
                                break
                                
                        except asyncio.TimeoutError:
                            print(f"Client {self.client_id}: Timeout")
                            self.metrics.messages_failed += 1
                            break
                        except json.JSONDecodeError:
                            # Binary message or invalid JSON - ignore
                            pass
                        except Exception as e:
                            print(f"Client {self.client_id}: Receive error: {e}")
                            self.metrics.messages_failed += 1
                            break
                    
            except Exception as e:
                print(f"Client {self.client_id}: Connection error: {e}")
                self.metrics.connection_drops += 1
                
                # Exponential backoff reconnect
                backoff = min(2 ** self.metrics.reconnects, 10)
                await asyncio.sleep(backoff)
                self.metrics.reconnects += 1
        
        self.running = False
        print(f"Client {self.client_id}: Stopped")


class StressTestCoordinator:
    """
    Orchestrates stress test with multiple clients,
    measures aggregate performance, and reports results.
    """
    
    def __init__(self, backend_url: str = "ws://localhost:8000"):
        self.backend_url = backend_url
        self.clients: List[StressTestClient] = []
    
    async def spawn_clients(self, count: int, chaos_mode: bool = False):
        """Spawn N concurrent clients"""
        session_id = "stress-test-session"
        ws_url = f"{self.backend_url}/ws/{session_id}"
        
        self.clients = [
            StressTestClient(i, ws_url, chaos_mode=chaos_mode)
            for i in range(count)
        ]
    
    async def run_test(
        self,
        client_count: int,
        duration_seconds: int,
        chaos_mode: bool = False,
        ramp_up_seconds: int = 0
    ):
        """
        Run comprehensive stress test.
        
        Args:
            client_count: Number of concurrent clients
            duration_seconds: Test duration
            chaos_mode: Enable random failures/delays
            ramp_up_seconds: Gradual client spawn (0 = spawn all at once)
        """
        print("=" * 70)
        print(f"STRESS TEST: {client_count} clients, {duration_seconds}s duration")
        print(f"Chaos mode: {chaos_mode}, Ramp-up: {ramp_up_seconds}s")
        print("=" * 70)
        
        await self.spawn_clients(client_count, chaos_mode)
        
        # Spawn clients
        tasks = []
        if ramp_up_seconds > 0:
            delay = ramp_up_seconds / client_count
            for client in self.clients:
                task = asyncio.create_task(client.run(duration_seconds))
                tasks.append(task)
                await asyncio.sleep(delay)
        else:
            # Spawn all at once
            tasks = [
                asyncio.create_task(client.run(duration_seconds))
                for client in self.clients
            ]
        
        # Wait for completion
        start_time = time.time()
        await asyncio.gather(*tasks)
        actual_duration = time.time() - start_time
        
        # Aggregate metrics
        self._report_results(actual_duration)
    
    def _report_results(self, duration: float):
        """Generate comprehensive test report"""
        total_messages = sum(c.metrics.messages_received for c in self.clients)
        total_failures = sum(c.metrics.messages_failed for c in self.clients)
        total_drops = sum(c.metrics.connection_drops for c in self.clients)
        total_reconnects = sum(c.metrics.reconnects for c in self.clients)
        
        avg_latency = sum(c.metrics.avg_latency for c in self.clients) / len(self.clients)
        max_latency = max(c.metrics.max_latency for c in self.clients)
        
        success_rate = total_messages / (total_messages + total_failures) if (total_messages + total_failures) > 0 else 0
        
        messages_per_second = total_messages / duration
        
        print("\n" + "=" * 70)
        print("STRESS TEST RESULTS")
        print("=" * 70)
        print(f"Duration: {duration:.1f}s")
        print(f"Clients: {len(self.clients)}")
        print(f"\nMessages:")
        print(f"  Received: {total_messages}")
        print(f"  Failed: {total_failures}")
        print(f"  Success Rate: {success_rate:.2%}")
        print(f"  Throughput: {messages_per_second:.1f} msg/s")
        print(f"\nLatency:")
        print(f"  Average: {avg_latency * 1000:.1f}ms")
        print(f"  Max: {max_latency * 1000:.1f}ms")
        print(f"\nResilience:")
        print(f"  Connection Drops: {total_drops}")
        print(f"  Reconnects: {total_reconnects}")
        print(f"  Recovery Rate: {(total_reconnects / total_drops * 100):.1f}%" if total_drops > 0 else "  Recovery Rate: N/A")
        
        # Per-client breakdown
        print(f"\nPer-Client Stats:")
        for client in self.clients[:5]:  # Show first 5
            print(f"  Client {client.client_id}: "
                  f"{client.metrics.messages_received} msg, "
                  f"{client.metrics.avg_latency * 1000:.1f}ms avg, "
                  f"{client.metrics.connection_drops} drops")
        
        if len(self.clients) > 5:
            print(f"  ... and {len(self.clients) - 5} more clients")
        
        print("=" * 70)
        
        # Grade
        grade = self._calculate_grade(success_rate, avg_latency, total_drops, total_reconnects)
        print(f"\nOVERALL GRADE: {grade}")
        print("=" * 70)
    
    def _calculate_grade(self, success_rate: float, avg_latency: float, drops: int, reconnects: int) -> str:
        """Calculate overall performance grade"""
        score = 0
        
        # Success rate (40 points)
        if success_rate > 0.99:
            score += 40
        elif success_rate > 0.95:
            score += 30
        elif success_rate > 0.90:
            score += 20
        else:
            score += 10
        
        # Latency (30 points)
        if avg_latency < 0.01:  # < 10ms
            score += 30
        elif avg_latency < 0.05:  # < 50ms
            score += 20
        elif avg_latency < 0.1:  # < 100ms
            score += 10
        
        # Resilience (30 points)
        if drops == 0:
            score += 30
        elif reconnects >= drops:  # All reconnected
            score += 20
        elif reconnects >= drops * 0.5:  # 50%+ reconnected
            score += 10
        
        if score >= 90:
            return "S++"
        elif score >= 80:
            return "S"
        elif score >= 70:
            return "A"
        elif score >= 60:
            return "B"
        else:
            return "C"


async def main():
    """Run stress test suite"""
    coordinator = StressTestCoordinator("ws://localhost:8000")
    
    print("\n🔥 STRESS TEST SUITE - Transcendent Device Telemetry 🔥\n")
    
    # Test 1: Normal load
    print("\n📊 TEST 1: Normal Load (10 clients, 60s)")
    await coordinator.run_test(
        client_count=10,
        duration_seconds=60,
        chaos_mode=False
    )
    
    await asyncio.sleep(5)
    
    # Test 2: High load
    print("\n📊 TEST 2: High Load (50 clients, 60s, ramp-up)")
    await coordinator.run_test(
        client_count=50,
        duration_seconds=60,
        chaos_mode=False,
        ramp_up_seconds=10
    )
    
    await asyncio.sleep(5)
    
    # Test 3: Chaos mode
    print("\n📊 TEST 3: Chaos Engineering (20 clients, 120s, random failures)")
    await coordinator.run_test(
        client_count=20,
        duration_seconds=120,
        chaos_mode=True
    )
    
    print("\n✅ ALL TESTS COMPLETE")


if __name__ == "__main__":
    asyncio.run(main())