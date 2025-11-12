/**
 * Simple GPU Device Indicator
 * Shows GPU name in top-right corner - no polling, no WebSocket
 */
import { useEffect, useState } from 'react'

interface DeviceInfo {
  device_type: 'GPU' | 'CPU'
  device_name: string
  cuda_version?: string
}

export const SimpleDeviceIndicator = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      try {
        const response = await fetch('http://localhost:8000/system/device-info')
        if (response.ok) {
          const data = await response.json()
          setDeviceInfo(data)
        }
      } catch (error) {
        console.error('Failed to fetch device info:', error)
      }
    }

    fetchDeviceInfo()
  }, [])

  if (!deviceInfo) return null

  const isGPU = deviceInfo.device_type === 'GPU'

  return (
    <div
      className="backdrop-blur-2xl rounded-2xl border transition-all duration-300 p-3 pointer-events-none"
      style={{
        background: "linear-gradient(135deg, rgba(25, 22, 10, 0.95) 0%, rgba(35, 30, 13, 0.98) 50%, rgba(28, 24, 11, 0.95) 100%)",
        borderColor: "rgba(200, 140, 35, 0.3)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(200, 140, 40, 0.15)"
      }}
    >
      <div className="text-right">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em]"
          style={{
            color: "rgba(200, 140, 35, 0.4)",
            marginBottom: "2px"
          }}
        >
          {deviceInfo.device_type} Accelerated
        </p>
        <p
          className="text-sm font-light"
          style={{
            color: isGPU ? "#22c55e" : "#9ca3af",
            letterSpacing: "0.05em",
            lineHeight: "1"
          }}
        >
          {deviceInfo.device_name.replace('NVIDIA', 'NVIDIA®')}
        </p>
        {isGPU && deviceInfo.cuda_version && (
          <p
            className="text-[9px] font-medium uppercase tracking-[0.15em] mt-0.5"
            style={{
              background: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #7c3aed 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}
          >
            CUDA {deviceInfo.cuda_version}
          </p>
        )}
      </div>
    </div>
  )
}
