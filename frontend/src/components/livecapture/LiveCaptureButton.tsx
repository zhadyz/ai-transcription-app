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

  // State-based styling
  const stateStyles = {
    inactive: {
      bg: 'bg-gray-600 hover:bg-gray-500',
      text: 'text-gray-100',
      icon: '🎙️',
      label: 'Live Capture',
    },
    connecting: {
      bg: 'bg-yellow-500',
      text: 'text-yellow-900',
      icon: '⏳',
      label: 'Connecting...',
    },
    active: {
      bg: 'bg-red-500 hover:bg-red-600',
      text: 'text-white',
      icon: '🔴',
      label: 'Live',
    },
    error: {
      bg: 'bg-red-700',
      text: 'text-white',
      icon: '⚠️',
      label: 'Error',
    },
  };

  const currentStyle = stateStyles[state];

  return (
    <div className="relative inline-block">
      {/* Main Button */}
      <motion.button
        onClick={onToggle}
        disabled={disabled}
        className={`
          relative px-6 py-3 rounded-lg font-bold text-sm
          transition-all duration-200 ease-in-out
          flex items-center gap-3
          ${currentStyle.bg} ${currentStyle.text}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          shadow-lg
        `}
        whileHover={disabled ? {} : { scale: 1.05 }}
        whileTap={disabled ? {} : { scale: 0.95 }}
      >
        {/* Icon */}
        <motion.span
          className="text-xl"
          animate={
            state === 'active'
              ? {
                  scale: [1, 1.2, 1],
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
          {currentStyle.icon}
        </motion.span>

        {/* Label */}
        <span>{currentStyle.label}</span>

        {/* Volume Indicator */}
        {state === 'active' && (
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-1 bg-white rounded-full"
                style={{
                  height: `${8 + i * 2}px`,
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
            className="absolute inset-0 rounded-lg bg-red-400"
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{
              opacity: [0.5, 0],
              scale: [1, 1.2],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: 'easeOut',
            }}
            style={{ pointerEvents: 'none' }}
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
