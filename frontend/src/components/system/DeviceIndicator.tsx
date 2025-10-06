/**
 * Device Indicator - Shows GPU/CPU usage in top-right corner
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BACKEND_URL } from '@/config/backend'

interface DeviceInfo {
  device_type: 'GPU' | 'CPU'
  device_name: string
  cuda_version?: string
  memory_total_gb?: number
  memory_used_gb?: number
  pytorch_version: string
}

const hostname = window.location.hostname
const backendUrl = BACKEND_URL()

export function DeviceIndicator() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      try {
        const response = await fetch(`${backendUrl}/system/device-info`)
        if (response.ok) {
          const data = await response.json()
          setDeviceInfo(data)
        }
      } catch (err) {
        console.error('Failed to fetch device info:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDeviceInfo()
    // Refresh every 30 seconds
    const interval = setInterval(fetchDeviceInfo, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading || !deviceInfo) return null

  const isGPU = deviceInfo.device_type === 'GPU'

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
          ${isGPU 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-gray-500/10 border-gray-500/30'
          }
          cursor-pointer transition-all duration-200
          hover:scale-105
        `}>
          {/* Icon */}
          <div className={`relative w-2 h-2 rounded-full ${
            isGPU ? 'bg-green-400' : 'bg-gray-400'
          }`}>
            {isGPU && (
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-green-400"
              />
            )}
          </div>

          {/* Text */}
          <span className={`text-sm font-medium ${
            isGPU ? 'text-green-400' : 'text-gray-400'
          }`}>
            {deviceInfo.device_type}
          </span>

          {/* Performance Icon */}
          {isGPU ? (
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Detailed Tooltip */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full right-0 mt-2 w-64 p-4 rounded-2xl backdrop-blur-xl bg-gray-900/95 border border-white/10 shadow-2xl"
            >
              <div className="space-y-3">
                {/* Device Name */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Device</p>
                  <p className="text-sm font-medium text-white">{deviceInfo.device_name}</p>
                </div>

                {/* GPU-specific info */}
                {isGPU && deviceInfo.cuda_version && (
                  <>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">CUDA Version</p>
                      <p className="text-sm text-white">{deviceInfo.cuda_version}</p>
                    </div>

                    {deviceInfo.memory_total_gb && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">VRAM</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white">
                            {deviceInfo.memory_used_gb?.toFixed(1)} / {deviceInfo.memory_total_gb?.toFixed(1)} GB
                          </p>
                        </div>
                        {/* Memory Bar */}
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-green-400"
                            style={{ 
                              width: `${((deviceInfo.memory_used_gb || 0) / (deviceInfo.memory_total_gb || 1)) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* PyTorch Version */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">PyTorch</p>
                  <p className="text-xs text-gray-400 font-mono">{deviceInfo.pytorch_version}</p>
                </div>

                {/* Performance Badge */}
                <div className={`
                  px-3 py-2 rounded-lg text-center text-xs font-medium
                  ${isGPU 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-500/20 text-gray-400'
                  }
                `}>
                  {isGPU ? '⚡ GPU Acceleration Enabled' : '🐌 CPU Mode'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}