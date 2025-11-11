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

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveCapture } from '../../contexts/LiveCaptureContext';
import { LiveCaptureButton } from './LiveCaptureButton';

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
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close settings
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettings && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

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
      {/* STYGIAN Live Capture Panel - Bottom Left */}
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-6 left-6 z-50"
      >
        <motion.div
          style={{
            background: "linear-gradient(135deg, rgba(25, 22, 10, 0.95) 0%, rgba(35, 30, 13, 0.98) 50%, rgba(28, 24, 11, 0.95) 100%)",
            borderColor: isActive ? "rgba(180, 120, 30, 0.6)" : "rgba(200, 140, 35, 0.3)",
            boxShadow: isActive
              ? "0 8px 32px rgba(180, 120, 30, 0.4), inset 0 1px 0 rgba(200, 140, 40, 0.2)"
              : "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(200, 140, 40, 0.15)"
          }}
          className={`
            backdrop-blur-2xl rounded-2xl border transition-all duration-300
          `}
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
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
                  onClick={() => setShowSettings(!showSettings)}
                  style={{
                    backgroundColor: showSettings ? "rgba(180, 120, 30, 0.25)" : "rgba(200, 140, 35, 0.12)",
                    borderColor: showSettings ? "rgba(180, 120, 30, 0.6)" : "rgba(200, 140, 35, 0.3)",
                    color: showSettings ? "#c4881e" : "rgba(200, 140, 35, 0.75)",
                    boxShadow: showSettings ? "0 0 20px rgba(180, 120, 30, 0.35)" : "none"
                  }}
                  className="p-2.5 rounded-xl transition-all duration-200 border hover:brightness-125"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Caption Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </motion.button>
              </>
            )}
          </div>

          {/* Settings Panel - Minimalist STYGIAN Design */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pt-2 space-y-2.5" style={{ borderTop: "1px solid rgba(180, 120, 30, 0.2)" }}>
                  {/* Audio Source */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-amber-200/50 font-medium">Source</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateSettings({ audioSource: 'microphone' })}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                          settings.audioSource === 'microphone'
                            ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                            : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        🎤 Mic
                      </button>
                      <button
                        onClick={() => updateSettings({ audioSource: 'system' })}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                          settings.audioSource === 'system'
                            ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                            : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        🔊 System
                      </button>
                    </div>
                  </div>

                  {/* Font Size */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-amber-200/50 font-medium">Size</span>
                    <div className="flex gap-1.5">
                      {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => updateSettings({ fontSize: size })}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                            settings.fontSize === size
                              ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                              : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {size === 'xlarge' ? 'XL' : size === 'medium' ? 'M' : size === 'large' ? 'L' : 'S'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-amber-200/50 font-medium">Language</span>
                    <select
                      value={settings.language || 'auto'}
                      onChange={(e) =>
                        updateSettings({ language: e.target.value === 'auto' ? null : e.target.value })
                      }
                      className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white text-xs
                        focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                    >
                      <option value="auto" className="bg-gray-900">Auto</option>
                      <option value="en" className="bg-gray-900">EN</option>
                      <option value="es" className="bg-gray-900">ES</option>
                      <option value="fr" className="bg-gray-900">FR</option>
                      <option value="de" className="bg-gray-900">DE</option>
                      <option value="it" className="bg-gray-900">IT</option>
                      <option value="pt" className="bg-gray-900">PT</option>
                      <option value="zh" className="bg-gray-900">ZH</option>
                      <option value="ja" className="bg-gray-900">JA</option>
                    </select>
                  </div>

                  {/* Translation */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-amber-200/50 font-medium">Translate</span>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.showTranslation}
                          onChange={(e) => updateSettings({ showTranslation: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/10 peer-focus:ring-1 peer-focus:ring-amber-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600/60"></div>
                      </label>
                      {settings.showTranslation && (
                        <select
                          value={settings.translateTo || ''}
                          onChange={(e) => updateSettings({ translateTo: e.target.value || null })}
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white text-xs
                            focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                        >
                          <option value="" className="bg-gray-900">Lang</option>
                          <option value="en" className="bg-gray-900">EN</option>
                          <option value="es" className="bg-gray-900">ES</option>
                          <option value="fr" className="bg-gray-900">FR</option>
                          <option value="de" className="bg-gray-900">DE</option>
                          <option value="it" className="bg-gray-900">IT</option>
                          <option value="pt" className="bg-gray-900">PT</option>
                          <option value="zh" className="bg-gray-900">ZH</option>
                          <option value="ja" className="bg-gray-900">JA</option>
                        </select>
                      )}
                    </div>
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
    </>
  );
};
