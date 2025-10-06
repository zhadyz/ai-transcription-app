import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FileUpload from './components/upload/FileUpload'
import MobileUpload from './components/upload/MobileUpload'
import { SessionProvider } from './core/SessionContext'
import { DeviceIndicator } from './components/system/DeviceIndicator'


export default function App() {
  const backgroundVideo = "https://storage.googleapis.com/onyxlab/Onyx.mp4"
  const backgroundImage = null
  
  const hostname = window.location.hostname
  const backendUrl = `http://${hostname}:8000`

  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-black">
        <DeviceIndicator />  {/* Shows on all pages */}
        {/* Background Media */}
        {backgroundVideo ? (
          <video
            autoPlay
            loop
            muted
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
        ) : backgroundImage ? (
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-black" />
        )}

        <Routes>
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* DESKTOP ROUTE - Creates NEW session                        */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <Route path="/" element={
            <SessionProvider backendUrl={backendUrl}>
              <div className="relative z-10 container mx-auto px-4 py-12">
                <header className="text-center mb-12">
                  <h1 className="text-5xl font-bold text-white mb-4">
                    AI Transcription Studio
                  </h1>
                  <p className="text-xl text-gray-400">
                    Transform audio and video into accurate transcripts
                  </p>
                </header>
                
                <main>
                  <FileUpload />
                </main>
              </div>
            </SessionProvider>
          } />

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MOBILE ROUTE - Joins EXISTING session from QR code         */}
          {/* No SessionProvider here - mobile handles its own session   */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <Route path="/mobile-upload" element={<MobileUpload />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}