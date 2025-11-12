import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Hook to get the dynamic backend URL from Tauri
 *
 * The backend runs on a dynamically allocated port (8000-9000)
 * determined by the Rust backend manager at startup.
 *
 * @returns Backend URL (e.g., "http://127.0.0.1:8001") or null if not ready
 */
export function useBackendUrl() {
  const [backendUrl, setBackendUrl] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unlistenStatus: (() => void) | undefined

    const initBackend = async () => {
      try {
        // Listen for backend status events
        unlistenStatus = await listen<{ status: string; url?: string; error?: string }>(
          'backend-status',
          (event) => {
            if (event.payload.status === 'ready' && event.payload.url) {
              setBackendUrl(event.payload.url)
              setIsReady(true)
              setError(null)
            } else if (event.payload.status === 'error') {
              setError(event.payload.error || 'Backend initialization failed')
              setIsReady(false)
            }
          }
        )

        // Get current backend URL (might already be ready)
        const url = await invoke<string>('get_backend_url')
        if (url && url !== 'http://127.0.0.1:8000') {
          // Non-default URL means backend is ready
          setBackendUrl(url)
          setIsReady(true)
        }
      } catch (err) {
        console.error('Failed to get backend URL:', err)
        setError(String(err))
      }
    }

    initBackend()

    return () => {
      if (unlistenStatus) {
        unlistenStatus()
      }
    }
  }, [])

  return { backendUrl, isReady, error }
}
