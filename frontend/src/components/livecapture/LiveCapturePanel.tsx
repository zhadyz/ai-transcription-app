/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIVE CAPTURE PANEL - ELEGANT REDESIGN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sleek, embedded control panel for live transcription
 * - Glass morphism design with smooth animations
 * - Integrated settings with elegant transitions
 * - Professional, minimal appearance
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveCapture } from '../../contexts/LiveCaptureContext';
import { LiveCaptureButton } from './LiveCaptureButton';
import { CaptionOverlay } from './CaptionOverlay';

export const LiveCapturePanel: React.FC = () => {
  const {
    isActive,
    isConnected,
    volume,
    currentCaption,
    error,
    settings,
    start,
    stop,
    updateSettings,
    isSupported,
  } = useLiveCapture();

  const [showSettings, setShowSettings] = useState(false);

  const handleToggle = async () => {
    if (isActive) {
      stop();
    } else {
      await start();
    }
  };

  if (!isSupported) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="backdrop-blur-md bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-4 shadow-xl"
      >
        <p className="font-semibold text-yellow-300 flex items-center gap-2">
          <span>⚠️</span> Live Capture Not Supported
        </p>
        <p className="text-sm mt-1 text-yellow-400/80">
          Your browser doesn't support audio capture. Please use Chrome, Firefox, or Edge.
        </p>
      </motion.div>
    );
  }

  return (
    <>
      {/* Elegant Control Panel - Top Right Corner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-6 right-6 z-50"
      >
        <motion.div
          className={`
            backdrop-blur-xl bg-gradient-to-br from-gray-900/80 to-black/80
            rounded-2xl border transition-all duration-300 shadow-2xl
            ${isActive
              ? 'border-blue-500/40 shadow-blue-500/20'
              : 'border-white/10 shadow-black/50'
            }
          `}
          animate={{
            boxShadow: isActive
              ? '0 25px 50px -12px rgba(59, 130, 246, 0.25)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Main Button Row */}
          <div className="flex items-center gap-3 p-3">
            <LiveCaptureButton
              isActive={isActive}
              isConnected={isConnected}
              volume={volume}
              onToggle={handleToggle}
              error={error}
            />

            {isActive && (
              <>
                {/* Settings Toggle */}
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => setShowSettings(!showSettings)}
                  className={`
                    p-2.5 rounded-xl transition-all duration-200
                    ${showSettings
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-lg shadow-blue-500/20'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Caption Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </motion.button>

                {/* Live Indicator */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-xl border border-red-500/30"
                >
                  <motion.div
                    className="w-2 h-2 bg-red-500 rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <span className="text-red-400 text-sm font-semibold tracking-wide">LIVE</span>
                </motion.div>
              </>
            )}
          </div>

          {/* Settings Panel - Slides Down with Animation */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-4">
                  {/* Transcription Mode - Realtime vs Accurate */}
                  <div>
                    <label className="text-white/70 text-xs font-semibold mb-2 block uppercase tracking-wider">
                      Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button
                        onClick={() => updateSettings({ transcriptionMode: 'realtime' })}
                        className={`
                          py-3 rounded-lg font-medium transition-all duration-200
                          ${settings.transcriptionMode === 'realtime'
                            ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/30'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                          }
                        `}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-sm">⚡ Realtime</span>
                          <span className="text-xs opacity-70 mt-0.5">Fast & Responsive</span>
                        </div>
                      </motion.button>
                      <motion.button
                        onClick={() => updateSettings({ transcriptionMode: 'accurate' })}
                        className={`
                          py-3 rounded-lg font-medium transition-all duration-200
                          ${settings.transcriptionMode === 'accurate'
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                          }
                        `}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-sm">🎯 Accurate</span>
                          <span className="text-xs opacity-70 mt-0.5">Higher Precision</span>
                        </div>
                      </motion.button>
                    </div>
                  </div>

                  {/* Position */}
                  <div>
                    <label className="text-white/70 text-xs font-semibold mb-2 block uppercase tracking-wider">
                      Caption Position
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <motion.button
                          key={pos}
                          onClick={() => updateSettings({ position: pos })}
                          className={`
                            py-2 rounded-lg text-sm font-medium transition-all duration-200
                            ${settings.position === pos
                              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                            }
                          `}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="text-white/70 text-xs font-semibold mb-2 block uppercase tracking-wider">
                      Font Size
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                        <motion.button
                          key={size}
                          onClick={() => updateSettings({ fontSize: size })}
                          className={`
                            py-2 rounded-lg text-sm font-medium transition-all duration-200
                            ${settings.fontSize === size
                              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                            }
                          `}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {size === 'xlarge' ? 'XL' : size.charAt(0).toUpperCase()}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="text-white/70 text-xs font-semibold mb-2 block uppercase tracking-wider">
                      Language
                    </label>
                    <select
                      value={settings.language || 'auto'}
                      onChange={(e) =>
                        updateSettings({ language: e.target.value === 'auto' ? null : e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                        text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        focus:border-blue-500/50 transition-all"
                    >
                      <option value="auto" className="bg-gray-900">Auto-detect</option>
                      <option value="en" className="bg-gray-900">English</option>
                      <option value="es" className="bg-gray-900">Spanish</option>
                      <option value="fr" className="bg-gray-900">French</option>
                      <option value="de" className="bg-gray-900">German</option>
                      <option value="it" className="bg-gray-900">Italian</option>
                      <option value="pt" className="bg-gray-900">Portuguese</option>
                      <option value="zh" className="bg-gray-900">Chinese</option>
                      <option value="ja" className="bg-gray-900">Japanese</option>
                      <option value="ko" className="bg-gray-900">Korean</option>
                      <option value="ar" className="bg-gray-900">Arabic</option>
                      <option value="hi" className="bg-gray-900">Hindi</option>
                    </select>
                  </div>

                  {/* Translation Toggle */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={settings.showTranslation}
                        onChange={(e) => updateSettings({ showTranslation: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-white/5 border-white/10 rounded
                          focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
                      />
                      <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                        Show Translation
                      </span>
                    </label>

                    {settings.showTranslation && (
                      <motion.select
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        value={settings.translateTo || ''}
                        onChange={(e) =>
                          updateSettings({ translateTo: e.target.value || null })
                        }
                        className="w-full mt-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                          text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50
                          focus:border-blue-500/50 transition-all"
                      >
                        <option value="" className="bg-gray-900">Select language...</option>
                        <option value="en" className="bg-gray-900">English</option>
                        <option value="es" className="bg-gray-900">Spanish</option>
                        <option value="fr" className="bg-gray-900">French</option>
                        <option value="de" className="bg-gray-900">German</option>
                        <option value="it" className="bg-gray-900">Italian</option>
                        <option value="pt" className="bg-gray-900">Portuguese</option>
                        <option value="zh" className="bg-gray-900">Chinese</option>
                        <option value="ja" className="bg-gray-900">Japanese</option>
                        <option value="ko" className="bg-gray-900">Korean</option>
                      </motion.select>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 backdrop-blur-xl bg-red-900/80 border border-red-500/40 rounded-xl p-3 shadow-lg"
            >
              <p className="text-red-200 text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Caption Overlay */}
      <CaptionOverlay
        caption={currentCaption}
        position={settings.position}
        fontSize={settings.fontSize}
        showTranslation={settings.showTranslation}
      />
    </>
  );
};
