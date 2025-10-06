/**
 * Elevated mobile footer component (fixed at bottom with safe area respect)
 * 
 * Features:
 * - Compact, fluid design for mobile with subtle animations
 * - Fixed positioning with safe-area-inset-bottom for iOS home indicator
 * - GitHub and LinkedIn links with hover/tap micro-interactions
 * - Terms and Privacy with refined typography
 * - Glassmorphism backdrop for depth
 * - Conditionally visible only when scrolled to bottom of page
 * Inspired by Apple's minimalism: light weights, smooth transitions, and environmental blend.
 */
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export const MobileFooter = () => {
  const [isVisible, setIsVisible] = useState(false)
  const ease = [0.25, 0.1, 0.25, 1] // Apple's signature easing curve

  useEffect(() => {
    const handleScroll = () => {
      const { innerHeight } = window
      const { scrollHeight } = document.body
      const scrolled = window.scrollY
      const isAtBottom = innerHeight + scrolled >= scrollHeight - 1 // Threshold for "all the way down"
      setIsVisible(isAtBottom)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const containerVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.6, ease }
    }
  }

  const linkVariants = {
    hover: { scale: 1.05, y: -1 },
    tap: { scale: 0.98, y: 0 }
  }

  if (!isVisible) return null // Don't render if not at bottom

  return (
    <motion.footer 
      role="contentinfo" 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="fixed bottom-0 left-0 right-0 z-30 px-4 backdrop-blur-[60px]"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom)', // Respects iOS home indicator – pushes content above the safe area
        paddingTop: '1rem', // Consistent internal spacing
        background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.005) 5%, rgba(0, 0, 0, 0.01) 10%, rgba(0, 0, 0, 0.015) 15%, rgba(0, 0, 0, 0.02) 20%, rgba(0, 0, 0, 0.03) 25%, rgba(0, 0, 0, 0.04) 30%, rgba(0, 0, 0, 0.06) 35%, rgba(0, 0, 0, 0.08) 40%, rgba(0, 0, 0, 0.1) 45%, rgba(0, 0, 0, 0.12) 50%, rgba(0, 0, 0, 0.15) 55%, rgba(0, 0, 0, 0.2) 60%, rgba(0, 0, 0, 0.25) 65%, rgba(0, 0, 0, 0.3) 70%, rgba(0, 0, 0, 0.35) 75%, rgba(0, 0, 0, 0.45) 80%, rgba(0, 0, 0, 0.55) 85%, rgba(0, 0, 0, 0.65) 90%, rgba(0, 0, 0, 0.75) 95%, black 100%)', // Fully transparent top edge, ultra-gradual ramp-up with doubled length (more stops, finer increments) for extended, seamless blend into video bg
        backgroundSize: '100% 200%' // Stretches the gradient vertically to double the effective fade length for smoother dissolution
      }}
    >
      <div className="space-y-3">
        {/* Social links row – centered with smooth spacing, no hard divider */}
        <div className="flex items-center justify-center gap-6">
          <motion.a
            href="https://github.com/zhadyz/ai-transcription-app"
            target="_blank"
            rel="noopener noreferrer"
            variants={linkVariants}
            whileHover="hover"
            whileTap="tap"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-300 ease-out text-xs font-light tracking-tight group"
            aria-label="Visit GitHub repository"
            style={{ letterSpacing: '-0.02em' }}
          >
            <motion.svg 
              className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              whileHover={{ rotate: 5 }}
            >
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </motion.svg>
            <span className="font-medium">GitHub</span>
          </motion.a>
          
          <motion.a
            href="https://www.linkedin.com/in/abdul-basir-bari-484750386/"
            target="_blank"
            rel="noopener noreferrer"
            variants={linkVariants}
            whileHover="hover"
            whileTap="tap"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-300 ease-out text-xs font-light tracking-tight group"
            aria-label="Visit LinkedIn profile"
            style={{ letterSpacing: '-0.02em' }}
          >
            <motion.svg 
              className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              whileHover={{ rotate: 5 }}
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </motion.svg>
            <span className="font-medium">LinkedIn</span>
          </motion.a>
        </div>
        
        {/* Copyright and legal links – justified with refined spacing */}
        <div className="flex items-center justify-between text-xs text-gray-500 font-light">
          <p className="text-xs leading-relaxed">
            © {new Date().getFullYear()} Onyxlab.
          </p>
          <div className="flex gap-4 text-xs">
            <motion.a 
              href="#" 
              variants={linkVariants}
              whileHover="hover"
              whileTap="tap"
              className="text-gray-400 hover:text-white transition-colors duration-300 ease-out"
              aria-label="View Terms of Service"
            >
              Terms
            </motion.a>
            <motion.a 
              href="#" 
              variants={linkVariants}
              whileHover="hover"
              whileTap="tap"
              className="text-gray-400 hover:text-white transition-colors duration-300 ease-out"
              aria-label="View Privacy Policy"
            >
              Privacy
            </motion.a>
          </div>
        </div>
      </div>
    </motion.footer>
  )
}