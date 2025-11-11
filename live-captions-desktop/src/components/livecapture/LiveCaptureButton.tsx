/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIVE CAPTURE BUTTON COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toggle button for starting/stopping real-time transcription.
 *
 * Features:
 * - Animated toggle states (OFF → ON → ACTIVE)
 * - Visual feedback (color, icon, pulse animation)
 * - Volume indicator
 * - Error states
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LiveCaptureButtonProps {
  isActive: boolean;
  isConnected: boolean;
  volume?: number; // 0-1 range
  onToggle: () => void;
  disabled?: boolean;
  error?: string | null;
}

export const LiveCaptureButton: React.FC<LiveCaptureButtonProps> = ({
  isActive,
  isConnected,
  volume = 0,
  onToggle,
  disabled = false,
  error = null,
}) => {
  // Determine button state
  const getButtonState = () => {
    if (error) return 'error';
    if (isActive && isConnected) return 'active';
    if (isActive) return 'connecting';
    return 'inactive';
  };

  const state = getButtonState();

  // State-based styling - STYGIAN theme
  const stateStyles = {
    inactive: {
      background: 'linear-gradient(135deg, rgba(30, 27, 12, 0.95) 0%, rgba(40, 35, 15, 1.0) 50%, rgba(35, 30, 13, 0.95) 100%)',
      borderColor: 'rgba(255, 200, 50, 0.3)',
      textColor: '#e89a2f',
      label: 'Live Capture',
      shadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
    },
    connecting: {
      background: 'linear-gradient(135deg, rgba(50, 45, 20, 0.95) 0%, rgba(60, 55, 25, 1.0) 50%, rgba(55, 47, 22, 0.95) 100%)',
      borderColor: 'rgba(255, 200, 50, 0.5)',
      textColor: '#ffc832',
      label: 'Connecting...',
      shadow: '0 4px 20px rgba(255, 200, 50, 0.3)',
    },
    active: {
      background: 'linear-gradient(135deg, rgba(40, 20, 15, 0.98) 0%, rgba(60, 30, 20, 1.0) 50%, rgba(45, 22, 17, 0.98) 100%)',
      borderColor: 'rgba(255, 100, 50, 0.6)',
      textColor: '#ff9966',
      label: 'STOP',
      shadow: '0 4px 25px rgba(255, 100, 50, 0.5)',
    },
    error: {
      background: 'linear-gradient(135deg, rgba(50, 20, 20, 0.95) 0%, rgba(70, 25, 25, 1.0) 50%, rgba(55, 22, 22, 0.95) 100%)',
      borderColor: 'rgba(255, 80, 80, 0.5)',
      textColor: '#ff6666',
      label: 'Error',
      shadow: '0 4px 20px rgba(255, 80, 80, 0.4)',
    },
  };

  const currentStyle = stateStyles[state];

  // Icon components
  const renderIcon = () => {
    switch (state) {
      case 'inactive':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        );
      case 'connecting':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'active':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h12v16H6z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  return (
    <div className="relative inline-block">
      {/* Main Button */}
      <motion.button
        onClick={onToggle}
        disabled={disabled}
        style={{
          background: currentStyle.background,
          borderColor: currentStyle.borderColor,
          color: currentStyle.textColor,
          boxShadow: currentStyle.shadow,
        }}
        className={`
          relative px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider
          transition-all duration-200 ease-in-out
          flex items-center gap-3 border-2 backdrop-blur-md
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}
        `}
        whileHover={disabled ? {} : { scale: 1.05 }}
        whileTap={disabled ? {} : { scale: 0.95 }}
      >
        {/* Icon */}
        <motion.div
          animate={
            state === 'active'
              ? {
                  scale: [1, 1.1, 1],
                  transition: { repeat: Infinity, duration: 1.5 },
                }
              : state === 'connecting'
              ? {
                  rotate: [0, 360],
                  transition: { repeat: Infinity, duration: 2, ease: 'linear' },
                }
              : {}
          }
        >
          {renderIcon()}
        </motion.div>

        {/* Label */}
        <span>{currentStyle.label}</span>

        {/* Volume Indicator */}
        {state === 'active' && (
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full"
                style={{
                  height: `${8 + i * 2}px`,
                  backgroundColor: '#ff9966',
                  opacity: volume * 5 > i ? 1 : 0.3,
                }}
                animate={{
                  opacity: volume * 5 > i ? [0.5, 1, 0.5] : 0.3,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.8,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        )}

        {/* Pulse Animation (Active State) */}
        {state === 'active' && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            initial={{ opacity: 0.3, scale: 1 }}
            animate={{
              opacity: [0.3, 0],
              scale: [1, 1.15],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: 'easeOut',
            }}
            style={{
              pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(255, 100, 50, 0.4) 0%, transparent 70%)'
            }}
          />
        )}
      </motion.button>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 left-0 right-0 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs whitespace-nowrap"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Status Indicator */}
      {isActive && (
        <div className="absolute -top-1 -right-1">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-400' : 'bg-yellow-400'
            } border-2 border-white`}
          />
        </div>
      )}
    </div>
  );
};
