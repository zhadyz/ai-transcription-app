import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * WebSocket configuration interface
 */
interface UseWebSocketConfig {
  url: string | null
  enabled?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
}

/**
 * WebSocket hook return type
 */
interface UseWebSocketReturn {
  isConnected: boolean
  lastMessage: any
  sendMessage: (message: any) => void
  reconnect: () => void
}

/**
 * Custom hook for WebSocket connections with automatic reconnection
 * 
 * Features:
 * - Automatic connection management
 * - Reconnection with exponential backoff
 * - Proper cleanup on unmount
 * - Type-safe message handling
 * - Connection status tracking
 * - Manual reconnect capability
 * 
 * Connection Lifecycle:
 * 1. CONNECTING: Initial connection attempt
 * 2. OPEN: Connection established, ready to send/receive
 * 3. CLOSING: Connection being closed
 * 4. CLOSED: Connection closed, may attempt reconnect
 * 
 * Reconnection Strategy:
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
 * - Configurable max attempts (default: 5)
 * - Manual reconnect available
 * 
 * @example
 * const { isConnected, lastMessage, sendMessage } = useWebSocket({
 *   url: 'ws://localhost:8000/ws/session-123',
 *   enabled: true
 * })
 * 
 * useEffect(() => {
 *   if (lastMessage) {
 *     console.log('Received:', lastMessage)
 *   }
 * }, [lastMessage])
 */
export const useWebSocket = (config: UseWebSocketConfig): UseWebSocketReturn => {
  const {
    url,
    enabled = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000
  } = config

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectCountRef = useRef(0)
  const isMountedRef = useRef(true)

  /**
   * Clean up WebSocket connection and timeouts
   */
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  /**
   * Connect to WebSocket with error handling
   */
  const connect = useCallback(() => {
    // Don't connect if disabled, no URL, or already connected
    if (!enabled || !url || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Clean up any existing connection
    cleanup()

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      /**
       * Handle WebSocket open event
       */
      ws.onopen = () => {
        if (!isMountedRef.current) return

        console.log('[WebSocket] Connected to:', url)
        setIsConnected(true)
        reconnectCountRef.current = 0 // Reset reconnect counter on successful connection
      }

      /**
       * Handle incoming WebSocket messages
       */
      ws.onmessage = (event) => {
        if (!isMountedRef.current) return

        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
        } catch (err) {
          // If not JSON, store raw data
          setLastMessage(event.data)
        }
      }

      /**
       * Handle WebSocket errors
       */
      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        // Error will trigger onclose, which handles reconnection
      }

      /**
       * Handle WebSocket close event with reconnection logic
       */
      ws.onclose = (event) => {
        if (!isMountedRef.current) return

        console.log('[WebSocket] Disconnected:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null

        // Attempt reconnection if not a normal closure and within retry limit
        if (
          event.code !== 1000 && // 1000 = normal closure
          reconnectCountRef.current < reconnectAttempts &&
          enabled
        ) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectCountRef.current),
            16000
          )

          console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current + 1}/${reconnectAttempts})`
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++
            connect()
          }, delay)
        } else if (reconnectCountRef.current >= reconnectAttempts) {
          console.error('[WebSocket] Max reconnection attempts reached')
        }
      }
    } catch (err) {
      console.error('[WebSocket] Connection error:', err)
    }
  }, [url, enabled, reconnectAttempts, reconnectInterval, cleanup])

  /**
   * Send message through WebSocket
   */
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const data = typeof message === 'string' ? message : JSON.stringify(message)
      wsRef.current.send(data)
    } else {
      console.warn('[WebSocket] Cannot send message: not connected')
    }
  }, [])

  /**
   * Manual reconnect function
   */
  const reconnect = useCallback(() => {
    reconnectCountRef.current = 0 // Reset counter for manual reconnect
    cleanup()
    connect()
  }, [cleanup, connect])

  /**
   * Connect on mount or when URL/enabled changes
   */
  useEffect(() => {
    isMountedRef.current = true

    if (enabled && url) {
      connect()
    }

    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [url, enabled, connect, cleanup])

  return {
    isConnected,
    lastMessage,
    sendMessage,
    reconnect
  }
}