/**
 * Desktop upload - thin orchestration of enlightened primitives
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useTranscription, formatTimestamp } from '@/hooks/useTranscription'
import { useTranslation } from '@/hooks/useTranslation'
import { useSessionContext } from '@/core/SessionContext'  // ← ADD THIS
import { FileUploadZone } from '@/components/transcription/FileUploadZone'
import { TranscriptionSettings } from '@/components/transcription/TranscriptionSettings'
import { TranscriptionProgress } from '@/components/transcription/TranscriptionProgress'
import { TranscriptionResult } from '@/components/transcription/TranscriptionResult'
import { TranslationPanel } from '@/components/transcription/TranslationPanel'
import { Footer } from '@/components/layout/Footer'
import QRCodeDisplay from './QRCodeDisplay'
import { filter } from 'rxjs/operators'
import { BACKEND_URL } from '@/config/backend'

const hostname = window.location.hostname
const backendUrl = BACKEND_URL()

export default function FileUpload() {
  // ✅ CHANGE: Get session from context instead of hook
  const session = useSessionContext()
  
  const fileUpload = useFileUpload()
  const transcription = useTranscription({  // ← No longer needs sessionId option
    pollingInterval: 1000
  })
  const translation = useTranslation(backendUrl)

  const [language, setLanguage] = useState('auto')
  const [quality, setQuality] = useState('small')
  const [format, setFormat] = useState('srt')
  const [copiedOriginal, setCopiedOriginal] = useState(false)
  const [copiedTranslation, setCopiedTranslation] = useState(false)

  const isCompleted = transcription.progress?.status === 'completed'

  // Debug logs
  useEffect(() => {
    console.group('🔍 Desktop State Debug')
    console.log('session.sessionId:', session.sessionId)
    console.log('session.session:', session.session)
    console.log('transcription.taskId:', transcription.taskId)
    console.log('transcription.result:', transcription.result)
    console.log('transcription.progress:', transcription.progress)
    console.groupEnd()
  }, [session.sessionId, transcription.taskId, transcription.result])

  useEffect(() => {
    if (transcription.result) {
      console.group('🔍 [FileUpload] Transcription result changed')
      console.log('Full result:', transcription.result)
      console.log('Segments:', transcription.result.segments)
      console.log('Segments is array:', Array.isArray(transcription.result.segments))
      console.log('Segments length:', transcription.result.segments?.length)
      console.groupEnd()
    }
  }, [transcription.result])

  useEffect(() => {
    if (translation.translatedSegments) {
      console.group('🔍 [FileUpload] Translation segments changed')
      console.log('Segments:', translation.translatedSegments)
      console.log('Is array:', Array.isArray(translation.translatedSegments))
      console.log('Length:', translation.translatedSegments?.length)
      console.groupEnd()
    }
  }, [translation.translatedSegments])

  useEffect(() => {
    if (copiedOriginal) {
      const t = setTimeout(() => setCopiedOriginal(false), 2000)
      return () => clearTimeout(t)
    }
  }, [copiedOriginal])

  useEffect(() => {
    if (copiedTranslation) {
      const t = setTimeout(() => setCopiedTranslation(false), 2000)
      return () => clearTimeout(t)
    }
  }, [copiedTranslation])




  // INFINITE LOOP FIX
/*
  useEffect(() => {
    if (isCompleted && transcription.result) {
      const t = setTimeout(() => session.refreshSession(), 2000)
      return () => clearTimeout(t)
    }
  }, [isCompleted, transcription.result, session])
  */



  // ✅ ADD: Subscribe to file upload events via CRDT
  useEffect(() => {
    if (!session.session) return

    const fileUploadSub = session.session.observe(doc => doc.file).subscribe(file => {
      if (file && file.type === 'remote') {
        console.log('📥 [FileUpload] File uploaded via mobile:', file.metadata.filename)
        
        // Create a fake File object for UI
        const fakeFile = new File([new Uint8Array(0)], file.metadata.filename, {
          type: file.metadata.mimeType
        })

        Object.defineProperties(fakeFile, {
          size: { value: file.metadata.size, writable: false },
          serverPath: { value: file.path, writable: false }
        })

        fileUpload.setSelectedFile(fakeFile)
      }
    })

    return () => {
      fileUploadSub.unsubscribe()
    }
  }, [session.session, fileUpload])

  const handleMobileUpload = useCallback((fileInfo: any) => {
    console.group('📥 handleMobileUpload CALLED')
    console.log('Full fileInfo:', fileInfo)
    console.log('Type:', fileInfo.type)
    console.log('Task ID:', fileInfo.task_id)
    console.log('Session exists?', !!session.session)
    console.groupEnd()

    if (fileInfo.type === 'transcription_started') {
      console.log('🚀 Mobile started transcription!')
      
      // Set task ID so desktop starts polling
      transcription.setTaskId(fileInfo.task_id)
      
      // Create fake file object for UI
      const file = new File([new Uint8Array(0)], fileInfo.filename || 'mobile-upload', {
        type: fileInfo.mimeType || 'application/octet-stream'
      })

      Object.defineProperties(file, {
        size: { value: fileInfo.size || 0, writable: false },
        serverPath: { value: fileInfo.path, writable: false },
        sessionId: { value: fileInfo.sessionId, writable: false }
      })

      fileUpload.setSelectedFile(file)
      
      // Subscribe to CRDT updates
      if (session.session) {
        session.session.observe(doc => doc.transcription).pipe(
          filter(t => t.taskId === fileInfo.task_id)
        ).subscribe(transcriptionState => {
          console.log('📥 Desktop received CRDT update:', transcriptionState)
          // CRDT updates happen automatically through useTranscription
        })
      }

      return
    }

    if (fileInfo.type === 'file_uploaded') {
      console.log('📄 Mobile uploaded file')
      
      const file = new File([new Uint8Array(0)], fileInfo.filename, {
        type: fileInfo.mimeType || 'application/octet-stream'
      })

      Object.defineProperties(file, {
        size: { value: fileInfo.size, writable: false },
        serverPath: { value: fileInfo.path, writable: false },
        sessionId: { value: fileInfo.sessionId, writable: false }
      })

      fileUpload.setSelectedFile(file)
    }
  }, [session, fileUpload, transcription])

  const handleStartTranscription = useCallback(async () => {
    if (!fileUpload.selectedFile) return
    
    console.log('🚨 BEFORE startTranscription call')
    console.log('transcription.result:', transcription.result)
    console.log('transcription.result?.segments:', transcription.result?.segments)
    console.log('translation.translatedSegments:', translation.translatedSegments)

    await transcription.startTranscription(fileUpload.selectedFile, {
      language,
      quality: quality as any,
      export_format: format as any
    })
  }, [fileUpload.selectedFile, language, quality, format, transcription, translation.translatedSegments])

  const handleNewUpload = useCallback(() => {
    fileUpload.reset()
    transcription.reset()
    translation.reset()
    setCopiedOriginal(false)
    setCopiedTranslation(false)
    setLanguage('auto')
    setQuality('small')
    setFormat('srt')
    session.refreshSession()
  }, [fileUpload, transcription, translation, session])

  const handleDownload = useCallback(() => {
    if (transcription.taskId) {
      window.open(`${backendUrl}/transcribe/${transcription.taskId}/download`, '_blank')
    }
  }, [transcription.taskId])

  const handleDownloadTranslation = useCallback(() => {
    if (!translation.translatedSegments.length) return

    const content = translation.translatedSegments
      .map((seg, i) => 
        `${i + 1}\n${formatTimestamp(seg.start)} --> ${formatTimestamp(seg.end)}\n${seg.text}\n\n`
      )
      .join('')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `translation_${translation.targetLanguage}_${Date.now()}.srt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [translation.translatedSegments, translation.targetLanguage])

  const handleCopyOriginal = useCallback(async () => {
    if (!transcription.result?.segments) return

    const text = transcription.result.segments
      .map(s => `${formatTimestamp(s.start)} → ${formatTimestamp(s.end)}\n${s.text}`)
      .join('\n\n')

    await navigator.clipboard.writeText(text)
    setCopiedOriginal(true)
  }, [transcription.result])

  const handleCopyTranslation = useCallback(async () => {
    if (!translation.translatedSegments.length) return

    const text = translation.translatedSegments
      .map(s => `${formatTimestamp(s.start)} → ${formatTimestamp(s.end)}\n${s.text}`)
      .join('\n\n')

    await navigator.clipboard.writeText(text)
    setCopiedTranslation(true)
  }, [translation.translatedSegments])

  const handleTranslate = useCallback(async () => {
    if (translation.showTranslation) {
      translation.setShowTranslation(false)
      return
    }

    if (!transcription.result?.language_detected || !transcription.result?.segments.length) {
      return
    }

    await translation.translate(
      transcription.result.segments,
      transcription.result.language_detected,
      translation.targetLanguage
    )
  }, [translation, transcription.result])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-6xl mx-auto px-6 pb-16 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {isCompleted ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{fileUpload.selectedFile?.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {fileUpload.selectedFile ? (fileUpload.selectedFile.size / 1024 / 1024).toFixed(2) : '0'} MB
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 flex items-center justify-center cursor-pointer transition-all duration-300 hover:border-white/20 hover:bg-white/8"
                onClick={handleNewUpload}
                role="button"
                tabIndex={0}
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Upload New File</h3>
                  <p className="text-sm text-gray-400 mt-1">Click or drag to upload</p>
                </div>
              </motion.div>
            </div>
          ) : (
            <FileUploadZone
              selectedFile={fileUpload.selectedFile}
              onFileSelect={fileUpload.handleFileSelect}
              onRemoveFile={() => {
                fileUpload.setSelectedFile(null)
                transcription.reset()
              }}
              disabled={transcription.isUploading || !!transcription.taskId}
            />
          )}

          <AnimatePresence>
            {fileUpload.selectedFile && (
              <motion.div
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-6"
              >
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8">
                  <TranscriptionSettings
                    language={language}
                    quality={quality}
                    format={format}
                    onLanguageChange={setLanguage}
                    onQualityChange={setQuality}
                    onFormatChange={setFormat}
                    disabled={isCompleted}
                  />

                  {!isCompleted && (
                    <button
                      onClick={handleStartTranscription}
                      disabled={transcription.isUploading || !!transcription.taskId}
                      className="w-full mt-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25"
                    >
                      {transcription.isUploading ? 'Uploading...' : transcription.taskId ? 'Processing...' : 'Start Transcription'}
                    </button>
                  )}

                  {(fileUpload.error || transcription.error) && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-sm">{fileUpload.error || transcription.error}</p>
                    </div>
                  )}

                  {transcription.progress && !isCompleted && (
                    <TranscriptionProgress
                      progress={transcription.progress.progress || 0}
                      stage={transcription.progress.current_step || 'Processing...'}
                    />
                  )}

                  {isCompleted && transcription.result && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.4 }}
                        className="mb-6 mt-6"
                      >
                        <TranscriptionResult
                          segments={transcription.result.segments}
                          detectedLanguage={transcription.result.language_detected}
                          onCopy={handleCopyOriginal}
                          copied={copiedOriginal}
                        />
                      </motion.div>

                      <TranslationPanel
                        translatedSegments={translation.translatedSegments}
                        isTranslating={translation.isTranslating}
                        showTranslation={translation.showTranslation}
                        targetLanguage={translation.targetLanguage}
                        availableLanguages={translation.availableLanguages}
                        detectedLanguage={transcription.result.language_detected}
                        onTranslate={handleTranslate}
                        onTargetLanguageChange={translation.setTargetLanguage}
                        onDownload={handleDownloadTranslation}
                        onCopy={handleCopyTranslation}
                        copied={copiedTranslation}
                        error={translation.error}
                      />

                      <div className="mt-6">
                        <button
                          onClick={handleDownload}
                          className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold py-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Original
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!fileUpload.selectedFile && !transcription.progress && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <QRCodeDisplay 
                sessionId={session.sessionId}
                qrUrl={session.qrUrl}
                isConnected={session.isConnected}
                onFileReceived={handleMobileUpload}
                expiresAt={session.expiresAt || undefined}
                onRefresh={session.refreshSession}
              />
            </motion.div>
          )}
        </motion.div>
      </div>
      <Footer />
    </div>
  )
}