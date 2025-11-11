/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CAPTION OVERLAY COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Displays real-time transcription captions with smooth animations.
 *
 * Features:
 * - Animated caption appearance/disappearance
 * - Smooth text transitions
 * - Configurable position and styling
 * - Translation display
 * - Caption history
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Caption {
  id: string;
  text: string;
  language: string;
  timestamp: number;
  translation?: string;
  translationLanguage?: string;
}

export interface CaptionOverlayProps {
  caption: Caption | null;
  position?: 'top' | 'bottom' | 'center';
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  showTranslation?: boolean;
  backgroundColor?: string;
  textColor?: string;
  maxWidth?: string;
}

const CAPTION_LIFETIME = 3000; // ms - how long to keep captions visible (reduced for cleaner flow)

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  caption,
  position = 'bottom',
  fontSize = 'large',
  showTranslation = false,
  backgroundColor = 'rgba(0, 0, 0, 0.8)',
  textColor = '#ffffff',
  maxWidth = '80%',
}) => {
  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null);

  // Update current caption - display latest
  useEffect(() => {
    if (caption) {
      // Directly set the new caption (parent handles uniqueness)
      setCurrentCaption(caption);

      // Auto-clear after lifetime
      const timeout = setTimeout(() => {
        setCurrentCaption((curr) => {
          // Only clear if this is still the same caption
          if (curr && curr.id === caption.id) {
            return null;
          }
          return curr;
        });
      }, CAPTION_LIFETIME);

      return () => clearTimeout(timeout);
    }
  }, [caption]);

  // Position classes
  const positionClasses = {
    top: 'top-10',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-10',
  };

  // Font size classes
  const fontSizeClasses = {
    small: 'text-sm md:text-base',
    medium: 'text-base md:text-lg',
    large: 'text-lg md:text-xl lg:text-2xl',
    xlarge: 'text-xl md:text-2xl lg:text-3xl',
  };

  if (!currentCaption) {
    return null;
  }

  return (
    <div
      className={`
        fixed left-1/2 -translate-x-1/2 z-[9999]
        ${positionClasses[position]}
        pointer-events-none
      `}
      style={{ maxWidth }}
    >
      <AnimatePresence mode="wait">
        {currentCaption && (
          <motion.div
            key={currentCaption.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{
              duration: 0.25,
              ease: [0.4, 0.0, 0.2, 1] // Smooth easing curve
            }}
            className="w-full"
          >
            {/* Main Caption */}
            <div
              className={`
                px-8 py-6 rounded-2xl backdrop-blur-xl
                ${fontSizeClasses[fontSize]}
                font-bold text-center
                shadow-2xl border-4 border-white/20
              `}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.95)',
                color: textColor,
              }}
            >
              {/* Language Badge */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs opacity-70 uppercase tracking-wider">
                  {currentCaption.language}
                </span>
                <span className="text-xs opacity-50">•</span>
                <span className="text-xs opacity-70">Live</span>
              </div>

              {/* Caption Text */}
              <motion.div
                key={currentCaption.text}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {currentCaption.text}
              </motion.div>

              {/* Translation */}
              {showTranslation && currentCaption.translation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-white/20"
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-xs opacity-50 uppercase tracking-wider">
                      {currentCaption.translationLanguage || 'Translation'}
                    </span>
                  </div>
                  <div className="text-base md:text-lg opacity-90">
                    {currentCaption.translation}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
