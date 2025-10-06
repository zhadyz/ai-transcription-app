import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

/**
 * Elevated mobile background with seamless video and gradient overlay.
 * Inspired by Apple's fluid depth and subtle environmental animations.
 */
export function MobileBackground() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ease = [0.25, 0.1, 0.25, 1] // Apple's signature easing curve

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const ensurePlaying = () => {
      if (video.paused && video.readyState >= 2) {
        video.play().catch(() => {})
      }
    }

    const preventInteraction = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    video.addEventListener('pause', ensurePlaying)
    video.addEventListener('click', preventInteraction)
    video.addEventListener('touchstart', preventInteraction)
    video.addEventListener('loadeddata', () => video.play().catch(() => {}))
    
    return () => {
      video.removeEventListener('pause', ensurePlaying)
      video.removeEventListener('click', preventInteraction)
      video.removeEventListener('touchstart', preventInteraction)
    }
  }, [])

  const containerVariants = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { 
        duration: 1.2, 
        ease 
      }
    }
  }

  const overlayVariants = {
    initial: { scale: 1.02, filter: 'blur(1px)' },
    animate: { 
      scale: 1, 
      filter: 'blur(0px)',
      transition: { 
        duration: 1.5, 
        ease,
        delay: 0.3 
      }
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0, overflow: 'hidden' }}
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        className="w-full h-full object-cover"
        style={{ 
          opacity: 0.75,
          pointerEvents: 'none', 
          userSelect: 'none',
          willChange: 'transform' 
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <source src="https://storage.googleapis.com/onyxlab/Onyx.mp4" type="video/mp4" />
      </video>
      
      <motion.div
        variants={overlayVariants}
        initial="initial"
        animate="animate"
        className="absolute inset-0 pointer-events-none"
        style={{ 
            zIndex: 1,
            background: 'radial-gradient(ellipse at top, rgba(255, 255, 255, 0.02) 0%, transparent 50%), linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.5) 25%, rgba(15, 23, 42, 0.5) 35%, rgba(30, 58, 138, 0.25) 55%, rgba(124, 58, 237, 0.15) 75%, rgba(107, 33, 168, 0.25) 85%, rgba(15, 23, 42, 0.25) 92%, rgba(0, 0, 0, 0.3) 96%, rgba(0, 0, 0, 0.5) 98%, rgba(0, 0, 0, 0.7) 100%)' // Softer bottom ramp, less sharp black at edge
        }}
      />
    </motion.div>
  )
}