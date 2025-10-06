import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion'

interface QRCodeDisplayProps {
  sessionId: string | null
  qrUrl: string | null
  isConnected: boolean  // ✅ Now comes from useSession (via context)
  onFileReceived: (fileInfo: any) => void
  expiresAt?: number
  onRefresh?: () => void
}

export default function QRCodeDisplay({ 
  sessionId,
  qrUrl, 
  isConnected,  // ✅ This is now the DistributedSession connection status
  onFileReceived,
  expiresAt,
  onRefresh
}: QRCodeDisplayProps) {
  // ✅ REMOVED: Local wsConnected state (use isConnected prop instead)
  const [expiresIn, setExpiresIn] = useState<number>(0)
  const [filesReceived, setFilesReceived] = useState(0)
  const [devicesConnected, setDevicesConnected] = useState(0)
  const [lastActivity, setLastActivity] = useState<Date | null>(null)
  
  // ✅ REMOVED: All WebSocket refs and management
  // const wsRef = useRef<WebSocket | null>(null)
  // const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // const reconnectAttemptsRef = useRef(0)
  // const isMountedRef = useRef(true)

  // Calculate time remaining
  useEffect(() => {
    if (!expiresAt) return

    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setExpiresIn(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // ✅ REMOVED: All WebSocket connection logic (lines 50-186)
  // The DistributedSession in SessionContext handles all WebSocket communication
  // Messages arrive via CRDT observations in FileUpload.tsx

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format last activity
  const formatLastActivity = (date: Date): string => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  // Loading state
  if (!qrUrl || !sessionId) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden max-w-xs mx-auto"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
        
        <div className="relative text-center">
          <div className="animate-spin w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Initializing session...</p>
        </div>
      </motion.div>
    )
  }

  // Session expired
  if (expiresIn === 0 && expiresAt) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative backdrop-blur-md bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 overflow-hidden max-w-xs mx-auto"
      >
        <div className="relative text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Session Expired</h3>
            <p className="text-sm text-gray-400">Generate a new QR code to continue</p>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="w-full px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 rounded-xl transition-all font-medium"
            >
              Generate New Code
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative backdrop-blur-md bg-white/5 border border-white/20 rounded-2xl p-5 overflow-hidden max-w-xs mx-auto"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-blue-500/5 pointer-events-none"></div>
      
      <div className="relative space-y-4">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Alternatively,</p>
          <h3 className="text-lg font-semibold text-white">Mobile Upload</h3>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-2xl p-4 shadow-xl w-fit mx-auto relative">
          <QRCodeSVG
            value={qrUrl}
            size={160}
            level="H"
            includeMargin={false}
          />
          
          {/* Connection status indicator */}
          <div className="absolute -top-2 -right-2">
            <div className={`relative w-6 h-6 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-500'
            } flex items-center justify-center shadow-lg`}>
              <AnimatePresence>
                {isConnected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.5, 1] }}
                    exit={{ scale: 0 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full bg-green-400 opacity-50"
                  />
                )}
              </AnimatePresence>
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status & Info */}
        <div className="space-y-2 text-center">
          <p className="text-xs text-gray-400">
            Scan with your phone camera
          </p>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-500 animate-pulse'
            }`}></div>
            <span className={isConnected ? 'text-green-400' : 'text-yellow-500'}>
              {isConnected ? (devicesConnected > 0 ? `${devicesConnected} device linked` : 'Ready') : 'Connecting...'}
            </span>
          </div>

          {/* Timer */}
          {expiresIn > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Expires in {formatTime(expiresIn)}</span>
            </div>
          )}

          {/* Files received counter */}
          {filesReceived > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-1.5 text-xs text-blue-400 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>{filesReceived} file{filesReceived !== 1 ? 's' : ''} received</span>
            </motion.div>
          )}

          {/* Last activity */}
          {lastActivity && (
            <div className="text-xs text-gray-600">
              Last activity: {formatLastActivity(lastActivity)}
            </div>
          )}

          {/* URL (for debugging) */}
          <details className="text-xs">
            <summary className="text-gray-600 cursor-pointer hover:text-gray-500">
              Show URL
            </summary>
            <p className="mt-2 text-gray-700 font-mono break-all bg-black/20 p-2 rounded">
              {qrUrl}
            </p>
          </details>
        </div>
      </div>
    </motion.div>
  )
}