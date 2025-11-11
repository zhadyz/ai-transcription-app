/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIVE CAPTURE CONTEXT - TAURI DESKTOP VERSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * React context for managing real-time transcription state in Tauri desktop.
 * Uses Tauri commands to interact with Rust backend for audio capture.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface LiveCaptureSettings {
  language?: string | null;
  translateTo?: string | null;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  position: 'top' | 'bottom' | 'center';
  showTranslation: boolean;
  modelSize: 'tiny' | 'small' | 'medium';
  audioSource: 'microphone' | 'system';
}

export interface Caption {
  id: string;
  text: string;
  language: string;
  timestamp: number;
  translation?: string;
  translationLanguage?: string;
}

interface LiveCaptureContextValue {
  // State
  isActive: boolean;
  isConnected: boolean;
  volume: number;
  currentCaption: Caption | null;
  error: string | null;
  settings: LiveCaptureSettings;

  // Actions
  start: () => Promise<void>;
  stop: () => void;
  updateSettings: (settings: Partial<LiveCaptureSettings>) => void;

  // Capabilities
  isSupported: boolean;
}

const LiveCaptureContext = createContext<LiveCaptureContextValue | null>(null);

export const useLiveCapture = () => {
  const context = useContext(LiveCaptureContext);
  if (!context) {
    throw new Error('useLiveCapture must be used within LiveCaptureProvider');
  }
  return context;
};

interface LiveCaptureProviderProps {
  children: React.ReactNode;
}

export const LiveCaptureProvider: React.FC<LiveCaptureProviderProps> = ({ children }) => {
  // State
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<LiveCaptureSettings>({
    language: null,
    translateTo: null,
    fontSize: 'large',
    position: 'bottom',
    showTranslation: false,
    modelSize: 'medium',
    audioSource: 'microphone',
  });

  // Tauri desktop always supports audio capture via Rust backend
  const isSupported = true;

  /**
   * Start live capture - calls Rust backend
   */
  const start = useCallback(async () => {
    if (isActive) {
      console.warn('[LiveCapture] Already active');
      return;
    }

    try {
      setError(null);
      setIsActive(true);
      setIsConnected(true);

      console.log('[LiveCapture] Starting capture via Rust backend...');
      console.log('[LiveCapture] Audio source:', settings.audioSource);

      // Call Rust command to start capture with device type and model size
      await invoke('start_capture', {
        deviceType: settings.audioSource,
        modelSize: settings.modelSize
      });

      console.log('[LiveCapture] Started successfully');
    } catch (err) {
      console.error('[LiveCapture] Start failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start live capture';
      setError(errorMessage);
      setIsActive(false);
      setIsConnected(false);
    }
  }, [isActive, settings.audioSource]);

  /**
   * Stop live capture - calls Rust backend
   */
  const stop = useCallback(async () => {
    console.log('[LiveCapture] Stopping...');

    try {
      // Call Rust command to stop capture
      await invoke('stop_capture');
    } catch (err) {
      console.error('[LiveCapture] Stop failed:', err);
    }

    setIsActive(false);
    setIsConnected(false);
    setVolume(0);
    setCurrentCaption(null);

    console.log('[LiveCapture] Stopped');
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback((newSettings: Partial<LiveCaptureSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  /**
   * Listen for caption events from Rust backend
   */
  useEffect(() => {
    console.log('[LiveCapture] Setting up event listeners...');

    const unlistenCaption = listen<{ text: string; language: string; timestamp: number }>(
      'caption',
      (event) => {
        console.log('[LiveCapture] Received caption:', event.payload);

        const caption: Caption = {
          id: `caption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: event.payload.text,
          language: event.payload.language,
          timestamp: event.payload.timestamp,
        };

        setCurrentCaption(caption);
      }
    );

    return () => {
      unlistenCaption.then((fn) => fn());
    };
  }, []);

  /**
   * Hotswap audio source when settings change
   */
  useEffect(() => {
    if (isActive) {
      console.log('[LiveCapture] Audio source changed, restarting capture...');
      const restartCapture = async () => {
        await stop();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 200));
        await start();
      };
      restartCapture();
    }
  }, [settings.audioSource]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (isActive) {
        stop();
      }
    };
  }, [isActive, stop]);

  const value: LiveCaptureContextValue = {
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
  };

  return <LiveCaptureContext.Provider value={value}>{children}</LiveCaptureContext.Provider>;
};
