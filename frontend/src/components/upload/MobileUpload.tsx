/**
 * Mobile Upload - Clean orchestration with UI components
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MobileSessionProvider, useMobileSessionContext } from '@/core/MobileSessionContext'
import { useTranscription, formatTimestamp } from '@/hooks/useTranscription'
import { useTranslation } from '@/hooks/useTranslation'
import { MobileFooter } from '@/components/layout/MobileFooter'
import { SwipeableResultCards } from '@/components/transcription/SwipeableResultCards'
import { MobileBackground } from '@/components/mobile/MobileBackground'
import { MobileErrorScreen } from '@/components/mobile/MobileErrorScreen'
import { MobileFileUploadZone } from '@/components/mobile/MobileFileUploadZone'
import { MobileFileCard } from '@/components/mobile/MobileFileCard'
import { MobileTranscriptionCard } from '@/components/mobile/MobileTranscriptionCard'
import { BACKEND_URL } from '@/config/backend'

const hostname = window.location.hostname
const backendUrl = BACKEND_URL()

function MobileUploadContent() {
  const mobileSession = useMobileSessionContext()
  const transcription = useTranscription()
  const translation = useTranslation(backendUrl)
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedTranslation, setCopiedTranslation] = useState(false)
  const [showFullTranscription, setShowFullTranscription] = useState(false)

  // Background styling
  useEffect(() => {
    document.documentElement.style.backgroundColor = '#000000'
    document.body.style.backgroundColor = '#000000'
    return () => {
      document.documentElement.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
    }
  }, [])

  // Auto-hide copy notifications
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied])

  useEffect(() => {
    if (copiedTranslation) {
      const timeout = setTimeout(() => setCopiedTranslation(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [copiedTranslation])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      const validTypes = ['video/', 'audio/']
      if (!validTypes.some(type => file.type.startsWith(type))) {
        setError('Please select a video or audio file')
        return
      }
      
      if (file.size > 500 * 1024 * 1024) {
        setError('File too large. Maximum size is 500MB.')
        return
      }
      
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !mobileSession.sessionId) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setSuccess(true)
        } else {
          setError('Upload failed. Please try again.')
        }
        setUploading(false)
      })

      xhr.addEventListener('error', () => {
        setError('Upload failed. Please check your connection.')
        setUploading(false)
      })

      xhr.open('POST', `${backendUrl}/session/${mobileSession.sessionId}/upload`)
      xhr.send(formData)
    } catch (err) {
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const handleStartTranscription = async () => {
    if (!mobileSession.sessionId || !selectedFile) return

    try {
      const response = await fetch(`${backendUrl}/session/${mobileSession.sessionId}/start-transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'auto',
          quality: 'small',
          export_format: 'srt'
        })
      })

      if (!response.ok) throw new Error('Failed to start transcription')

      const data = await response.json()
      if (data.task_id) {
        transcription.setTaskId(data.task_id)
      }
    } catch (err) {
      setError('Failed to start transcription. Please try again.')
    }
  }

  const handleTranslate = async () => {
    if (translation.showTranslation) {
      translation.setShowTranslation(false)
      return
    }

    if (!transcription.result?.language_detected || !transcription.result?.segments.length) {
      setError('No transcription available for translation.')
      return
    }

    await translation.translate(
      transcription.result.segments as any,
      transcription.result.language_detected,
      translation.targetLanguage
    )
  }

  const handleCopy = async () => {
    if (!transcription.result) return
    try {
      const text = transcription.result.segments
        .map(segment => `${formatTimestamp(segment.start)} → ${formatTimestamp(segment.end)}\n${segment.text}`)
        .join('\n\n')
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch (err) {
      console.error('Copy failed')
    }
  }

  const handleCopyTranslation = async () => {
    if (!translation.translatedSegments.length) return
    try {
      const text = translation.translatedSegments
        .map(segment => `${formatTimestamp(segment.start)} → ${formatTimestamp(segment.end)}\n${segment.text}`)
        .join('\n\n')
      await navigator.clipboard.writeText(text)
      setCopiedTranslation(true)
    } catch (err) {
      console.error('Copy failed')
    }
  }

  const handleDownloadTranslation = () => {
    if (!translation.translatedSegments.length) return
    try {
      const content = translation.translatedSegments
        .map((segment, index) => `${index + 1}\n${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}\n${segment.text}\n\n`)
        .join('')
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `translation_${translation.targetLanguage}_${Date.now()}.srt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleNewUpload = () => {
    setSelectedFile(null)
    setSuccess(false)
    setUploadProgress(0)
    setError(null)
    setShowFullTranscription(false)
    transcription.reset()
    translation.reset()
    setCopied(false)
    setCopiedTranslation(false)
  }

  if (mobileSession.error) {
    return <MobileErrorScreen title="Session Error" message={mobileSession.error} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #000000 0%, #000000 3%, #1f2937 10%, #1e3a8a 30%, #7c3aed 50%, #6b21a8 70%, #1f2937 90%, #000000 97%, #000000 100%)'
      }}
    >
      <MobileBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
        style={{ zIndex: 10 }}
      >
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Upload to Desktop</h1>
            <p className="text-gray-400">
              CRDT Peer 🌌 • {mobileSession.isConnected ? '🟢 Connected' : '🟡 Connecting...'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {mobileSession.deviceCount} device{mobileSession.deviceCount !== 1 ? 's' : ''} in session
            </p>
          </div>

          {!selectedFile ? (
            <MobileFileUploadZone onFileSelect={handleFileSelect} error={error} />
          ) : (
            <MobileFileCard
              file={selectedFile}
              uploading={uploading}
              uploadProgress={uploadProgress}
              success={success}
              hasTaskId={!!transcription.taskId}
              onCancel={() => {
                setSelectedFile(null)
                setError(null)
                setSuccess(false)
              }}
              onUpload={handleUpload}
              onStartTranscription={handleStartTranscription}
            />
          )}

          {transcription.progress && transcription.progress.status === 'processing' && (
            <div className="mt-6 p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                  <p className="text-blue-300 font-semibold">Transcribing... (synced via CRDT)</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-blue-200">{Math.round(transcription.progress.progress)}%</p>
                  <p className="text-xs text-blue-300/60 mt-1">{transcription.progress.current_step}</p>
                </div>
              </div>
            </div>
          )}

          {transcription.result && (
            <MobileTranscriptionCard
              result={transcription.result}
              targetLanguage={translation.targetLanguage}
              availableLanguages={translation.availableLanguages}
              showTranslation={translation.showTranslation}
              isTranslating={translation.isTranslating}
              translatedSegments={translation.translatedSegments}
              copied={copied}
              copiedTranslation={copiedTranslation}
              onTargetLanguageChange={translation.setTargetLanguage}
              onCopy={handleCopy}
              onTranslate={handleTranslate}
              onDownloadTranslation={handleDownloadTranslation}
              onShowFull={() => setShowFullTranscription(true)}
              onNewUpload={handleNewUpload}
            />
          )}
        </div>
      </motion.div>

      <MobileFooter />

      <AnimatePresence>
        {showFullTranscription && transcription.result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85"
            onClick={() => setShowFullTranscription(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-2xl h-[90vh] bg-gray-900/95 border border-white/10 rounded-3xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h3 className="text-xl font-semibold text-white">Transcription</h3>
                <button onClick={() => setShowFullTranscription(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <SwipeableResultCards
                transcriptionSegments={transcription.result.segments as any}
                translatedSegments={translation.translatedSegments}
                showTranslation={translation.showTranslation}
                formatTimestamp={formatTimestamp}
                transcriptionResult={transcription.result.text}
                handleCopy={handleCopy}
                handleCopyTranslation={handleCopyTranslation}
                copied={copied}
                copiedTranslation={copiedTranslation}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MobileUpload() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const session = params.get('session')
    
    if (!session) {
      setError('Invalid upload link. Please scan the QR code again.')
      return
    }
    
    setSessionId(session)
  }, [])

  if (error || !sessionId) {
    return <MobileErrorScreen title="Invalid Link" message={error || 'No session ID found'} />
  }

  return (
    <MobileSessionProvider sessionId={sessionId} backendUrl={backendUrl}>
      <MobileUploadContent />
    </MobileSessionProvider>
  )
}