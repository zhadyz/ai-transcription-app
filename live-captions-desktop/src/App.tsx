import { HashRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect } from 'react'
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SessionProvider } from './core/SessionContext'
import { WebSocketProvider } from './core/WebSocketContext'
import { LiveCaptureProvider, useLiveCapture } from './contexts/LiveCaptureContext'
import { LiveCapturePanel, CaptionOverlay } from './components/livecapture'
import { SimpleDeviceIndicator } from './components/system/SimpleDeviceIndicator'
import { SetupWizard, SetupProgress } from './components/setup'
import Overlay from './Overlay'
import InterviewMode from './pages/InterviewMode'

const FileUpload = lazy(() => import('./components/upload/FileUpload'))
const MobileUpload = lazy(() => import('./components/upload/MobileUpload'))

const BACKGROUND_VIDEO = "https://storage.googleapis.com/onyxlab/Onyx.mp4"

const BackgroundMedia = () => (
  <video
    autoPlay
    loop
    muted
    playsInline
    className="absolute inset-0 w-full h-full object-cover opacity-30"
  >
    <source src={BACKGROUND_VIDEO} type="video/mp4" />
  </video>
)

// Custom Title Bar with STYGIAN branding
function TitleBar() {
  const appWindow = getCurrentWindow();

  const minimizeWindow = async () => {
    await appWindow.minimize();
  };

  const maximizeWindow = async () => {
    await appWindow.toggleMaximize();
  };

  const closeWindow = async () => {
    await appWindow.close();
  };

  return (
    <div
      className="h-10 w-full flex items-center justify-between px-3 backdrop-blur-2xl"
      style={{
        background: "linear-gradient(135deg, rgba(50, 45, 20, 0.45) 0%, rgba(60, 50, 22, 0.50) 50%, rgba(55, 47, 18, 0.45) 100%)",
        borderBottom: "1px solid rgba(255, 200, 50, 0.25)",
        boxShadow: "0 2px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 200, 60, 0.15)",
      }}
    >
      {/* App Title - DRAGGABLE */}
      <div
        data-tauri-drag-region
        className="flex items-center ml-4 flex-1 h-full select-none"
      >
        {/* Glowing Circle - Sun Icon */}
        <div
          className="mr-3"
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#ff8c00",
            boxShadow: "0 0 20px rgba(255, 140, 0, 1), 0 0 30px rgba(255, 100, 0, 0.9), 0 0 40px rgba(200, 80, 0, 0.8), 0 0 50px rgba(180, 60, 0, 0.6)",
          }}
        />
        <span
          className="text-base font-light tracking-[0.3em] uppercase"
          style={{
            color: "#e89a2f",
            textShadow: "0 0 10px rgba(255, 140, 0, 0.5), 0 0 20px rgba(228, 154, 47, 0.3)",
            letterSpacing: "0.25em",
          }}
        >
          STYGIAN
        </span>
      </div>

      {/* Window Controls - NOT DRAGGABLE */}
      <div className="flex items-center gap-1" style={{ pointerEvents: 'auto', userSelect: 'none' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Minimize clicked');
            minimizeWindow();
          }}
          className="w-9 h-7 rounded flex items-center justify-center
                     hover:bg-amber-500/20 transition-all duration-200 group"
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            zIndex: 9999,
            position: 'relative'
          }}
        >
          <span className="text-amber-200/70 group-hover:text-amber-200 text-base leading-none font-light" style={{ pointerEvents: 'none' }}>−</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Maximize clicked');
            maximizeWindow();
          }}
          className="w-9 h-7 rounded flex items-center justify-center
                     hover:bg-amber-500/20 transition-all duration-200 group"
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            zIndex: 9999,
            position: 'relative'
          }}
        >
          <span className="text-amber-200/70 group-hover:text-amber-200 text-sm leading-none font-light" style={{ pointerEvents: 'none' }}>□</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Close clicked');
            closeWindow();
          }}
          className="w-9 h-7 rounded flex items-center justify-center
                     hover:bg-red-600/80 transition-all duration-200 group"
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            zIndex: 9999,
            position: 'relative'
          }}
        >
          <span className="text-amber-200/70 group-hover:text-white text-xl leading-none font-light" style={{ pointerEvents: 'none' }}>×</span>
        </button>
      </div>
    </div>
  );
}

// Component to display live captions from context
function LiveCaptionsDisplay() {
  const { currentCaption, settings } = useLiveCapture();

  return (
    <CaptionOverlay
      caption={currentCaption}
      position={settings.position}
      fontSize={settings.fontSize}
      showTranslation={settings.showTranslation}
    />
  );
}

export default function App() {
  console.log('🎨 [STYGIAN] App component rendering!')

  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null)
  const [isCheckingSetup, setIsCheckingSetup] = useState(true)
  const [backendUrl, setBackendUrl] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  // Listen for backend-status event from Tauri backend manager
  useEffect(() => {
    let unlisten: (() => void) | null = null

    const setupBackendListener = async () => {
      // First, try to get the current backend URL (in case event already fired)
      try {
        const url = await invoke<string>('get_backend_url')
        if (url && url !== 'http://127.0.0.1:8000') {
          console.log('🔗 [STYGIAN] Got backend URL from invoke:', url)
          setBackendUrl(url)
        }
      } catch (e) {
        console.log('⏳ [STYGIAN] Backend URL not ready yet, waiting for event...')
      }

      // Listen for backend-status event
      unlisten = await listen<{ status: string; url?: string; error?: string }>('backend-status', (event) => {
        console.log('📡 [STYGIAN] Received backend-status event:', event.payload)
        if (event.payload.status === 'ready' && event.payload.url) {
          setBackendUrl(event.payload.url)
          setBackendError(null)
        } else if (event.payload.status === 'error') {
          setBackendError(event.payload.error || 'Backend failed to start')
        }
      })
    }

    setupBackendListener()

    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  console.log('🔗 [STYGIAN] Backend URL:', backendUrl)

  // Check if first-launch setup has been completed
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const complete = await invoke<boolean>('is_setup_complete')
        console.log('🔍 [SETUP] Setup status:', complete)
        setIsSetupComplete(complete)
      } catch (error) {
        console.error('❌ [SETUP] Failed to check setup status:', error)
        // On error, assume setup not complete
        setIsSetupComplete(false)
      } finally {
        setIsCheckingSetup(false)
      }
    }

    checkSetup()
  }, [])

  const handleSetupComplete = () => {
    console.log('✅ [SETUP] Setup complete, showing main app')
    setIsSetupComplete(true)
  }

  // Handle backend setup completion
  const handleBackendReady = () => {
    // Backend is ready - the backendUrl state will be updated by the event listener
    console.log('Backend setup complete')
  }

  // Handle backend setup error
  const handleBackendError = (error: string) => {
    setBackendError(error)
  }

  // Show loading while checking setup status or waiting for backend
  if (isCheckingSetup || !backendUrl) {
    // Show error screen if there's a backend error
    if (backendError) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
          <div className="text-amber-200 text-sm tracking-[0.2em] uppercase mb-4">
            Backend Error
          </div>
          <div className="text-red-400 text-xs max-w-md text-center px-4">
            {backendError}
          </div>
        </div>
      )
    }

    // Show simple loading during setup check
    if (isCheckingSetup) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
          <div className="text-amber-200 text-sm tracking-[0.2em] uppercase mb-4">
            Loading...
          </div>
        </div>
      )
    }

    // Show setup progress screen while initializing backend
    return (
      <SetupProgress
        onComplete={handleBackendReady}
        onError={handleBackendError}
      />
    )
  }

  // Show setup wizard if not complete
  if (!isSetupComplete) {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  return (
    <HashRouter>
      <Routes>
        {/* Overlay route - standalone, no wrapping */}
        <Route path="/overlay" element={<Overlay />} />

        {/* Main app routes - with full layout */}
        <Route path="*" element={
          <SessionProvider backendUrl={backendUrl}>
            <WebSocketProvider>
              <LiveCaptureProvider>
                {/* Main container with custom title bar */}
                <div className="h-screen w-full flex flex-col bg-black overflow-hidden">
                  {/* STYGIAN Custom Title Bar */}
                  <TitleBar />

                  {/* Device Indicator - Fixed Top Right */}
                  <div
                    style={{
                      position: "fixed",
                      top: "56px",
                      right: "24px",
                      zIndex: 9999,
                      pointerEvents: "none"
                    }}
                  >
                    <SimpleDeviceIndicator />
                  </div>

                  {/* Main content area with web application */}
                  <div className="flex-1 relative overflow-y-auto">
                    <BackgroundMedia />

                    <LiveCapturePanel />
                    <LiveCaptionsDisplay />

                    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
                      <Routes>
                        <Route path="/" element={
                          <div className="relative z-10 container mx-auto px-4 py-12">
                            <FileUpload />
                          </div>
                        } />
                        <Route path="/mobile-upload" element={<MobileUpload />} />
                        <Route path="/interview" element={<InterviewMode />} />
                      </Routes>
                    </Suspense>
                  </div>
                </div>
              </LiveCaptureProvider>
            </WebSocketProvider>
          </SessionProvider>
        } />
      </Routes>
    </HashRouter>
  )
}
