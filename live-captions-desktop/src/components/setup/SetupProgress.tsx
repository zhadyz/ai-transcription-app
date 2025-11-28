/**
 * STYGIAN Setup Progress Screen
 * Shows real-time progress during first-launch backend initialization
 */
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { listen } from '@tauri-apps/api/event'

interface SetupProgressPayload {
  stage: string
  percent: number
  detail?: string
}

interface SetupProgressProps {
  onComplete: () => void
  onError?: (error: string) => void
}

export const SetupProgress = ({ onComplete, onError }: SetupProgressProps) => {
  const [progress, setProgress] = useState<SetupProgressPayload>({
    stage: 'Initializing...',
    percent: 0,
    detail: 'Starting Stygian backend'
  })
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef(Date.now())

  // Timer for elapsed time display
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Listen for progress and completion events
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null
    let unlistenComplete: (() => void) | null = null
    let unlistenError: (() => void) | null = null

    const setupListeners = async () => {
      unlistenProgress = await listen<SetupProgressPayload>('setup-progress', (event) => {
        console.log('Setup progress:', event.payload)
        setProgress(event.payload)
      })

      unlistenComplete = await listen('setup-complete', () => {
        console.log('Setup complete!')
        onComplete()
      })

      unlistenError = await listen<{ error: string }>('backend-status', (event) => {
        if (event.payload && (event.payload as any).status === 'error') {
          console.error('Backend error:', (event.payload as any).error)
          onError?.((event.payload as any).error)
        }
      })
    }

    setupListeners()

    return () => {
      unlistenProgress?.()
      unlistenComplete?.()
      unlistenError?.()
    }
  }, [onComplete, onError])

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 140, 0, 0.15) 0%, transparent 70%)'
        }}
      />

      {/* Main content container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center max-w-md px-8"
      >
        {/* STYGIAN Logo/Title */}
        <div className="flex items-center mb-8">
          {/* Animated sun icon */}
          <motion.div
            animate={{
              boxShadow: [
                '0 0 20px rgba(255, 140, 0, 0.8), 0 0 40px rgba(255, 100, 0, 0.6)',
                '0 0 30px rgba(255, 140, 0, 1), 0 0 60px rgba(255, 100, 0, 0.8)',
                '0 0 20px rgba(255, 140, 0, 0.8), 0 0 40px rgba(255, 100, 0, 0.6)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="mr-4"
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#ff8c00',
            }}
          />
          <span
            className="text-2xl font-light tracking-[0.4em] uppercase"
            style={{
              color: '#e89a2f',
              textShadow: '0 0 15px rgba(255, 140, 0, 0.5), 0 0 30px rgba(228, 154, 47, 0.3)',
            }}
          >
            STYGIAN
          </span>
        </div>

        {/* Progress bar container */}
        <div className="w-full mb-6">
          {/* Progress bar background */}
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{
              background: 'rgba(255, 140, 0, 0.1)',
              border: '1px solid rgba(255, 140, 0, 0.2)'
            }}
          >
            {/* Animated progress fill */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress.percent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #ff8c00 0%, #e89a2f 50%, #ffb347 100%)',
                boxShadow: '0 0 10px rgba(255, 140, 0, 0.5)'
              }}
            />
          </div>

          {/* Percentage text */}
          <div className="flex justify-between mt-2">
            <span className="text-amber-200/60 text-xs font-mono">
              {progress.percent}%
            </span>
            <span className="text-amber-200/40 text-xs">
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        {/* Stage text */}
        <motion.div
          key={progress.stage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <p
            className="text-amber-200 text-sm tracking-wide mb-2"
            style={{
              textShadow: '0 0 10px rgba(255, 140, 0, 0.3)'
            }}
          >
            {progress.stage}
          </p>
          {progress.detail && (
            <p className="text-amber-200/50 text-xs max-w-xs">
              {progress.detail}
            </p>
          )}
        </motion.div>

        {/* Loading animation */}
        <div className="flex gap-2 mt-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1, 0.8]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut'
              }}
              className="w-2 h-2 rounded-full"
              style={{ background: '#ff8c00' }}
            />
          ))}
        </div>

        {/* First-launch notice */}
        {progress.percent < 50 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-gray-500 text-xs mt-8 text-center max-w-xs"
          >
            First-time setup may take several minutes while downloading AI models and dependencies.
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}

export default SetupProgress
