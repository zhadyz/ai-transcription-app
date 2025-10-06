import { memo, useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatTimestamp } from '../../hooks/useTranscription'
import type { TranscriptionSegment } from '../../hooks/useTranscription'

/**
 * Props for TranscriptionResult component
 */
interface TranscriptionResultProps {
  segments: TranscriptionSegment[]
  detectedLanguage: string | null
  onCopy: () => void
  copied: boolean
  maxHeight?: string
  className?: string
}

/**
 * Single segment display component (memoized for performance)
 */
const SegmentItem = memo(({ 
  segment, 
  index 
}: { 
  segment: TranscriptionSegment
  index: number 
}) => {
  const ease = [0.25, 0.1, 0.25, 1]

  const itemVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.4, 
        ease,
        delay: Math.min(index * 0.05, 0.6)
      }
    }
  }

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="border-l-2 border-blue-500/30 pl-4 hover:border-blue-500/60 transition-colors duration-300 ease-out"
    >
      <div className="text-xs text-gray-500 mb-1 font-mono">
        {formatTimestamp(segment.start)} → {formatTimestamp(segment.end)}
      </div>
      <p className="text-gray-300 leading-relaxed">{segment.text}</p>
    </motion.div>
  )
})

SegmentItem.displayName = 'SegmentItem'

/**
 * Transcription result display with virtual scrolling support
 */
export const TranscriptionResult = memo(({
  segments,
  detectedLanguage,
  onCopy,
  copied,
  maxHeight = '600px',
  className = ''
}: TranscriptionResultProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const ease = [0.25, 0.1, 0.25, 1]

  // DEBUG CHECK
  console.log('🔍 [TranscriptionResult] Received segments:', {
    segments,
    isArray: Array.isArray(segments),
    length: segments?.length,
    type: typeof segments
  })

  // SAFETY CHECK
  const safeSegments = useMemo(() => {
    if (!segments) {
      console.warn('⚠️ [TranscriptionResult] segments is null/undefined')
      return []
    }
    if (!Array.isArray(segments)) {
      console.error('❌ [TranscriptionResult] segments is NOT an array:', segments)
      return []
    }
    return segments
  }, [segments])

  /**
   * Calculate optimal scroll height based on segment count
   */
  const scrollHeight = useMemo(() => {
    if (safeSegments.length <= 4) return 'auto'
    if (safeSegments.length <= 20) return `${Math.min(256 + (safeSegments.length - 4) * 80, parseInt(maxHeight))}px`
    return maxHeight
  }, [safeSegments.length, maxHeight])

  /**
   * Handle copy with error handling
   */
  const handleCopyClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCopy()
  }, [onCopy])

  /**
   * Memoize language display name
   */
  const languageDisplay = useMemo(() => {
    if (!detectedLanguage) return null
    
    const languageNames: Record<string, string> = {
      'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
      'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic',
      'hi': 'Hindi', 'pt': 'Portuguese', 'ru': 'Russian', 'bn': 'Bengali'
    }
    
    return languageNames[detectedLanguage] || detectedLanguage.toUpperCase()
  }, [detectedLanguage])

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        duration: 0.5, 
        ease 
      }
    }
  }

  const listVariants = {
    hidden: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
    visible: { transition: { staggerChildren: 0.05, staggerDirection: 1 } }
  }

  const buttonVariants = {
    hover: { scale: 1.02, transition: { duration: 0.15, ease } },
    tap: { scale: 0.98, transition: { duration: 0.1, ease } }
  }

  const iconVariants = {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0, transition: { duration: 0.2, ease } },
    exit: { scale: 0, rotate: 180, transition: { duration: 0.15, ease } }
  }

  // Edge case: No segments
  if (!safeSegments || safeSegments.length === 0) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={className}
      >
        <div className="text-center py-8">
          <p className="text-gray-400">No transcription segments available</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h5 className="text-lg font-semibold text-white">Transcription</h5>
          {detectedLanguage && (
            <motion.span 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.3, ease }}
              className="px-3 py-1 text-xs font-medium bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30"
            >
              {languageDisplay}
            </motion.span>
          )}
          {safeSegments.length > 0 && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3, ease }}
              className="text-xs text-gray-500"
            >
              {safeSegments.length} segment{safeSegments.length !== 1 ? 's' : ''}
            </motion.span>
          )}
        </div>
      </div>

      {/* Scrollable segment container */}
      <motion.div 
        variants={listVariants}
        initial="hidden"
        animate="visible"
        className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
        style={{ 
          maxHeight: scrollHeight,
          scrollBehavior: 'smooth',
          contain: 'layout style paint'
        }}
        role="region"
        aria-label="Transcription segments"
      >
        <div className="space-y-4">
          {safeSegments.map((segment, index) => (
            <SegmentItem key={index} segment={segment} index={index} />
          ))}
        </div>
      </motion.div>

      {/* Copy button */}
      <motion.button
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
        onClick={handleCopyClick}
        className="w-full mt-4 flex items-center justify-center gap-2 p-3 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors duration-200"
        aria-label="Copy transcription to clipboard"
        disabled={copied}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="copied"
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
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
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-blue-400 text-sm font-medium">Copy Transcription</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  )
})

TranscriptionResult.displayName = 'TranscriptionResult'