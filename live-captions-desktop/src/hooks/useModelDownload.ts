import { useState, useCallback, useRef, useEffect } from 'react'
import { useBackendUrl } from './useBackendUrl'

/**
 * Model information from backend
 */
export interface ModelInfo {
  name: string
  size_mb: number
  downloaded: boolean
  description: string
}

/**
 * Download progress state
 */
export interface DownloadProgress {
  model: string
  status: 'idle' | 'starting' | 'downloading' | 'complete' | 'error' | 'already_downloaded'
  progress: number
  downloaded_mb: number
  total_mb: number
  speed_mbps: number
  message?: string
}

/**
 * Hook return type
 */
interface UseModelDownloadReturn {
  models: ModelInfo[]
  isLoading: boolean
  error: string | null
  downloadProgress: Map<string, DownloadProgress>
  activeDownloads: Set<string>
  fetchModels: () => Promise<void>
  downloadModel: (modelName: string) => void
  downloadAllModels: () => void
  deleteModel: (modelName: string) => Promise<boolean>
  cancelDownload: (modelName: string) => void
  isModelDownloaded: (modelName: string) => boolean
  checkModelStatus: (modelName: string) => Promise<boolean>
}

/**
 * Custom hook for managing Whisper model downloads with real-time progress
 *
 * Features:
 * - Fetch available models with download status
 * - Download individual models with WebSocket progress
 * - Download all models sequentially
 * - Delete downloaded models
 * - Real-time progress tracking
 */
export function useModelDownload(): UseModelDownloadReturn {
  const { backendUrl, isReady } = useBackendUrl()
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map())
  const [activeDownloads, setActiveDownloads] = useState<Set<string>>(new Set())

  const websocketsRef = useRef<Map<string, WebSocket>>(new Map())
  const downloadQueueRef = useRef<string[]>([])
  const isDownloadingAllRef = useRef(false)

  /**
   * Fetch available models from backend
   */
  const fetchModels = useCallback(async () => {
    if (!backendUrl || !isReady) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${backendUrl}/models/`)
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }
      const data: ModelInfo[] = await response.json()
      setModels(data)
    } catch (err) {
      console.error('[ModelDownload] Error fetching models:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch models')
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl, isReady])

  /**
   * Download a single model with WebSocket progress
   * Includes retry logic with exponential backoff for production reliability
   */
  const downloadModel = useCallback((modelName: string, retryCount: number = 0) => {
    const MAX_RETRIES = 3
    const BASE_DELAY_MS = 1000

    if (!backendUrl || !isReady) {
      console.error('[ModelDownload] Backend not ready, cannot download')
      setDownloadProgress(prev => {
        const newMap = new Map(prev)
        newMap.set(modelName, {
          model: modelName,
          status: 'error',
          progress: 0,
          downloaded_mb: 0,
          total_mb: 0,
          speed_mbps: 0,
          message: 'Backend not ready - please wait and try again'
        })
        return newMap
      })
      return
    }

    // Check if already downloading
    if (activeDownloads.has(modelName)) {
      console.log('[ModelDownload] Already downloading:', modelName)
      return
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = backendUrl.replace('http://', 'ws://') + `/models/ws/download/${modelName}`
    console.log(`[ModelDownload] Connecting to: ${wsUrl} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`)

    const ws = new WebSocket(wsUrl)
    websocketsRef.current.set(modelName, ws)

    // Add to active downloads
    setActiveDownloads(prev => new Set(prev).add(modelName))

    // Initialize progress
    setDownloadProgress(prev => {
      const newMap = new Map(prev)
      newMap.set(modelName, {
        model: modelName,
        status: 'starting',
        progress: 0,
        downloaded_mb: 0,
        total_mb: 0,
        speed_mbps: 0
      })
      return newMap
    })

    ws.onopen = () => {
      console.log('[ModelDownload] WebSocket connected for:', modelName)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[ModelDownload] Received:', data)

        setDownloadProgress(prev => {
          const newMap = new Map(prev)
          newMap.set(modelName, {
            model: data.model || modelName,
            status: data.status || 'downloading',
            progress: data.progress || 0,
            downloaded_mb: data.downloaded_mb || 0,
            total_mb: data.total_mb || data.size_mb || 0,
            speed_mbps: data.speed_mbps || 0,
            message: data.message
          })
          return newMap
        })

        // Handle completion
        if (data.status === 'complete' || data.status === 'already_downloaded') {
          // Update model list to reflect download status
          setModels(prev => prev.map(m =>
            m.name === modelName ? { ...m, downloaded: true } : m
          ))

          // Remove from active downloads
          setActiveDownloads(prev => {
            const newSet = new Set(prev)
            newSet.delete(modelName)
            return newSet
          })

          // Process next in queue if downloading all
          if (isDownloadingAllRef.current && downloadQueueRef.current.length > 0) {
            const nextModel = downloadQueueRef.current.shift()
            if (nextModel) {
              setTimeout(() => downloadModel(nextModel), 500)
            }
          } else if (downloadQueueRef.current.length === 0) {
            isDownloadingAllRef.current = false
          }
        }

        // Handle error
        if (data.status === 'error') {
          setActiveDownloads(prev => {
            const newSet = new Set(prev)
            newSet.delete(modelName)
            return newSet
          })
        }
      } catch (err) {
        console.error('[ModelDownload] Error parsing message:', err)
      }
    }

    ws.onerror = (error) => {
      console.error(`[ModelDownload] WebSocket error (attempt ${retryCount + 1}):`, error)

      // Remove from active downloads for retry
      setActiveDownloads(prev => {
        const newSet = new Set(prev)
        newSet.delete(modelName)
        return newSet
      })
      websocketsRef.current.delete(modelName)

      // Retry with exponential backoff if under max retries
      if (retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`[ModelDownload] Retrying in ${delay}ms... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`)

        setDownloadProgress(prev => {
          const newMap = new Map(prev)
          newMap.set(modelName, {
            model: modelName,
            status: 'starting',
            progress: 0,
            downloaded_mb: 0,
            total_mb: 0,
            speed_mbps: 0,
            message: `Connection failed, retrying in ${delay / 1000}s...`
          })
          return newMap
        })

        setTimeout(() => {
          downloadModel(modelName, retryCount + 1)
        }, delay)
      } else {
        // Max retries exceeded
        console.error(`[ModelDownload] Max retries exceeded for ${modelName}`)
        setDownloadProgress(prev => {
          const newMap = new Map(prev)
          newMap.set(modelName, {
            model: modelName,
            status: 'error',
            progress: 0,
            downloaded_mb: 0,
            total_mb: 0,
            speed_mbps: 0,
            message: 'Connection failed after multiple retries. Please check if backend is running.'
          })
          return newMap
        })
      }
    }

    ws.onclose = (event) => {
      console.log('[ModelDownload] WebSocket closed:', event.code, event.reason)
      websocketsRef.current.delete(modelName)
    }
  }, [backendUrl, isReady, activeDownloads])

  /**
   * Download all models that are not yet downloaded
   */
  const downloadAllModels = useCallback(() => {
    const notDownloaded = models.filter(m => !m.downloaded).map(m => m.name)

    if (notDownloaded.length === 0) {
      console.log('[ModelDownload] All models already downloaded')
      return
    }

    console.log('[ModelDownload] Starting download all:', notDownloaded)
    isDownloadingAllRef.current = true
    downloadQueueRef.current = notDownloaded.slice(1) // Queue all except first

    // Start with first model
    if (notDownloaded[0]) {
      downloadModel(notDownloaded[0])
    }
  }, [models, downloadModel])

  /**
   * Delete a downloaded model
   */
  const deleteModel = useCallback(async (modelName: string): Promise<boolean> => {
    if (!backendUrl || !isReady) return false

    try {
      const response = await fetch(`${backendUrl}/models/${modelName}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`)
      }

      // Update model list
      setModels(prev => prev.map(m =>
        m.name === modelName ? { ...m, downloaded: false } : m
      ))

      // Clear progress
      setDownloadProgress(prev => {
        const newMap = new Map(prev)
        newMap.delete(modelName)
        return newMap
      })

      return true
    } catch (err) {
      console.error('[ModelDownload] Error deleting model:', err)
      return false
    }
  }, [backendUrl, isReady])

  /**
   * Cancel an active download
   */
  const cancelDownload = useCallback((modelName: string) => {
    const ws = websocketsRef.current.get(modelName)
    if (ws) {
      ws.close()
      websocketsRef.current.delete(modelName)
    }

    setActiveDownloads(prev => {
      const newSet = new Set(prev)
      newSet.delete(modelName)
      return newSet
    })

    setDownloadProgress(prev => {
      const newMap = new Map(prev)
      newMap.delete(modelName)
      return newMap
    })

    // Clear queue if downloading all
    if (isDownloadingAllRef.current) {
      downloadQueueRef.current = []
      isDownloadingAllRef.current = false
    }
  }, [])

  /**
   * Check if a model is downloaded (from local state)
   * This is a synchronous check using cached model data
   */
  const isModelDownloaded = useCallback((modelName: string): boolean => {
    // Map frontend model names to backend names if needed
    const backendModelName = modelName === 'large-v2' ? 'large-v3' : modelName
    const model = models.find(m => m.name === backendModelName || m.name === modelName)
    return model?.downloaded ?? false
  }, [models])

  /**
   * Check model status from backend (async, fresh data)
   * Use this before switching models to ensure accurate status
   */
  const checkModelStatus = useCallback(async (modelName: string): Promise<boolean> => {
    if (!backendUrl || !isReady) return false

    // Map frontend model names to backend names if needed
    const backendModelName = modelName === 'large-v2' ? 'large-v3' : modelName

    try {
      const response = await fetch(`${backendUrl}/models/${backendModelName}/status`)
      if (!response.ok) {
        console.error(`[ModelDownload] Failed to check status for ${backendModelName}`)
        return false
      }
      const data = await response.json()
      console.log(`[ModelDownload] Model ${backendModelName} status:`, data)
      return data.downloaded === true
    } catch (err) {
      console.error(`[ModelDownload] Error checking model status:`, err)
      return false
    }
  }, [backendUrl, isReady])

  // Fetch models on mount when backend is ready
  useEffect(() => {
    if (isReady && backendUrl) {
      fetchModels()
    }
  }, [isReady, backendUrl, fetchModels])

  // Cleanup WebSockets on unmount
  useEffect(() => {
    return () => {
      websocketsRef.current.forEach(ws => ws.close())
      websocketsRef.current.clear()
    }
  }, [])

  return {
    models,
    isLoading,
    error,
    downloadProgress,
    activeDownloads,
    fetchModels,
    downloadModel,
    downloadAllModels,
    deleteModel,
    cancelDownload,
    isModelDownloaded,
    checkModelStatus
  }
}
