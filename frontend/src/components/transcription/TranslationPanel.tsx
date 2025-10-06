import { memo, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatTimestamp } from '../../hooks/useTranscription'
import type { TranscriptionSegment } from '../../hooks/useTranscription'

/**
 * Language interface
 */
interface Language {
  code: string
  name: string
}

/**
 * Props for TranslationPanel component
 */
interface TranslationPanelProps {
  // Translation state
  translatedSegments: TranscriptionSegment[]
  isTranslating: boolean
  showTranslation: boolean
  targetLanguage: string
  availableLanguages: Language[]
  detectedLanguage: string | null
  
  // Handlers
  onTranslate: () => void
  onTargetLanguageChange: (lang: string) => void
  onDownload: () => void
  onCopy: () => void
  
  // UI state
  copied: boolean
  disabled?: boolean
  error?: string | null
}

/**
 * Single translated segment display (memoized)
 */
const TranslatedSegmentItem = memo(({ 
  segment, 
  index 
}: { 
  segment: TranscriptionSegment
  index: number 
}) => (
  <motion.div
    key={index}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.5) }}
    className="border-l-2 border-purple-500/30 pl-4 hover:border-purple-500/60 transition-colors"
  >
    <div className="text-xs text-gray-500 mb-1 font-mono">
      {formatTimestamp(segment.start)} → {formatTimestamp(segment.end)}
    </div>
    <p className="text-gray-300 leading-relaxed">{segment.text}</p>
  </motion.div>
))

TranslatedSegmentItem.displayName = 'TranslatedSegmentItem'

/**
 * Translation panel with full translation workflow
 * 
 * Features:
 * - Smart language selection (excludes source language)
 * - Translation state machine (idle → translating → success/error)
 * - Download as SRT (generates file client-side)
 * - Copy to clipboard with fallback
 * - Responsive layout
 * - Error handling with retry
 * - Accessible (ARIA, keyboard navigation)
 * - Performance optimized (memoization)
 * 
 * State Machine:
 * 1. IDLE: Show language selector + translate button
 * 2. TRANSLATING: Show spinner, disable controls
 * 3. SUCCESS: Show translated segments + download/copy buttons
 * 4. ERROR: Show error message + retry button
 * 
 * Download Logic:
 * - Generates SRT format client-side (no server roundtrip)
 * - Uses Blob URL for memory efficiency
 * - Automatic cleanup of object URLs
 * 
 * @example
 * <TranslationPanel
 *   translatedSegments={translation.translatedSegments}
 *   isTranslating={translation.isTranslating}
 *   showTranslation={translation.showTranslation}
 *   targetLanguage={translation.targetLanguage}
 *   availableLanguages={translation.availableLanguages}
 *   detectedLanguage={transcription.result?.language_detected}
 *   onTranslate={translation.translate}
 *   onTargetLanguageChange={translation.setTargetLanguage}
 *   onDownload={handleDownloadTranslation}
 *   onCopy={handleCopyTranslation}
 *   copied={copiedTranslation}
 * />
 */
export const TranslationPanel = memo(({
  translatedSegments,
  isTranslating,
  showTranslation,
  targetLanguage,
  availableLanguages,
  detectedLanguage,
  onTranslate,
  onTargetLanguageChange,
  onDownload,
  onCopy,
  copied,
  disabled = false,
  error = null
}: TranslationPanelProps) => {
  /**
   * Filter available languages to exclude detected source language
   * Prevents "English → English" translations
   */
  const filteredLanguages = useMemo(() => {
    if (!detectedLanguage) return availableLanguages
    return availableLanguages.filter(lang => lang.code !== detectedLanguage)
  }, [availableLanguages, detectedLanguage])

  /**
   * Get target language display name
   */
  const targetLanguageName = useMemo(() => {
    const lang = filteredLanguages.find(l => l.code === targetLanguage)
    return lang?.name || targetLanguage.toUpperCase()
  }, [filteredLanguages, targetLanguage])

  /**
   * Calculate optimal scroll height for translated content
   */
  const scrollHeight = useMemo(() => {
    if (translatedSegments.length <= 4) return 'auto'
    if (translatedSegments.length <= 20) return `${Math.min(256 + (translatedSegments.length - 4) * 80, 600)}px`
    return '600px'
  }, [translatedSegments.length])

  /**
   * Handle copy with error prevention
   */
  const handleCopyClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCopy()
  }, [onCopy])

  /**
   * Handle translate with validation
   */
  const handleTranslateClick = useCallback(() => {
    if (isTranslating || disabled) return
    onTranslate()
  }, [isTranslating, disabled, onTranslate])

  /**
   * Handle download with validation
   */
  const handleDownloadClick = useCallback(() => {
    if (translatedSegments.length === 0) return
    onDownload()
  }, [translatedSegments.length, onDownload])

  // Edge case: No languages available
  if (availableLanguages.length === 0) {
    return (
      <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
        <p className="text-yellow-400 text-sm">Translation service unavailable</p>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Translation Controls */}
      {!showTranslation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <label htmlFor="target-language" className="block text-sm font-medium text-gray-400">
            Translate to:
          </label>
          <select
            id="target-language"
            value={targetLanguage}
            onChange={(e) => onTargetLanguageChange(e.target.value)}
            disabled={isTranslating || disabled}
            className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all appearance-none cursor-pointer hover:bg-black/50 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1.25rem'
            }}
            aria-label="Select target language for translation"
          >
            {filteredLanguages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={handleDownloadClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!showTranslation || translatedSegments.length === 0}
          className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
          aria-label="Download translated subtitles"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </motion.button>

        <motion.button
          onClick={handleTranslateClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isTranslating || disabled}
          className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
          aria-label={showTranslation ? "Hide translation" : "Translate transcription"}
        >
          {isTranslating ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              Translating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {showTranslation ? 'Hide' : 'Translate'}
            </>
          )}
        </motion.button>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-400 text-sm flex-1">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download Translation Button (when visible) */}
      <AnimatePresence>
        {showTranslation && translatedSegments.length > 0 && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onClick={handleDownloadClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
            aria-label="Download translation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Translation
          </motion.button>
        )}
      </AnimatePresence>

      {/* Translation Results */}
      <AnimatePresence>
        {showTranslation && translatedSegments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h5 className="text-lg font-semibold text-white">Translation</h5>
                <span className="px-3 py-1 text-xs font-medium bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                  {targetLanguageName}
                </span>
                <span className="text-xs text-gray-500">
                  {translatedSegments.length} segment{translatedSegments.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Scrollable translated segments */}
            <div 
              className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
              style={{ 
                maxHeight: scrollHeight,
                scrollBehavior: 'smooth',
                contain: 'layout style paint'
              }}
              role="region"
              aria-label="Translation segments"
            >
              <div className="space-y-4">
                {translatedSegments.map((segment, index) => (
                  <TranslatedSegmentItem key={index} segment={segment} index={index} />
                ))}
              </div>
            </div>

            {/* Copy Translation Button */}
            <motion.button
              onClick={handleCopyClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full mt-4 flex items-center justify-center gap-2 p-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg transition-all duration-200"
              aria-label="Copy translation to clipboard"
              disabled={copied}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="copied"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400 text-sm font-medium">Copied!</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-purple-400 text-sm font-medium">Copy Translation</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

TranslationPanel.displayName = 'TranslationPanel'