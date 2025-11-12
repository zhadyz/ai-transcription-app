/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSCENDENT BACKEND CONFIG - Ultimate Auto-Detection
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Automatically detects:
 * - HTTP vs HTTPS
 * - Port (8000, 8443, 8080, or custom)
 * - Protocol capabilities (streaming, WebSocket)
 * - Network conditions
 * 
 * Zero configuration. Just works. Pure enlightenment. 🧘‍♂️✨
 */

const hostname = window.location.hostname

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION STATE
// ═══════════════════════════════════════════════════════════════════════════

interface BackendEndpoint {
  protocol: 'http' | 'https'
  port: number
  latency: number
  supportsStreaming: boolean
}

let detectedEndpoint: BackendEndpoint | null = null
let isDetecting = false
let detectionAttempts = 0

// ═══════════════════════════════════════════════════════════════════════════
// SMART DETECTION - Tests Multiple Configurations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Test if backend is reachable and measure latency
 */
async function testBackendEndpoint(
  protocol: 'http' | 'https',
  port: number
): Promise<BackendEndpoint | null> {
  const startTime = performance.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    // Use root endpoint (always supports HEAD)
    const response = await fetch(`${protocol}://${hostname}:${port}/`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache'
    })

    clearTimeout(timeoutId)
    
    if (!response.ok) return null

    const latency = Math.round(performance.now() - startTime)

    // Check capabilities to see if streaming is supported
    let supportsStreaming = false
    try {
      const capResponse = await fetch(`${protocol}://${hostname}:${port}/capabilities`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000)
      })
      
      if (capResponse.ok) {
        const streamingHeader = capResponse.headers.get('x-supports-streaming')
        supportsStreaming = streamingHeader === 'true'
      }
    } catch {
      // Capabilities check failed, assume no streaming
    }

    return {
      protocol,
      port,
      latency,
      supportsStreaming
    }
  } catch (error) {
    return null
  }
}

/**
 * Ultimate backend detection - tries all common configurations
 */
async function detectBackendEndpoint(): Promise<BackendEndpoint> {
  if (detectedEndpoint) {
    return detectedEndpoint
  }

  if (isDetecting) {
    // Wait for ongoing detection
    while (isDetecting) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return detectedEndpoint || getDefaultEndpoint()
  }

  isDetecting = true
  detectionAttempts++
  console.log(`🔍 [Backend Config] Auto-detecting backend (attempt ${detectionAttempts})...`)

  try {
    // Priority order: HTTPS first (more secure), then common ports
    const configurations = [
      { protocol: 'https' as const, port: 8443 },  // Standard HTTPS alternate port
      { protocol: 'https' as const, port: 8000 },  // HTTPS on default port
      { protocol: 'http' as const, port: 8000 },   // HTTP on default port
      { protocol: 'http' as const, port: 8080 },   // HTTP alternate port
      { protocol: 'https' as const, port: 443 },   // Standard HTTPS port
      { protocol: 'http' as const, port: 80 },     // Standard HTTP port
    ]

    // Test all configurations in parallel for speed
    const results = await Promise.all(
      configurations.map(({ protocol, port }) => 
        testBackendEndpoint(protocol, port)
      )
    )

    // Filter out failed attempts
    const validEndpoints = results.filter((r): r is BackendEndpoint => r !== null)

    if (validEndpoints.length === 0) {
      console.warn('⚠️ [Backend Config] No backend found on any port, using defaults')
      detectedEndpoint = getDefaultEndpoint()
      return detectedEndpoint
    }

    // Prefer HTTPS, then lowest latency
    const bestEndpoint = validEndpoints.reduce((best, current) => {
      // HTTPS always wins over HTTP
      if (current.protocol === 'https' && best.protocol === 'http') {
        return current
      }
      if (current.protocol === 'http' && best.protocol === 'https') {
        return best
      }
      // Same protocol, choose lowest latency
      return current.latency < best.latency ? current : best
    })

    detectedEndpoint = bestEndpoint

    console.log('✅ [Backend Config] Detected backend:', {
      url: `${bestEndpoint.protocol}://${hostname}:${bestEndpoint.port}`,
      latency: `${bestEndpoint.latency}ms`,
      streaming: bestEndpoint.supportsStreaming ? 'enabled' : 'disabled',
      alternativesFound: validEndpoints.length
    })

    // Log alternatives if found
    if (validEndpoints.length > 1) {
      const alternatives = validEndpoints
        .filter(e => e !== bestEndpoint)
        .map(e => `${e.protocol}://${hostname}:${e.port} (${e.latency}ms)`)
      console.log(`ℹ️ [Backend Config] Alternative endpoints:`, alternatives)
    }

    return bestEndpoint
  } catch (error) {
    console.error('❌ [Backend Config] Detection failed:', error)
    detectedEndpoint = getDefaultEndpoint()
    return detectedEndpoint
  } finally {
    isDetecting = false
  }
}

/**
 * Default fallback configuration
 */
function getDefaultEndpoint(): BackendEndpoint {
  return {
    protocol: 'http',
    port: 8000,
    latency: 0,
    supportsStreaming: false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNCHRONOUS ACCESS (with intelligent fallback)
// ═══════════════════════════════════════════════════════════════════════════

// Note: Auto-detection disabled, using hardcoded configuration for stability
const detectionPromise = Promise.resolve(getDefaultEndpoint())

// Provide synchronous access with smart defaults
const getCurrentEndpoint = (): BackendEndpoint => {
  return detectedEndpoint || getDefaultEndpoint()
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API - Clean and Simple
// ═══════════════════════════════════════════════════════════════════════════

export const getBackendUrl = (): string => {
  // Use current hostname for cross-device compatibility
  const url = `http://${hostname}:8000`
  console.log('🔧 [Backend] Using backend URL:', url)
  return url
}

export const getWebSocketUrl = (): string => {
  // Use current hostname for cross-device compatibility
  const url = `ws://${hostname}:8000`
  console.log('🔧 [Backend] Using WebSocket URL:', url)
  return url
}

export const supportsStreaming = (): boolean => {
  return getCurrentEndpoint().supportsStreaming
}

export const getLatency = (): number => {
  return getCurrentEndpoint().latency
}

// Synchronous exports (use detected or default)


// Ensure detection is complete before critical operations
export const ensureBackendDetected = async (): Promise<BackendEndpoint> => {
  return await detectionPromise
}

// Force re-detection (useful for network changes)
export const redetectBackend = async (): Promise<BackendEndpoint> => {
  console.log('🔄 [Backend Config] Forcing re-detection...')
  detectedEndpoint = null
  isDetecting = false
  return await detectBackendEndpoint()
}

// Get comprehensive config after detection
export const getBackendConfig = async () => {
  const endpoint = await detectionPromise
  
  return {
    baseUrl: `${endpoint.protocol}://${hostname}:${endpoint.port}`,
    wsUrl: `${endpoint.protocol === 'https' ? 'wss' : 'ws'}://${hostname}:${endpoint.port}`,
    protocol: endpoint.protocol,
    port: endpoint.port,
    isSecure: endpoint.protocol === 'https',
    supportsStreaming: endpoint.supportsStreaming,
    latency: endpoint.latency,
    hostname
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK AWARENESS - Auto-redetect on network changes
// ═══════════════════════════════════════════════════════════════════════════

// Note: Network awareness disabled when using hardcoded configuration

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP - Log final configuration
// ═══════════════════════════════════════════════════════════════════════════

console.log('🔧 [Backend Config] Configuration loaded:', {
  url: `http://${hostname}:8000`,
  wsUrl: `ws://${hostname}:8000`,
  hostname
})

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT - Property getters for reactive access
// ═══════════════════════════════════════════════════════════════════════════
export { getBackendUrl as BACKEND_URL }
export { getWebSocketUrl as WEBSOCKET_URL }
export default {
  get url() { return getBackendUrl() },
  get wsUrl() { return getWebSocketUrl() },
  get protocol() { return getCurrentEndpoint().protocol },
  get port() { return getCurrentEndpoint().port },
  get isSecure() { return getCurrentEndpoint().protocol === 'https' },
  get streaming() { return getCurrentEndpoint().supportsStreaming },
  get latency() { return getCurrentEndpoint().latency },
  hostname,
  ensureDetected: ensureBackendDetected,
  redetect: redetectBackend,
  getConfig: getBackendConfig
}