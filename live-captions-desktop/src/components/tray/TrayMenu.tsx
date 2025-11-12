/**
 * STYGIAN Custom Tray Menu
 * Beautiful dark-themed context menu for system tray icon
 */
import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { motion, AnimatePresence } from 'framer-motion'

interface TrayMenuItem {
  id: string
  label: string
  icon?: string
  action: () => void
  separator?: boolean
  disabled?: boolean
}

export const TrayMenu = () => {
  const [isVisible, setIsVisible] = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const menuItems: TrayMenuItem[] = [
    {
      id: 'start',
      label: 'Start Live Captions',
      icon: '▶',
      action: async () => {
        await invoke('start_capture')
        closeMenu()
      }
    },
    {
      id: 'stop',
      label: 'Stop Live Captions',
      icon: '⏸',
      action: async () => {
        await invoke('stop_capture')
        closeMenu()
      }
    },
    {
      id: 'separator1',
      label: '',
      separator: true,
      action: () => {}
    },
    {
      id: 'show',
      label: 'Show Main Window',
      icon: '🖥',
      action: () => {
        // TODO: Show main window
        closeMenu()
      }
    },
    {
      id: 'separator2',
      label: '',
      separator: true,
      action: () => {}
    },
    {
      id: 'quit',
      label: 'Quit STYGIAN',
      icon: '✕',
      action: async () => {
        await invoke('quit_app')
      }
    }
  ]

  const closeMenu = async () => {
    setIsVisible(false)
    setTimeout(async () => {
      const window = getCurrentWindow()
      await window.close()
    }, 200)
  }

  // Close menu when clicking outside (on window blur)
  useEffect(() => {
    const window = getCurrentWindow()

    const handleBlur = async () => {
      closeMenu()
    }

    window.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        closeMenu()
      }
    })
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 flex items-start justify-center pt-2"
          onClick={closeMenu}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="backdrop-blur-xl rounded-xl border overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(20, 18, 8, 0.98) 0%, rgba(28, 24, 10, 0.98) 50%, rgba(22, 19, 9, 0.98) 100%)',
              borderColor: 'rgba(200, 140, 35, 0.4)',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(200, 140, 35, 0.2), inset 0 1px 0 rgba(200, 140, 40, 0.15)',
              minWidth: '220px',
              maxWidth: '280px'
            }}
          >
            {/* Menu Header */}
            <div
              className="px-4 py-3 border-b"
              style={{
                background: 'linear-gradient(135deg, rgba(35, 30, 13, 0.5) 0%, rgba(40, 34, 15, 0.5) 100%)',
                borderColor: 'rgba(200, 140, 35, 0.2)'
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ff8c00',
                    boxShadow: '0 0 12px rgba(255, 140, 0, 0.8), 0 0 20px rgba(255, 100, 0, 0.6)'
                  }}
                />
                <span
                  className="text-sm font-light tracking-[0.2em] uppercase"
                  style={{
                    color: '#e89a2f',
                    textShadow: '0 0 8px rgba(255, 140, 0, 0.3)'
                  }}
                >
                  STYGIAN
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {menuItems.map((item) => {
                if (item.separator) {
                  return (
                    <div
                      key={item.id}
                      className="h-px mx-2 my-1"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(200, 140, 35, 0.2), transparent)'
                      }}
                    />
                  )
                }

                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    disabled={item.disabled}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 transition-all duration-150"
                    style={{
                      background: hoveredItem === item.id
                        ? 'linear-gradient(90deg, rgba(200, 140, 35, 0.15) 0%, rgba(200, 140, 35, 0.08) 100%)'
                        : 'transparent',
                      color: item.disabled ? 'rgba(200, 140, 35, 0.3)' : '#d4a550',
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      borderLeft: hoveredItem === item.id ? '2px solid rgba(200, 140, 35, 0.5)' : '2px solid transparent'
                    }}
                  >
                    {item.icon && (
                      <span className="text-sm opacity-70">{item.icon}</span>
                    )}
                    <span className="text-sm font-light tracking-wide">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
