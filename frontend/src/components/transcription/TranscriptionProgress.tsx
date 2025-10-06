import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface TranscriptionProgressProps {
  progress: number
  stage: string
}

/**
 * Elevated transcription progress indicator, inspired by Apple's fluid minimalism.
 * Wider, sleeker layout with subtle depth, seamless animations, and refined typographic hierarchy.
 */
export const TranscriptionProgress = ({ progress, stage }: TranscriptionProgressProps) => {
  const ease = [0.25, 0.1, 0.25, 1] // Custom easing for Apple's signature smoothness

  const spinnerVariants = {
    idle: { rotate: 0 },
    spin: { rotate: 360, transition: { duration: 1.5, ease: 'linear', repeat: Infinity } }
  }

  const progressVariants = {
    initial: { width: 0, opacity: 0 },
    animate: { width: `${progress}%`, opacity: 1, transition: { duration: 0.8, ease } }
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease, staggerChildren: 0.1 }
    }
  }

  const childVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } }
  }

  const glowGradient = useMemo(
    () => ({
      background: `linear-gradient(135deg, 
        rgba(59, 130, 246, 0.15) 0%, 
        rgba(59, 130, 246, 0.08) 50%, 
        rgba(147, 51, 234, 0.03) 100%)`
    }),
    []
  )

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-3xl mx-auto mt-8"
    >
      <div
        className="relative bg-white/4 backdrop-blur-2xl border border-white/6 rounded-2xl p-6 overflow-hidden"
        style={{
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.04)'
        }}
      >
        {/* Subtle top glow for depth */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: 'radial-gradient(circle at top, rgba(255, 255, 255, 0.08) 0%, transparent 70%)'
          }}
        />

        <motion.div
          variants={containerVariants}
          className="space-y-8 relative z-10"
        >
          {/* Header with refined spinner and typography */}
          <motion.div
            variants={childVariants}
            className="flex items-start justify-center gap-6"
          >
            <motion.div
              variants={spinnerVariants}
              initial="idle"
              animate="spin"
              className="relative flex-shrink-0 mt-1"
            >
              <div className="w-9 h-9 border-2 border-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full opacity-75" />
              <div
                className="absolute inset-0 rounded-full border-2 border-white/15"
                style={{
                  background: 'conic-gradient(from 0deg, rgba(255,255,255,0.15), transparent 270deg)'
                }}
              />
            </motion.div>

            <div className="text-center min-w-0 flex-1">
              <motion.h3
                variants={childVariants}
                className="text-xl font-light tracking-tight text-white leading-tight mb-1 truncate"
                style={{ letterSpacing: '-0.02em' }}
              >
                {stage}
              </motion.h3>
            </div>
          </motion.div>

          {/* Elegant progress bar with shimmer */}
          <motion.div
            variants={childVariants}
            className="space-y-3"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-normal text-gray-500 tracking-wide uppercase">
                Progress
              </span>
              <motion.span
                className="text-sm font-light text-blue-400 tracking-tight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                {Math.ceil(progress)}%
              </motion.span>
            </div>

            <div className="h-1.5 bg-white/4 rounded-full overflow-hidden relative">
              <motion.div
                variants={progressVariants}
                initial="initial"
                animate="animate"
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full relative overflow-hidden"
              >
                {/* Subtle shimmer effect */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                  style={{
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s linear infinite'
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    </motion.div>
  )
}