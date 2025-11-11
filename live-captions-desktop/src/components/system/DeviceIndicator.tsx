/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEVICE INDICATOR 
 * ═══════════════════════════════════════════════════════════════════════════
 * Omniscient monitoring with statistical intelligence, self-healing resilience,
 * predictive analytics, and zero-crash guarantees.
 */

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useWebSocket } from '@/core/WebSocketContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface DeviceInfo {
  device_type: 'GPU' | 'CPU'
  device_name: string
  cuda_version?: string | null
  pytorch_version: string
  memory_total_gb?: number | null
  memory_used_gb?: number | null
  memory_percent?: number | null
  memory_trend?: 'rising' | 'falling' | 'stable' | null
  memory_velocity?: number | null
  health_score?: number | null
  oom_risk_level?: 'low' | 'medium' | 'high' | null
  timestamp?: number
  degraded_mode?: boolean
}

interface MemoryDataPoint {
  timestamp: number
  value: number
}

interface ConnectionHealth {
  isHealthy: boolean
  lastUpdate: number
  failureCount: number
  successCount: number
  avgLatency: number
  reconnectAttempts: number
}

interface StatisticalMetrics {
  mean: number
  stdDev: number
  min: number
  max: number
  p50: number
  p95: number
  trend: 'rising' | 'falling' | 'stable'
  velocity: number
  anomalyScore: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_HISTORY = 120 // 10 minutes at 5s intervals
const STALE_THRESHOLD_MS = 30000 // 30s
const RECONNECT_BASE_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const ANOMALY_THRESHOLD = 2.0 // z-score
const TREND_WINDOW = 12 // 1 minute

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICAL ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class StatisticalEngine {
  private history: MemoryDataPoint[] = []
  
  addDataPoint(value: number, timestamp: number): void {
    this.history.push({ timestamp, value })
    if (this.history.length > MAX_HISTORY) {
      this.history.shift()
    }
  }
  
  getMetrics(): StatisticalMetrics | null {
    if (this.history.length < 2) return null
    
    const values = this.history.map(d => d.value)
    const n = values.length
    
    // Basic statistics
    const mean = values.reduce((sum, v) => sum + v, 0) / n
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n
    const stdDev = Math.sqrt(variance)
    
    const sorted = [...values].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[n - 1]
    const p50 = sorted[Math.floor(n * 0.5)]
    const p95 = sorted[Math.floor(n * 0.95)]
    
    // Trend analysis
    const recent = this.history.slice(-TREND_WINDOW)
    const trend = this.calculateTrend(recent)
    const velocity = this.calculateVelocity(recent)
    
    // Anomaly detection
    const current = values[n - 1]
    const anomalyScore = stdDev > 0 ? Math.abs((current - mean) / stdDev) : 0
    
    return {
      mean,
      stdDev,
      min,
      max,
      p50,
      p95,
      trend,
      velocity,
      anomalyScore
    }
  }
  
  private calculateTrend(data: MemoryDataPoint[]): 'rising' | 'falling' | 'stable' {
    if (data.length < 3) return 'stable'
    
    const values = data.map(d => d.value)
    const n = values.length
    
    // Simple linear regression
    const xMean = (n - 1) / 2
    const yMean = values.reduce((sum, v) => sum + v, 0) / n
    
    let numerator = 0
    let denominator = 0
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean)
      denominator += Math.pow(i - xMean, 2)
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0
    
    if (Math.abs(slope) < 0.01) return 'stable'
    return slope > 0 ? 'rising' : 'falling'
  }
  
  private calculateVelocity(data: MemoryDataPoint[]): number {
    if (data.length < 2) return 0
    
    const first = data[0]
    const last = data[data.length - 1]
    const timeDelta = (last.timestamp - first.timestamp) / 1000 // seconds
    const valueDelta = last.value - first.value
    
    return timeDelta > 0 ? valueDelta / timeDelta : 0
  }
  
  getMovingAverage(windowSize: number): number {
    if (this.history.length === 0) return 0
    
    const window = Math.min(windowSize, this.history.length)
    const recent = this.history.slice(-window)
    return recent.reduce((sum, d) => sum + d.value, 0) / window
  }
  
  clear(): void {
    this.history = []
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER FOR SELF-HEALING
// ═══════════════════════════════════════════════════════════════════════════

class CircuitBreaker {
  private failureCount = 0
  private successCount = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private lastFailureTime = 0
  private readonly threshold = 5
  private readonly timeout = 30000 // 30s
  
  recordSuccess(): void {
    this.successCount++
    this.failureCount = Math.max(0, this.failureCount - 1)
    
    if (this.state === 'half-open') {
      this.state = 'closed'
    }
  }
  
  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open'
    }
  }
  
  canAttempt(): boolean {
    if (this.state === 'closed') return true
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open'
        return true
      }
      return false
    }
    return true // half-open
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount
    }
  }
  
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.successCount = 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const DeviceIndicator = memo(() => {
  // State
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    isHealthy: true,
    lastUpdate: Date.now(),
    failureCount: 0,
    successCount: 0,
    avgLatency: 0,
    reconnectAttempts: 0
  })
  
  // Refs for stateful logic
  const statisticsEngineRef = useRef(new StatisticalEngine())
  const circuitBreakerRef = useRef(new CircuitBreaker())
  const staleCheckTimerRef = useRef<NodeJS.Timeout>()
  const reconnectTimerRef = useRef<NodeJS.Timeout>()
  const lastUpdateTimeRef = useRef(Date.now())
  
  const { socket, isConnected } = useWebSocket()
  const prefersReducedMotion = useReducedMotion()
  
  // ═════════════════════════════════════════════════════════════════════════
  // WEBSOCKET MESSAGE HANDLER
  // ═════════════════════════════════════════════════════════════════════════
  
  const processDeviceStats = useCallback((data: any) => {
    if (data.type !== 'device_stats') return
    
    const now = Date.now()
    const realLatency = data.timestamp ? now - data.timestamp : 0
    lastUpdateTimeRef.current = now
    
    // Update circuit breaker
    circuitBreakerRef.current.recordSuccess()
    
    // Build device info with null safety
    const newInfo: DeviceInfo = {
      device_type: data.device_type ?? 'CPU',
      device_name: data.device_name ?? 'Unknown',
      cuda_version: data.cuda_version ?? null,
      pytorch_version: data.pytorch_version ?? 'Unknown',
      memory_total_gb: data.memory_total_gb ?? null,
      memory_used_gb: data.memory_used_gb ?? null,
      memory_percent: data.memory_percent ?? null,
      memory_trend: data.memory_trend ?? null,
      memory_velocity: data.memory_velocity ?? null,
      health_score: data.health_score ?? null,
      oom_risk_level: data.oom_risk_level ?? null,
      timestamp: data.timestamp ?? now,
      degraded_mode: data.degraded_mode ?? false
    }
    
    // Update statistics engine
    if (newInfo.memory_used_gb !== null && newInfo.memory_used_gb !== undefined) {
      statisticsEngineRef.current.addDataPoint(newInfo.memory_used_gb, newInfo.timestamp!)
    }
    
    setDeviceInfo(newInfo)
    setIsLoading(false)
    
    // Update connection health
    setConnectionHealth(prev => ({
    isHealthy: true,
    lastUpdate: now,
    failureCount: 0,
    successCount: prev.successCount + 1,
    avgLatency: realLatency > 0 && realLatency < 5000 // sanity check
      ? prev.avgLatency * 0.7 + realLatency * 0.3 
      : prev.avgLatency,
    reconnectAttempts: 0
    }))
    
    // Reset stale check timer
    if (staleCheckTimerRef.current) {
      clearTimeout(staleCheckTimerRef.current)
    }
    staleCheckTimerRef.current = setTimeout(() => {
      setConnectionHealth(prev => ({ ...prev, isHealthy: false }))
    }, STALE_THRESHOLD_MS)
    
  }, [])
  
  // ═════════════════════════════════════════════════════════════════════════
  // INITIAL DATA FETCH WITH EXPONENTIAL BACKOFF
  // ═════════════════════════════════════════════════════════════════════════
  
  const fetchInitialData = useCallback(async (attempt = 0) => {
    if (!circuitBreakerRef.current.canAttempt()) {
      console.warn('Circuit breaker open - skipping fetch')
      return
    }
    
    try {
      const backendUrl = window.location.origin.replace(':5173', ':8000')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`${backendUrl}/system/device-info`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        processDeviceStats({ type: 'device_stats', ...data })
        circuitBreakerRef.current.recordSuccess()
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      circuitBreakerRef.current.recordFailure()
      
      setConnectionHealth(prev => ({
        ...prev,
        failureCount: prev.failureCount + 1,
        isHealthy: false
      }))
      
      // Exponential backoff retry
      if (attempt < 5) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, attempt),
          MAX_RECONNECT_DELAY
        )
        
        reconnectTimerRef.current = setTimeout(() => {
          fetchInitialData(attempt + 1)
        }, delay)
        
        setConnectionHealth(prev => ({
          ...prev,
          reconnectAttempts: attempt + 1
        }))
      }
    }
  }, [processDeviceStats])
  
  // ═════════════════════════════════════════════════════════════════════════
  // WEBSOCKET INTEGRATION
  // ═════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!socket || !isConnected) {
      setConnectionHealth(prev => ({
        ...prev,
        isHealthy: false,
        reconnectAttempts: prev.reconnectAttempts + 1
      }))
      return
    }
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        processDeviceStats(data)
      } catch {
        // Ignore binary or malformed messages
      }
    }
    
    socket.addEventListener('message', handleMessage)
    
    // Fetch initial data if needed
    if (!deviceInfo) {
      fetchInitialData()
    }
    
    return () => {
      socket.removeEventListener('message', handleMessage)
      if (staleCheckTimerRef.current) {
        clearTimeout(staleCheckTimerRef.current)
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [socket, isConnected, processDeviceStats, fetchInitialData, deviceInfo])
  
  // ═════════════════════════════════════════════════════════════════════════
  // COMPUTED METRICS WITH STATISTICAL ANALYSIS
  // ═════════════════════════════════════════════════════════════════════════
  
  const metrics = useMemo(() => {
    if (!deviceInfo) return null
    
    const isGPU = deviceInfo.device_type === 'GPU'
    const hasMemory = deviceInfo.memory_total_gb != null && 
                     deviceInfo.memory_used_gb != null &&
                     deviceInfo.memory_total_gb > 0
    
    const memoryPercent = deviceInfo.memory_percent ?? 0
    const memoryUsed = deviceInfo.memory_used_gb ?? 0
    const memoryTotal = deviceInfo.memory_total_gb ?? 0
    
    const showMemoryBadge = isGPU && hasMemory && memoryUsed > 0.1
    
    // Statistical metrics
    const stats = statisticsEngineRef.current.getMetrics()
    const ma1m = statisticsEngineRef.current.getMovingAverage(12) // 1 minute
    const ma5m = statisticsEngineRef.current.getMovingAverage(60) // 5 minutes
    
    // Determine trend (prefer backend, fallback to local calculation)
    const trend = deviceInfo.memory_trend ?? stats?.trend ?? 'stable'
    const velocity = deviceInfo.memory_velocity ?? stats?.velocity ?? 0
    
    // Anomaly detection
    const isAnomaly = stats ? stats.anomalyScore > ANOMALY_THRESHOLD : false
    
    // Animation intensity based on activity
    const pulseIntensity = memoryPercent > 70 ? 1.0 : 
                          memoryPercent > 30 ? 0.5 : 0
    
    // Health assessment
    const overallHealth = deviceInfo.health_score ?? 100
    const isDegraded = deviceInfo.degraded_mode || !hasMemory
    const isUnhealthy = !connectionHealth.isHealthy || overallHealth < 50
    
    return {
      isGPU,
      hasMemory,
      memoryPercent,
      memoryUsed,
      memoryTotal,
      showMemoryBadge,
      stats,
      ma1m,
      ma5m,
      trend,
      velocity,
      isAnomaly,
      pulseIntensity,
      overallHealth,
      isDegraded,
      isUnhealthy
    }
  }, [deviceInfo, connectionHealth])
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER GUARDS
  // ═════════════════════════════════════════════════════════════════════════
  
  if (isLoading || !deviceInfo || !metrics) return null
  
  const {
    isGPU,
    hasMemory,
    memoryPercent,
    memoryUsed,
    memoryTotal,
    showMemoryBadge,
    stats,
    ma1m,
    ma5m,
    trend,
    velocity,
    isAnomaly,
    pulseIntensity,
    overallHealth,
    isDegraded,
    isUnhealthy
  } = metrics
  
  // ═════════════════════════════════════════════════════════════════════════
  // VISUAL HELPERS
  // ═════════════════════════════════════════════════════════════════════════
  
  const getMemoryColor = () => {
    if (isAnomaly) return 'from-red-500 to-red-400'
    if (memoryPercent < 50) return 'from-green-500 to-green-400'
    if (memoryPercent < 80) return 'from-yellow-500 to-yellow-400'
    return 'from-orange-500 to-orange-400'
  }
  
  const getBadgeColor = () => {
    if (isUnhealthy) return 'bg-red-500/10 border-red-500/30'
    if (isDegraded) return 'bg-yellow-500/10 border-yellow-500/30'
    if (!isGPU) return 'bg-gray-500/10 border-gray-500/30'
    if (trend === 'rising') return 'bg-amber-500/10 border-amber-500/30'
    return 'bg-green-500/10 border-green-500/30'
  }
  
  const getIconColor = () => {
    if (isUnhealthy) return 'text-red-400'
    if (isDegraded) return 'text-yellow-400'
    return isGPU ? 'text-green-400' : 'text-gray-400'
  }
  
  const getTrendIcon = () => {
    if (trend === 'rising') return '↑'
    if (trend === 'falling') return '↓'
    return '→'
  }
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  
  return (
    <div className="fixed top-6 right-6 z-50">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative"
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        {/* Main Badge */}
        <div className={`
          flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl border
          ${getBadgeColor()}
          cursor-pointer transition-all duration-200
          hover:scale-105
          ${isUnhealthy ? 'animate-pulse' : ''}
        `}>
          {/* Status Indicator */}
          <div className={`relative w-2 h-2 rounded-full ${getIconColor()}`}>
            {isGPU && pulseIntensity > 0 && !prefersReducedMotion && (
              <motion.div
                animate={{ 
                  scale: [1, 1.5, 1], 
                  opacity: [0.5, 0, 0.5] 
                }}
                transition={{ 
                  duration: 2 / pulseIntensity,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className={`absolute inset-0 rounded-full ${getIconColor().replace('text-', 'bg-')}`}
              />
            )}
          </div>

          {/* Device Type */}
          <span className={`text-sm font-medium ${getIconColor()}`}>
            {deviceInfo.device_type}
          </span>

          {/* Memory Badge */}
          {showMemoryBadge && (
            <span className="text-xs font-mono text-green-300/80">
              {memoryUsed.toFixed(1)}GB
            </span>
          )}
          
          {/* Trend Indicator */}
          {isGPU && hasMemory && trend !== 'stable' && (
            <span className="text-xs">{getTrendIcon()}</span>
          )}

          {/* Performance Icon */}
          <svg className={`w-4 h-4 ${getIconColor()}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Detailed Tooltip */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-80 p-4 rounded-2xl backdrop-blur-xl bg-gray-900/95 border border-white/10 shadow-2xl"
            >
              <div className="space-y-3">
                {/* Device Info */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Device</p>
                  <p className="text-sm font-medium text-white">{deviceInfo.device_name}</p>
                </div>

                {/* CUDA Version */}
                {isGPU && deviceInfo.cuda_version && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">CUDA</p>
                    <p className="text-sm text-white">{deviceInfo.cuda_version}</p>
                  </div>
                )}

                {/* Memory Section */}
                {isGPU && hasMemory && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">VRAM Usage</p>
                      {velocity !== 0 && (
                        <span className="text-xs text-gray-400">
                          {Math.abs(velocity * 1000).toFixed(0)} MB/s {getTrendIcon()}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-white">
                      {memoryUsed.toFixed(2)} / {memoryTotal.toFixed(1)} GB
                      <span className="text-gray-400 ml-2">({memoryPercent.toFixed(0)}%)</span>
                    </p>
                    
                    {/* Memory Bar */}
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mt-2">
                      <motion.div 
                        className={`h-full bg-gradient-to-r ${getMemoryColor()}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${memoryPercent}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    
                    {/* Statistical Insights */}
                    {stats && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">1m avg:</span>
                          <span className="text-gray-300 ml-1">{ma1m.toFixed(2)} GB</span>
                        </div>
                        <div>
                          <span className="text-gray-500">5m avg:</span>
                          <span className="text-gray-300 ml-1">{ma5m.toFixed(2)} GB</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Peak:</span>
                          <span className="text-gray-300 ml-1">{stats.max.toFixed(2)} GB</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Baseline:</span>
                          <span className="text-gray-300 ml-1">{stats.min.toFixed(2)} GB</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Anomaly Warning */}
                    {isAnomaly && (
                      <div className="mt-2 px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">
                        ⚠️ Unusual memory spike detected
                      </div>
                    )}
                  </div>
                )}

                {/* OOM Risk */}
                {deviceInfo.oom_risk_level && deviceInfo.oom_risk_level !== 'low' && (
                  <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
                    deviceInfo.oom_risk_level === 'high' 
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {deviceInfo.oom_risk_level === 'high' ? '🔥' : '⚠️'} OOM Risk: {deviceInfo.oom_risk_level}
                  </div>
                )}

                {/* Health Score */}
                {deviceInfo.health_score != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">System Health</p>
                      <span className="text-xs text-gray-300">{overallHealth.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${
                          overallHealth > 80 ? 'bg-green-500' :
                          overallHealth > 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${overallHealth}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Connection Health */}
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Connection</span>
                    <span className={connectionHealth.isHealthy ? 'text-green-400' : 'text-red-400'}>
                      {connectionHealth.isHealthy ? '🟢 Live' : '🔴 Degraded'}
                    </span>
                  </div>
                  {connectionHealth.avgLatency > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Latency</span>
                      <span className="text-gray-300">{connectionHealth.avgLatency.toFixed(0)}ms</span>
                    </div>
                  )}
                </div>

                {/* PyTorch Version */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">PyTorch</p>
                  <p className="text-xs text-gray-400 font-mono">{deviceInfo.pytorch_version}</p>
                </div>

                {/* Degraded Mode Warning */}
                {isDegraded && (
                  <div className="px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs">
                    ⚠️ Limited telemetry - install pynvml for full metrics
                  </div>
                )}

                {/* Status Badge */}
                <div className={`px-3 py-2 rounded-lg text-center text-xs font-medium ${
                  isUnhealthy ? 'bg-red-500/20 text-red-400' :
                  isDegraded ? 'bg-yellow-500/20 text-yellow-400' :
                  isGPU ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {isUnhealthy ? '🔥 Connection Issues' :
                   isDegraded ? '⚡ Limited Mode' :
                   isGPU ? '⚡ GPU Acceleration Active' : '🐌 CPU Mode'}
                </div>
                
                {/* Timestamp */}
                {deviceInfo.timestamp && (
                  <p className="text-xs text-gray-500 text-center">
                    Updated {new Date(deviceInfo.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
})