/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSCRIPTION ORCHESTRATION - FIXED & WORKING
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { DistributedSession } from '@/core/DistributedSession'
import { ZeroCopyStream } from '@/core/ZeroCopyStream'
import { ReactiveStateMachine, ErrorCode } from '@/core/TypeSafeStateMachine'
import { BloomFilter, LRUCache, MemoryPool } from '@/core/FileOperationEngine'
import { filter } from 'rxjs/operators'
import { BACKEND_URL, ensureBackendDetected } from '@/config/backend'


// ═══════════════════════════════════════════════════════════════════════════
// BRANDED TYPES
// ═══════════════════════════════════════════════════════════════════════════

declare const TaskIdBrand: unique symbol
declare const PercentageBrand: unique symbol
declare const SessionIdBrand: unique symbol

type TaskId = string & { readonly [TaskIdBrand]: true }
type Percentage = number & { readonly [PercentageBrand]: true }
type SessionId = string & { readonly [SessionIdBrand]: true }

const TaskId = (id: string): TaskId => {
  if (!id || id.length < 8) throw new Error('Invalid TaskId')
  return id as TaskId
}

const Percentage = (n: number): Percentage => {
  const clamped = Math.max(0, Math.min(100, n))
  return clamped as Percentage
}

const SessionId = (id: string): SessionId => {
  if (!id) throw new Error('Invalid SessionId')
  return id as SessionId
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TranscriptionSegment {
  readonly start: number
  readonly end: number
  readonly text: string
}

export interface TranscriptionResult {
  readonly text: string
  readonly segments: ReadonlyArray<TranscriptionSegment>
  readonly language_detected: string
}

export interface TranscriptionProgress {
  readonly task_id?: TaskId
  readonly status: 'uploading' | 'processing' | 'completed' | 'failed'
  readonly progress: Percentage
  readonly current_step: string
  readonly estimated_time_remaining?: number
}

interface TranscriptionSettings {
  readonly language: string
  readonly quality: 'tiny' | 'base' | 'small' | 'medium' | 'large'
  readonly export_format: 'txt' | 'srt' | 'vtt' | 'json'
}

interface UseTranscriptionOptions {
  readonly pollingInterval?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════

class CircuitBreaker {
  private failures = 0
  private lastFailure = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  private readonly FAILURE_THRESHOLD = 5
  private readonly OPEN_DURATION = 30000
  private readonly SUCCESS_THRESHOLD = 2
  private successCount = 0

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.OPEN_DURATION) {
        this.state = 'half-open'
        this.successCount = 0
      } else {
        throw new Error('Circuit breaker open - too many failures')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.SUCCESS_THRESHOLD) {
        this.failures = 0
        this.state = 'closed'
      }
    } else if (this.state === 'closed') {
      this.failures = Math.max(0, this.failures - 1)
    }
  }

  private onFailure(): void {
    this.failures++
    this.lastFailure = Date.now()
    
    if (this.failures >= this.FAILURE_THRESHOLD) {
      this.state = 'open'
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTIVE BACKOFF
// ═══════════════════════════════════════════════════════════════════════════

class AdaptiveBackoff {
  private attempt = 0
  private readonly BASE_DELAY = 1000
  private readonly MAX_DELAY = 32000

  next(): number {
    const exponential = Math.min(
      this.MAX_DELAY,
      this.BASE_DELAY * Math.pow(2, this.attempt)
    )
    
    this.attempt++
    return Math.floor(exponential)
  }

  reset(): void {
    this.attempt = 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CACHE
// ═══════════════════════════════════════════════════════════════════════════

interface StatusData {
  readonly status: string
  readonly progress: number
  readonly current_step: string
  readonly result?: unknown
  readonly error?: string
}

class StatusCache {
  private readonly cache: LRUCache<TaskId, StatusData>
  private readonly lastPoll = new Map<TaskId, number>()
  private readonly MIN_POLL_INTERVAL = 500

  constructor(capacity: number = 100) {
    this.cache = new LRUCache<TaskId, StatusData>(capacity)
  }

  shouldPoll(taskId: TaskId): boolean {
    const last = this.lastPoll.get(taskId)
    if (!last) return true
    return Date.now() - last > this.MIN_POLL_INTERVAL
  }

  recordPoll(taskId: TaskId): void {
    this.lastPoll.set(taskId, Date.now())
  }

  get(taskId: TaskId): StatusData | undefined {
    return this.cache.get(taskId)
  }

  set(taskId: TaskId, data: StatusData): void {
    this.cache.set(taskId, data)
  }

  clear(taskId: TaskId): void {
    this.cache.delete(taskId)
    this.lastPoll.delete(taskId)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE DEDUPLICATOR
// ═══════════════════════════════════════════════════════════════════════════

class FileDeduplicator {
  private readonly bloom: BloomFilter
  private readonly memoryPool: MemoryPool

  constructor() {
    this.bloom = new BloomFilter(10000, 0.01)
    this.memoryPool = new MemoryPool()
  }

  private get cryptoAvailable(): boolean {
    return typeof crypto !== 'undefined' && !!crypto.subtle
  }

  async getFingerprint(file: File): Promise<string> {
    if (!this.cryptoAvailable) {
      return `${file.name}:${file.size}:${Date.now()}`
    }
    const sampleSize = Math.min(1024 * 1024, file.size)
    const buffer = this.memoryPool.acquire(sampleSize)
    
    try {
      const blob = file.slice(0, sampleSize)
      const arrayBuffer = await blob.arrayBuffer()
      const view = new Uint8Array(arrayBuffer)
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', view)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      return `${file.name}:${file.size}:${hashHex.slice(0, 16)}`
    } finally {
      this.memoryPool.release(buffer)
    }
  }

  async isDuplicate(file: File): Promise<boolean> {
    const fingerprint = await this.getFingerprint(file)
    return this.bloom.has(fingerprint)
  }

  async register(file: File): Promise<void> {
    const fingerprint = await this.getFingerprint(file)
    this.bloom.add(fingerprint)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UPLOAD TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════

interface UploadTransport {
  readonly type: 'zerocopy' | 'xhr'
  upload(
    file: File,
    settings: TranscriptionSettings,
    onProgress: (pct: Percentage) => void,
    signal?: AbortSignal
  ): Promise<TaskId>
}

class XHRTransport implements UploadTransport {
  readonly type = 'xhr' as const

  constructor(private readonly backendUrl: string) {}

  async upload(
    file: File,
    settings: TranscriptionSettings,
    onProgress: (pct: Percentage) => void,
    signal?: AbortSignal
  ): Promise<TaskId> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort()
          reject(new Error('Upload cancelled'))
        })
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = (e.loaded / e.total) * 100
          onProgress(Percentage(pct))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve(TaskId(data.task_id))
          } catch {
            reject(new Error('Invalid response'))
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', settings.language)
      formData.append('quality', settings.quality)
      formData.append('export_format', settings.export_format)

      xhr.open('POST', `${this.backendUrl}/transcribe/upload`)
      xhr.send(formData)
    })
  }
}

class ZeroCopyTransport implements UploadTransport {
  readonly type = 'zerocopy' as const
  private readonly stream: ZeroCopyStream

  constructor(private readonly backendUrl: string) {
    this.stream = new ZeroCopyStream({
      chunkSize: 64 * 1024,
      enableIntegrityCheck: true,
      adaptiveChunking: true
    })
  }

  async upload(
    file: File,
    settings: TranscriptionSettings,
    onProgress: (pct: Percentage) => void,
    signal?: AbortSignal
  ): Promise<TaskId> {
    const { progress$, result } = await this.stream.upload(
      file,
      `${this.backendUrl}/stream/upload`
    )

    const progressSub = progress$.subscribe(p => {
      onProgress(Percentage(p.percentage))
    })

    if (signal) {
      signal.addEventListener('abort', () => {
        progressSub.unsubscribe()
        this.stream.abort()
      })
    }

    try {
      const uploadResult = await result
      progressSub.unsubscribe()
      
      if (!uploadResult.success) {
        throw new Error('Upload failed')
      }

      // Use actual filename from upload response (may have UUID suffix if duplicate)
      const actualFilename = uploadResult.metadata?.filename || file.name

      const response = await fetch(`${this.backendUrl}/transcribe/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: actualFilename,
          quality: settings.quality,
          language: settings.language,
          export_format: settings.export_format
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Transcription start failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      return TaskId(data.task_id)
    } catch (error) {
      progressSub.unsubscribe()
      throw error
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

class TransportFactory {
  static async create(backendUrl: string): Promise<UploadTransport> {
    try {
      const response = await fetch(`${backendUrl}/capabilities`, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache'
      })
      
      const supportsStreaming = response.headers.get('x-supports-streaming')
      
      if (supportsStreaming === 'true') {
        console.log('[Transport] ✅ Using ZeroCopy (streaming)')
        return new ZeroCopyTransport(backendUrl)
      }
    } catch (error) {
      console.warn('[Transport] Capability check failed:', error)
    }

    console.log('[Transport] Using XHR (FormData)')
    return new XHRTransport(backendUrl)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT HELPER
// ═══════════════════════════════════════════════════════════════════════════

function useAnySessionContext(): { sessionId: string | null; session: DistributedSession | null } | null {
  try {
    const { useSessionContext } = require('@/core/SessionContext')
    const ctx = useSessionContext()
    return { sessionId: ctx.sessionId, session: ctx.session }
  } catch (desktopError) {
    try {
      const { useMobileSessionContext } = require('@/core/MobileSessionContext')
      const ctx = useMobileSessionContext()
      return { sessionId: ctx.sessionId, session: ctx.session }
    } catch (mobileError) {
      return null
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════

const breaker = new CircuitBreaker()
const deduplicator = new FileDeduplicator()

export const useTranscription = (options: UseTranscriptionOptions = {}) => {
  const sessionContext = useAnySessionContext()
  const { pollingInterval = 1000 } = options
  
  const sessionId = sessionContext?.sessionId || null
  const sharedSession = sessionContext?.session || null
  const enableWebSocket = !!sessionId && !!sharedSession

  const [taskId, setTaskId] = useState<TaskId | null>(null)
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  const machineRef = useRef<ReactiveStateMachine | null>(null)
  const transportRef = useRef<UploadTransport | null>(null)
  const backoffRef = useRef(new AdaptiveBackoff())
  const statusCacheRef = useRef(new StatusCache(100))
  const abortControllerRef = useRef<AbortController | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    const init = async () => {
      console.log('[useTranscription] Waiting for backend detection...')
      await ensureBackendDetected()
      
      console.log('[useTranscription] Initializing transport...')
      const currentBackendUrl = BACKEND_URL()
      transportRef.current = await TransportFactory.create(currentBackendUrl)
      machineRef.current = new ReactiveStateMachine()
      console.log('[useTranscription] Transport initialized:', transportRef.current?.type)

      if (sharedSession && enableWebSocket) {
        try {
          console.log('[useTranscription] Subscribing to shared session:', sessionId)

          const connectionSub = sharedSession['connectionStatus$']?.subscribe?.(status => {
            if (isMountedRef.current) {
              setIsConnected(status.connected)
              console.log('[useTranscription] Connection:', status.connected)
            }
          })

          const transcriptionSub = sharedSession.observe?.(doc => doc.transcription).pipe(
            filter(Boolean)
          ).subscribe?.(t => {
            if (!isMountedRef.current) return

            console.log('[useTranscription] CRDT update:', t)

            if (t.taskId && t.taskId !== taskId) {
              setTaskId(TaskId(t.taskId))
            }

            if (t.status === 'processing') {
              setProgress({
                task_id: t.taskId ? TaskId(t.taskId) : undefined,
                status: 'processing',
                progress: Percentage(t.progress || 0),
                current_step: t.currentStep || 'Processing...'
              })
            }

            if (t.status === 'completed' && t.result) {
              const segments = Array.isArray(t.result.segments) 
                ? t.result.segments 
                : []
                
              setResult({
                text: t.result.text || '',
                segments: segments.map(s => ({
                  start: s.start,
                  end: s.end,
                  text: s.text
                })),
                language_detected: t.result.language || 'unknown'
              })
              setProgress({
                status: 'completed',
                progress: Percentage(100),
                current_step: 'Completed'
              })
            }

            if (t.status === 'failed' && t.error) {
              setError(t.error)
            }
          })

          return () => {
            console.log('[useTranscription] Cleanup subscriptions')
            connectionSub?.unsubscribe?.()
            transcriptionSub?.unsubscribe?.()
          }
        } catch (err) {
          console.error('[useTranscription] Session subscription failed:', err)
        }
      }
    }

    init()

    return () => {
      console.log('[useTranscription] Component cleanup')
      isMountedRef.current = false
      abortControllerRef.current?.abort()
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [sessionId, sharedSession, enableWebSocket])

  useEffect(() => {
    if (taskId && !isUploading && !result && !error) {
      console.log('🔄 Auto-starting polling for task:', taskId)
      startPolling(taskId)
    }
  }, [taskId, isUploading, result, error])

  const pollStatus = useCallback(async (tid: TaskId): Promise<StatusData | null> => {
    const cache = statusCacheRef.current

    if (!cache.shouldPoll(tid)) {
      const cached = cache.get(tid)
      if (cached) return cached
      return null
    }

    cache.recordPoll(tid)

    try {
      const response = await fetch(`${BACKEND_URL()}/transcribe/progress/${tid}`)
      if (!response.ok) return null

      const progressData = await response.json()
      
      if (progressData.status === 'completed') {
        try {
          const resultResponse = await fetch(`${BACKEND_URL()}/transcribe/result/${tid}`)
          if (resultResponse.ok) {
            const resultData = await resultResponse.json()
            
            const segments = Array.isArray(resultData.segments) 
              ? resultData.segments 
              : []
            
            const combined = {
              ...progressData,
              result: {
                text: resultData.text || '',
                segments: segments,
                language_detected: resultData.language_detected || 'unknown'
              }
            }
            
            cache.set(tid, combined)
            return combined
          }
        } catch (resultErr) {
          console.error('Failed to fetch result:', resultErr)
        }
      }
      
      cache.set(tid, progressData)
      return progressData
      
    } catch (err) {
      console.error('Poll error:', err)
      return null
    }
  }, [])

  const handleStatus = useCallback((tid: TaskId, status: StatusData) => {
    if (!isMountedRef.current) return

    if (status.status === 'processing') {
      setProgress({
        task_id: tid,
        status: 'processing',
        progress: Percentage(status.progress || 0),
        current_step: status.current_step || 'Processing...'
      })
    } else if (status.status === 'completed' && status.result) {
      const res = status.result as any
      
      const segments = Array.isArray(res.segments) 
        ? res.segments 
        : []
      
      setProgress({
        task_id: tid,
        status: 'completed',
        progress: Percentage(100),
        current_step: 'Completed'
      })
      
      setResult({
        text: res.text || '',
        segments: segments,
        language_detected: res.language_detected || 'unknown'
      })
      
      stopPolling()
    } else if (status.status === 'failed') {
      setError(status.error || 'Transcription failed')
      setProgress({
        task_id: tid,
        status: 'failed',
        progress: Percentage(0),
        current_step: 'Failed'
      })
      stopPolling()
    }
  }, [])

  const startPolling = useCallback((tid: TaskId) => {
    stopPolling()
    
    console.log('📡 Starting polling for:', tid)
    pollTimerRef.current = setInterval(async () => {
      const status = await pollStatus(tid)
      if (status) handleStatus(tid, status)
    }, pollingInterval)
  }, [pollingInterval, pollStatus, handleStatus])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const startTranscription = useCallback(
    async (file: File, settings: TranscriptionSettings) => {
      if (!isMountedRef.current) return

      console.log('🚀 Starting transcription:', file.name)

      const transport = transportRef.current
      const machine = machineRef.current

      if (!transport) {
        console.error('❌ Transport not initialized!')
        setError('Transport not initialized')
        return
      }

      setError(null)
      setIsUploading(true)
      setProgress({
        status: 'uploading',
        progress: Percentage(0),
        current_step: 'Preparing...'
      })

      machine?.send('UPLOAD', file)

      const startTime = Date.now()
      abortControllerRef.current = new AbortController()

      try {
        const isDupe = await deduplicator.isDuplicate(file)
        if (isDupe) {
          console.log('[Upload] Duplicate detected (uploading anyway)')
        }

        const newTaskId = await breaker.execute(() =>
          transport.upload(
            file,
            settings,
            (pct) => {
              if (isMountedRef.current) {
                setProgress({
                  status: 'uploading',
                  progress: pct,
                  current_step: `Uploading... ${Math.round(pct)}%`
                })
              }
            },
            abortControllerRef.current.signal
          )
        )

        const elapsed = Date.now() - startTime
        backoffRef.current.reset()

        await deduplicator.register(file)

        if (isMountedRef.current) {
          setTaskId(newTaskId)
          setIsUploading(false)
          setProgress({
            task_id: newTaskId,
            status: 'processing',
            progress: Percentage(0),
            current_step: 'Starting transcription...'
          })

          sharedSession?.startTranscription?.(newTaskId)
          machine?.send('UPLOAD_SUCCESS', newTaskId)
          startPolling(newTaskId)
        }
      } catch (err) {
        if (isMountedRef.current) {
          const message = err instanceof Error ? err.message : 'Upload failed'
          setError(message)
          setIsUploading(false)
          setProgress({
            status: 'failed',
            progress: Percentage(0),
            current_step: 'Failed'
          })
          machine?.send('UPLOAD_FAILED', {
            code: ErrorCode.NETWORK_ERROR,
            message,
            timestamp: Date.now()
          })
        }
      }
    },
    [startPolling, sharedSession]
  )

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    stopPolling()
    taskId && statusCacheRef.current.clear(taskId)
    setTaskId(null)
    setProgress(null)
    setResult(null)
    setError(null)
    setIsUploading(false)
    backoffRef.current.reset()
    sharedSession?.reset?.()
    machineRef.current?.reset?.()
  }, [taskId, stopPolling, sharedSession])

  useEffect(() => {
    if (result || error) {
      stopPolling()
    }
  }, [result, error, stopPolling])

  return {
    taskId,
    progress,
    result,
    error,
    isUploading,
    isConnected,
    startTranscription,
    reset,
    setTaskId
  }
}

export const formatTimestamp = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}

export default useTranscription