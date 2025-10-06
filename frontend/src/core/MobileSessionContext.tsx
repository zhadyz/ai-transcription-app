/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOBILE SESSION PROVIDER - Joins EXISTING session from QR code
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { DistributedSession } from './DistributedSession'

interface MobileSessionContextValue {
  sessionId: string
  session: DistributedSession | null
  isConnected: boolean
  deviceCount: number
  error: string | null
}

const MobileSessionContext = createContext<MobileSessionContextValue | null>(null)

interface MobileSessionProviderProps {
  sessionId: string  // From URL ?session=...
  backendUrl: string
  children: React.ReactNode
}

export function MobileSessionProvider({ sessionId, backendUrl, children }: MobileSessionProviderProps) {
  const [state, setState] = useState<MobileSessionContextValue>({
    sessionId,
    session: null,
    isConnected: false,
    deviceCount: 0,
    error: null
  })

  const sessionRef = useRef<DistributedSession | null>(null)
  const mountedRef = useRef(true)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      console.log('📱 [Mobile] Joining session as CRDT peer:', sessionId)

      // Validate session exists on backend
      try {
        console.log('🔍 [Mobile] Validating session on backend...')
        const response = await fetch(`${backendUrl}/session/${sessionId}/info`)
        
        if (!response.ok) {
          throw new Error(`Session not found: ${response.status}`)
        }
        
        console.log('✅ [Mobile] Session validated on backend')
      } catch (err) {
        console.error('❌ [Mobile] Session validation failed:', err)
        setState(prev => ({ 
          ...prev, 
          error: 'Session not found. Please scan QR code again.' 
        }))
        return
      }

      // Generate unique mobile device ID
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

      const deviceId = localStorage.getItem('mobile-device-id') || generateUUID()
      localStorage.setItem('mobile-device-id', deviceId)

      // Wait a tiny bit to ensure desktop's session is fully initialized
      await new Promise(resolve => setTimeout(resolve, 500))

      // Create DistributedSession - Mobile becomes SECONDARY peer in CRDT
      console.log('🎯 [Mobile] Creating DistributedSession as peer')
      const session = new DistributedSession(
        sessionId,
        backendUrl,
        deviceId,
        'mobile'  // Device type
      )

      sessionRef.current = session

      // Subscribe to connection status
      const connectionSub = session['connectionStatus$'].subscribe(status => {
        if (mountedRef.current) {
          console.log('📱 [Mobile] Connection:', status.connected)
          setState(prev => ({
            ...prev,
            isConnected: status.connected
          }))
        }
      })

      // Subscribe to devices count
      const devicesSub = session.observe(doc => doc.devices).subscribe(devices => {
        if (mountedRef.current) {
          const count = Object.keys(devices).length
          setState(prev => ({
            ...prev,
            deviceCount: count
          }))
          console.log('📱 [Mobile] Devices in session:', count)
        }
      })

      // Update state
      setState(prev => ({
        ...prev,
        session,
        error: null
      }))

      // Cleanup function
      cleanupRef.current = () => {
        console.log('🧹 [Mobile] Cleanup')
        connectionSub.unsubscribe()
        devicesSub.unsubscribe()
        session.destroy()
      }
    }

    init()

    return () => {
      mountedRef.current = false
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [sessionId, backendUrl])

  const value = useMemo(() => state, [state])

  return (
    <MobileSessionContext.Provider value={value}>
      <div data-session-provider="mobile" style={{ display: 'contents' }}>
        {children}
      </div>
    </MobileSessionContext.Provider>
  )
}

export function useMobileSessionContext() {
  const context = useContext(MobileSessionContext)
  if (!context) {
    throw new Error('useMobileSessionContext must be used within MobileSessionProvider')
  }
  return context
}