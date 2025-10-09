import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense, useMemo } from 'react'
import { SessionProvider } from './core/SessionContext'
import { WebSocketProvider } from './core/WebSocketContext'
import { DeviceIndicator } from './components/system/DeviceIndicator'

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
    loading="lazy"
  >
    <source src={BACKGROUND_VIDEO} type="video/mp4" />
  </video>
)

export default function App() {
  const backendUrl = useMemo(() => 
    `http://${window.location.hostname}:8000`, 
    []
  )

  return (
    <BrowserRouter>
      <SessionProvider backendUrl={backendUrl}>
        <WebSocketProvider>
          <div className="relative min-h-screen bg-black">
            <BackgroundMedia />
            <DeviceIndicator />

            <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
              <Routes>
                <Route path="/" element={
                  <div className="relative z-10 container mx-auto px-4 py-12">
                    <header className="text-center mb-12">
                      <h1 className="text-5xl font-bold text-white mb-4">
                        AI Transcription Studio
                      </h1>
                      <p className="text-xl text-gray-400">
                        Transform audio and video into accurate transcripts
                      </p>
                    </header>
                    <FileUpload />
                  </div>
                } />
                <Route path="/mobile-upload" element={<MobileUpload />} />
              </Routes>
            </Suspense>
          </div>
        </WebSocketProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}