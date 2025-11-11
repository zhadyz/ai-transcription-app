import { motion, AnimatePresence } from 'framer-motion'
import { TranscriptionResult } from '@/hooks/useTranscription'

export interface MobileTranscriptionCardProps {
  result: TranscriptionResult
  targetLanguage: string
  availableLanguages: Array<{ code: string; name: string }>
  showTranslation: boolean
  isTranslating: boolean
  translatedSegments: any[]
  copied: boolean
  copiedTranslation: boolean
  onTargetLanguageChange: (lang: string) => void
  onCopy: () => void
  onTranslate: () => void
  onDownloadTranslation: () => void
  onShowFull: () => void
  onNewUpload: () => void
}

export function MobileTranscriptionCard({
  result,
  targetLanguage,
  availableLanguages,
  showTranslation,
  isTranslating,
  translatedSegments,
  copied,
  copiedTranslation,
  onTargetLanguageChange,
  onCopy,
  onTranslate,
  onDownloadTranslation,
  onShowFull,
  onNewUpload
}: MobileTranscriptionCardProps) {
  const ease = [0.25, 0.1, 0.25, 1] // Apple's signature easing

  const containerVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.6, ease }
    }
  }

  const childVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } }
  }

  const buttonVariants = {
    hover: { scale: 1.02, y: -1 },
    tap: { scale: 0.98, y: 0 }
  }

  const segmentVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: (i: number) => ({ 
      opacity: 1, 
      x: 0,
      transition: { 
        duration: 0.3, 
        ease,
        delay: i * 0.1 
      }
    })
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mt-6 space-y-5 mb-12" // Reduced bottom margin to mb-12 (~3rem) for less padding at bottom while keeping top as-is; airy space past card via this margin
    >
      <motion.h3
        variants={childVariants}
        className="text-lg font-light tracking-tight text-white leading-tight"
        style={{ letterSpacing: '-0.025em' }}
      >
        Complete! ✨ (CRDT synced)
      </motion.h3>

      <AnimatePresence mode="wait">
        {!showTranslation && availableLanguages.length > 0 && (
          <motion.select
            key="language-select"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            value={targetLanguage}
            onChange={(e) => onTargetLanguageChange(e.target.value)}
            className="w-full bg-white/5 backdrop-blur-xl border border-white/10 text-white rounded-2xl px-4 py-3 text-sm font-light appearance-none bg-no-repeat bg-right pr-10"
            style={{ 
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23A1A1AA\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1.25em 1.25em'
            }}
          >
            {availableLanguages
              .filter(lang => lang.code !== result.language_detected)
              .map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
          </motion.select>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        <motion.button 
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={onCopy}
          className="px-4 py-3 bg-gradient-to-r from-blue-600/90 to-blue-500/90 text-white rounded-2xl font-light text-sm shadow-lg shadow-black/30 hover:shadow-lg/50 transition-shadow duration-300" // Extended bleed: Reduced opacity for softer, longer gradient fade; stronger dark shadow
          style={{ boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)' }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </motion.button>

        <motion.button 
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={onTranslate} 
          disabled={isTranslating}
          className="px-4 py-3 bg-gradient-to-r from-purple-600/90 to-purple-500/90 text-white rounded-2xl font-light text-sm shadow-lg shadow-black/30 hover:shadow-lg/50 disabled:opacity-50 disabled:shadow-none transition-all duration-300 relative overflow-hidden" // Extended bleed: Reduced opacity for softer, longer gradient fade; stronger dark shadow
          style={{ boxShadow: '0 4px 14px 0 rgba(147, 51, 234, 0.4)' }}
        >
          {isTranslating ? 'Translating...' : showTranslation ? 'Hide' : 'Translate'}
        </motion.button>
      </div>

      <AnimatePresence>
        {showTranslation && translatedSegments.length > 0 && (
          <motion.button 
            key="download"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={onDownloadTranslation} 
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600/90 to-purple-500/90 text-white rounded-2xl font-light text-sm shadow-lg shadow-black/30 hover:shadow-lg/50 transition-all duration-300" // Extended bleed: Reduced opacity for softer, longer gradient fade; stronger dark shadow
            style={{ boxShadow: '0 4px 14px 0 rgba(147, 51, 234, 0.4)' }}
          >
            Download Translation
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div 
        variants={childVariants}
        onClick={onShowFull} 
        className="p-5 bg-gradient-to-b from-white/3 via-black/10 to-black/20 backdrop-blur-xl rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-colors duration-300 overflow-hidden" // Extended gradient bleed: Vertical gradient from light to stronger dark for deeper immersion; stronger bottom dark
        style={{ boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)' }} // Slightly stronger shadow for enhanced depth
      >
        <div className="space-y-3">
          <AnimatePresence>
            {result.segments.slice(0, 3).map((seg, i) => (
              <motion.p 
                key={i}
                variants={segmentVariants}
                initial="hidden"
                animate="visible"
                custom={i}
                className="text-gray-200 text-sm leading-relaxed"
              >
                {seg.text}
              </motion.p>
            ))}
          </AnimatePresence>
          {result.segments.length > 3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="text-gray-500 text-xs font-light tracking-wide"
            >
              Tap to view all...
            </motion.p>
          )}
        </div>
      </motion.div>

      <motion.button 
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
        onClick={onNewUpload} 
        className="w-full px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 text-white rounded-2xl font-light text-sm hover:bg-white/10 transition-colors duration-300"
        style={{ boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.15)' }} // Slightly stronger shadow for enhanced depth
      >
        Upload Another File
      </motion.button>

      {/* Empty spacer div for additional airy verticality past the card – can be adjusted or moved to parent if needed */}
      <div className="h-0" /> {/* ~1rem extra space; stack more if you want fuller extension in parent file */}
    </motion.div>
  )
}