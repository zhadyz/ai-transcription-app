/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DESKTOP SESSION PROVIDER - Creates NEW sessions
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { DistributedSession, DeviceRole } from './DistributedSession'
import { BACKEND_URL, WEBSOCKET_URL } from '@/config/backend'

interface SessionState {
  id: string | null
  qrUrl: string | null
  isConnected: boolean
  deviceCount: number
  role: DeviceRole | null
  lastSync: number | null
  error: string | null
  expiresAt: number | null
}

interface SessionContextValue {
  sessionId: string | null
  qrUrl: string | null
  isConnected: boolean
  deviceCount: number
  role: DeviceRole | null
  lastSync: number | null
  error: string | null
  expiresAt: number | null
  session: DistributedSession | null
  refreshSession: () => Promise<void>
  isRecovering: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)


const STORAGE_KEY = 'transcription-session'
const EXPIRY_MS = 30 * 60 * 1000
const MAX_RECOVERY = 5
const INITIAL_BACKOFF = 1000
const MAX_BACKOFF = 30000

interface SessionProviderProps {
  backendUrl: string
  children: React.ReactNode
}

export function SessionProvider({ backendUrl, children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({
    id: null,
    qrUrl: null,
    isConnected: false,
    deviceCount: 0,
    role: null,
    lastSync: null,
    error: null,
    expiresAt: null
  })

  const sessionRef = useRef<DistributedSession | null>(null)
  const recoveryRef = useRef({ attempts: 0, lastAttempt: 0, backoffMs: INITIAL_BACKOFF })
  const cleanupRef = useRef<(() => void) | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const isCreatingRef = useRef(false)

  // Aggressive cleanup helper
  const destroyCurrentSession = useCallback(() => {
    console.log('🧹 [Desktop] Destroying current session')
    
    // Clear all timers
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    
    // Run cleanup
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    
    // Destroy session
    if (sessionRef.current) {
      sessionRef.current.destroy()
      sessionRef.current = null
    }
  }, [])

  const clearPersistedSession = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('Failed to clear storage:', e)
    }
  }, [])

  // ✅ FIXED: Retry validation with exponential backoff
  const validateSessionWithRetry = useCallback(async (sessionId: string): Promise<boolean> => {
    const MAX_RETRIES = 10
    const RETRY_DELAY_MS = 200
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`🔍 [Desktop] Validation attempt ${attempt + 1}/${MAX_RETRIES}`)
        const response = await fetch(`${BACKEND_URL()}/session/${sessionId}/info`, {
          method: 'GET'
        })
        
        if (response.ok) {
          console.log('✅ [Desktop] Session validated successfully')
          return true
        }
        
        // Session not found yet, wait and retry
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_MS * Math.pow(1.5, attempt)
          console.log(`⏳ [Desktop] Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (err) {
        console.warn(`⚠️ [Desktop] Validation attempt ${attempt + 1} failed:`, err)
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
        }
      }
    }
    
    console.error('❌ [Desktop] Session validation failed after all retries')
    return false
  }, [backendUrl])

  const createSession = useCallback(async (): Promise<string | null> => {
    // Prevent concurrent creation
    if (isCreatingRef.current) {
      console.warn('⚠️ [Desktop] Session creation already in progress')
      return null
    }
    
    isCreatingRef.current = true
    
    try {
      // STEP 1: Aggressive cleanup
      console.log('🧹 [Desktop] Cleanup before creating new session')
      destroyCurrentSession()
      clearPersistedSession()
      
      // STEP 2: Create session on backend
      console.log('🔧 [Desktop] Creating new session...')
      const response = await fetch(`${BACKEND_URL()}/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status}`)
      }

      const data = await response.json()
      const newSessionId = data.session_id

      console.log('✅ [Desktop] Session created on backend:', newSessionId)

      // STEP 3: Wait for backend to fully initialize session (with retry)
      console.log('⏳ [Desktop] Waiting for backend to initialize session...')
      const isValid = await validateSessionWithRetry(newSessionId)
      
      if (!isValid) {
        throw new Error('Session validation failed after retries')
      }

      // STEP 4: Small additional delay to ensure WebSocket handler is ready
      console.log('⏳ [Desktop] Waiting 500ms for WebSocket handler...')
      await new Promise(resolve => setTimeout(resolve, 500))

      // STEP 5: Persist
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          id: newSessionId,
          createdAt: Date.now(),
          expiresAt: Date.now() + EXPIRY_MS
        }))
      } catch (e) {
        console.warn('Failed to persist session:', e)
      }
      
      recoveryRef.current = { attempts: 0, lastAttempt: 0, backoffMs: INITIAL_BACKOFF }

      return newSessionId
    } catch (err) {
      console.error('❌ [Desktop] Session creation error:', err)
      return null
    } finally {
      isCreatingRef.current = false
    }
  }, [backendUrl, destroyCurrentSession, clearPersistedSession, validateSessionWithRetry])

  const recoverSession = useCallback(async () => {
    const recovery = recoveryRef.current

    if (recovery.attempts >= MAX_RECOVERY) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: 'Session recovery failed',
          isConnected: false
        }))
      }
      clearPersistedSession()
      return
    }

    const now = Date.now()
    if (now - recovery.lastAttempt < recovery.backoffMs) return

    console.log(`🔄 [Desktop] Recovery attempt ${recovery.attempts + 1}/${MAX_RECOVERY}`)

    recovery.attempts++
    recovery.lastAttempt = now
    recovery.backoffMs = Math.min(recovery.backoffMs * 2, MAX_BACKOFF)

    destroyCurrentSession()

    const sessionId = await createSession()
    if (sessionId && mountedRef.current) {
      await initSession(sessionId)
    } else if (mountedRef.current) {
      setState(prev => ({ ...prev, error: 'Recovery failed', isConnected: false }))
    }
  }, [createSession, clearPersistedSession, destroyCurrentSession])

  const initSession = useCallback(async (sessionId: string) => {
    console.log('🎯 [Desktop] Initializing DistributedSession:', sessionId)
    
    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }

    const deviceId = localStorage.getItem('device-id') || generateUUID()
    localStorage.setItem('device-id', deviceId)

    const deviceType = /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    
    // Create DistributedSession - this will connect WebSocket
    console.log('🎯 [Desktop] Creating DistributedSession with WebSocket')
    const session = new DistributedSession(sessionId, BACKEND_URL(), deviceId, deviceType)
    sessionRef.current = session

    // Generate QR URL
    const qrUrl = `${window.location.origin}/mobile-upload?session=${sessionId}`

    console.log('🌐 [Desktop] QR URL:', qrUrl)

    if (mountedRef.current) {
      setState(prev => ({ 
        ...prev, 
        id: sessionId, 
        qrUrl,
        expiresAt: Date.now() + EXPIRY_MS
      }))
    }

    // Subscribe to connection status
    const connectionSub = session['connectionStatus$'].subscribe(status => {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: status.connected,
          lastSync: status.lastSync,
          error: status.connected ? null : prev.error
        }))
        console.log('📡 [Desktop] WebSocket connection:', status.connected)
      }
    })

    // Subscribe to devices
    const devicesSub = session.observe(doc => doc.devices).subscribe(devices => {
      if (mountedRef.current) {
        const deviceList = Object.values(devices)
        const currentDevice = devices[deviceId]

        setState(prev => ({
          ...prev,
          deviceCount: deviceList.length,
          role: currentDevice?.role || null
        }))
      }
    })

    // Heartbeat
    heartbeatRef.current = setInterval(() => {
      const lastSync = state.lastSync
      if (lastSync && Date.now() - lastSync > 60000) {
        console.warn('⚠️ [Desktop] Stale session detected')
        recoverSession()
      }
    }, 30000)

    // Cleanup function
    cleanupRef.current = () => {
      connectionSub.unsubscribe()
      devicesSub.unsubscribe()
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      session.destroy()
    }
  }, [backendUrl, recoverSession, state.lastSync])

  // Mount effect
  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      const sessionId = await createSession()
      if (sessionId && mountedRef.current) {
        await initSession(sessionId)
      }
    }

    init()

    // Network handlers
    const onlineHandler = () => {
      console.log('🌐 [Desktop] Online')
      if (!sessionRef.current?.['connectionStatus$'].value.connected) {
        recoverSession()
      }
    }

    const offlineHandler = () => {
      console.log('📡 [Desktop] Offline')
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isConnected: false }))
      }
    }

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        const lastSync = state.lastSync
        if (lastSync && Date.now() - lastSync > 30000) {
          console.log('👁️ [Desktop] Tab visible, checking session')
          recoverSession()
        }
      }
    }

    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      mountedRef.current = false
      destroyCurrentSession()
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    console.log('🔄 [Desktop] Manual refresh')
    
    destroyCurrentSession()
    clearPersistedSession()

    recoveryRef.current = { attempts: 0, lastAttempt: 0, backoffMs: INITIAL_BACKOFF }

    const sessionId = await createSession()
    if (sessionId && mountedRef.current) {
      await initSession(sessionId)
    }
  }, [createSession, initSession, destroyCurrentSession, clearPersistedSession])

  const value = useMemo(() => ({
    sessionId: state.id,
    qrUrl: state.qrUrl,
    isConnected: state.isConnected,
    deviceCount: state.deviceCount,
    role: state.role,
    lastSync: state.lastSync,
    error: state.error,
    expiresAt: state.expiresAt,
    session: sessionRef.current,
    refreshSession,
    isRecovering: recoveryRef.current.attempts > 0
  }), [state, refreshSession])

  return (
    <SessionContext.Provider value={value}>
      <div data-session-provider="desktop" style={{ display: 'contents' }}>
        {children}
      </div>
    </SessionContext.Provider>
  )
}

export function useSessionContext() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSessionContext must be used within SessionProvider')
  }
  return context
}