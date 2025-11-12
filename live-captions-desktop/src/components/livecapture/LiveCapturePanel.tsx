/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIVE CAPTURE PANEL - ELEGANT REDESIGN V3
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sleek control panel with streamlined settings and advanced overlay
 * Quick Settings: Audio Source, Language, Translation (frequently changed)
 * Advanced: Quality, Caption Size/Position, Discord (set once, rarely changed)
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveCapture } from '../../contexts/LiveCaptureContext';
import { LiveCaptureButton } from './LiveCaptureButton';
import { invoke } from '@tauri-apps/api/core';

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
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  const handleOpenTranscriptionFolder = async () => {
    try {
      await invoke('open_transcription_folder');
    } catch (err) {
      console.error('[LiveCapture] Failed to open transcription folder:', err);
    }
  };

  const getQualityPreset = (): 'speed' | 'balanced' | 'quality' | 'quality-plus' => {
    switch (settings.modelSize) {
      case 'small': return 'speed';
      case 'medium': return 'balanced';
      case 'large': return 'quality';
      case 'large-v2': return 'quality-plus';
      default: return 'balanced'; // medium fallback
    }
  };

  const setQualityPreset = (preset: 'speed' | 'balanced' | 'quality' | 'quality-plus') => {
    switch (preset) {
      case 'speed':
        updateSettings({ modelSize: 'small' });
        break;
      case 'balanced':
        updateSettings({ modelSize: 'medium' });
        break;
      case 'quality':
        updateSettings({ modelSize: 'large' });
        break;
      case 'quality-plus':
        updateSettings({ modelSize: 'large-v2' });
        break;
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
                  title="Quick Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </motion.button>

                {/* Open Transcription Folder Button */}
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
                  onClick={handleOpenTranscriptionFolder}
                  style={{
                    backgroundColor: "rgba(200, 140, 35, 0.12)",
                    borderColor: "rgba(200, 140, 35, 0.3)",
                    color: "rgba(200, 140, 35, 0.75)"
                  }}
                  className="p-2.5 rounded-xl transition-all duration-200 border hover:brightness-125"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Open Transcription Logs"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </motion.button>
              </>
            )}
          </div>

          {/* Quick Settings Panel */}
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

                  {/* Advanced Button */}
                  <div className="pt-1 border-t border-white/10">
                    <button
                      onClick={() => setShowAdvanced(true)}
                      className="w-full px-3 py-2 rounded-md text-xs font-medium transition-all
                        bg-white/5 text-amber-200/70 border border-white/10 hover:bg-white/10 hover:text-amber-200
                        flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      Advanced Settings
                    </button>
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

      {/* Advanced Settings Overlay */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAdvanced(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(135deg, rgba(25, 22, 10, 0.98) 0%, rgba(35, 30, 13, 0.98) 50%, rgba(28, 24, 11, 0.98) 100%)",
                borderColor: "rgba(200, 140, 35, 0.4)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(200, 140, 40, 0.2)"
              }}
              className="backdrop-blur-2xl rounded-2xl border p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-amber-100">Advanced Settings</h2>
                <button
                  onClick={() => setShowAdvanced(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-amber-200/50 hover:text-amber-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                {/* Quality Presets */}
                <div>
                  <label className="block text-sm font-medium text-amber-200/70 mb-2">Transcription Quality</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setQualityPreset('speed')}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        getQualityPreset() === 'speed'
                          ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                          : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Speed
                    </button>
                    <button
                      onClick={() => setQualityPreset('balanced')}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        getQualityPreset() === 'balanced'
                          ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                          : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Balanced
                    </button>
                    <button
                      onClick={() => setQualityPreset('quality')}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        getQualityPreset() === 'quality'
                          ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                          : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Quality
                    </button>
                    <button
                      onClick={() => setQualityPreset('quality-plus')}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        getQualityPreset() === 'quality-plus'
                          ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                          : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Quality+
                    </button>
                  </div>
                  <p className="text-xs text-amber-300/50 mt-2">
                    {getQualityPreset() === 'speed' && 'Fast transcription with good quality'}
                    {getQualityPreset() === 'balanced' && 'Balanced speed and quality'}
                    {getQualityPreset() === 'quality' && 'High quality, still blazing fast'}
                    {getQualityPreset() === 'quality-plus' && '⚠️ Maximum quality for note-taking (may have slight delay)'}
                  </p>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-sm font-medium text-amber-200/70 mb-2">Caption Size</label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => updateSettings({ fontSize: size })}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                          settings.fontSize === size
                            ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                            : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {size === 'xlarge' ? 'XL' : size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption Position */}
                <div>
                  <label className="block text-sm font-medium text-amber-200/70 mb-2">Caption Position</label>
                  <div className="flex gap-2">
                    {(['top', 'center', 'bottom'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => updateSettings({ position: pos })}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                          settings.position === pos
                            ? 'bg-amber-600/40 text-amber-100 border border-amber-500/50'
                            : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {pos.charAt(0).toUpperCase() + pos.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Discord Integration */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 127.14 96.36" fill="currentColor" style={{color: '#5865F2'}}>
                        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                      </svg>
                      <label className="text-sm font-medium text-amber-200/70">Discord Integration</label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.discordEnabled}
                        onChange={(e) => updateSettings({ discordEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:ring-2 peer-focus:ring-amber-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600/60"></div>
                    </label>
                  </div>
                  {settings.discordEnabled && (
                    <input
                      type="text"
                      placeholder="Discord Webhook URL"
                      value={settings.discordWebhook || ''}
                      onChange={(e) => updateSettings({ discordWebhook: e.target.value || null })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white text-sm
                        placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                    />
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={() => setShowAdvanced(false)}
                  className="w-full px-4 py-2 rounded-lg bg-amber-600/40 hover:bg-amber-600/50 text-amber-100 font-medium
                    border border-amber-500/50 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
