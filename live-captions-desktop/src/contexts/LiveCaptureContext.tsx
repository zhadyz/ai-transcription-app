/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIVE CAPTURE CONTEXT - TAURI DESKTOP VERSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * React context for managing real-time transcription state in Tauri desktop.
 * Uses Tauri commands to interact with Rust backend for audio capture.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * Map frontend model names to backend model names
 * Frontend uses 'large-v2' but backend uses 'large-v3'
 */
const mapModelName = (name: string): string => {
  return name === 'large-v2' ? 'large-v3' : name;
};

export interface LiveCaptureSettings {
  language?: string | null;
  translateTo?: string | null;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  position: 'top' | 'bottom' | 'center';
  showTranslation: boolean;
  modelSize: 'tiny' | 'small' | 'medium' | 'large' | 'large-v2';
  audioSource: 'microphone' | 'system';
  discordWebhook?: string | null;
  discordEnabled: boolean;
}

export interface ModelInfo {
  model_size: string;
  device: string;
}

export interface Caption {
  id: string;
  text: string;
  language: string;
  timestamp: number;
  translation?: string;
  translationLanguage?: string;
  modelInfo?: ModelInfo;  // 🎯 DEBUG: Track which model produced this caption
}

interface LiveCaptureContextValue {
  // State
  isActive: boolean;
  isConnected: boolean;
  volume: number;
  currentCaption: Caption | null;
  error: string | null;
  settings: LiveCaptureSettings;
  currentModelInfo: ModelInfo | null;  // 🎯 DEBUG: Track current model
  isModelSwitching: boolean;  // True when model switch is in progress

  // Actions
  start: () => Promise<void>;
  stop: () => void;
  updateSettings: (settings: Partial<LiveCaptureSettings>) => void;
  checkModelAvailable: (modelSize: string) => Promise<boolean>;

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
  const [currentModelInfo, setCurrentModelInfo] = useState<ModelInfo | null>(null);  // 🎯 DEBUG
  const [isModelSwitching, setIsModelSwitching] = useState(false);  // Track model switch in progress
  const backendUrlRef = useRef<string | null>(null);
  const [settings, setSettings] = useState<LiveCaptureSettings>(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem('liveCaptureSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
      }
    }
    return {
      language: null,
      translateTo: null,
      fontSize: 'large',
      position: 'bottom',
      showTranslation: false,
      modelSize: 'tiny',  // Use tiny for realtime to avoid memory-intensive model switch
      audioSource: 'microphone',
      discordWebhook: null,
      discordEnabled: false,
    };
  });

  // Tauri desktop always supports audio capture via Rust backend
  const isSupported = true;

  /**
   * Get backend URL from Tauri on mount
   */
  useEffect(() => {
    const getBackendUrl = async () => {
      try {
        const url = await invoke<string>('get_backend_url');
        backendUrlRef.current = url;
        console.log('[LiveCapture] Backend URL:', url);
      } catch (err) {
        console.error('[LiveCapture] Failed to get backend URL:', err);
      }
    };
    getBackendUrl();
  }, []);

  /**
   * Check if a model is available (downloaded) on the backend
   * Returns true if model is ready for use, false if needs downloading
   */
  const checkModelAvailable = useCallback(async (modelSize: string): Promise<boolean> => {
    const backendUrl = backendUrlRef.current;
    if (!backendUrl) {
      console.warn('[LiveCapture] Backend URL not available, assuming model is ready');
      return true;  // Optimistic fallback
    }

    const backendModelName = mapModelName(modelSize);

    try {
      console.log(`[LiveCapture] Checking if model '${backendModelName}' is downloaded...`);
      const response = await fetch(`${backendUrl}/models/${backendModelName}/status`);

      if (!response.ok) {
        console.warn(`[LiveCapture] Model status check failed: ${response.status}`);
        return true;  // Optimistic fallback - let backend handle missing model
      }

      const data = await response.json();
      console.log(`[LiveCapture] Model '${backendModelName}' status:`, data);
      return data.downloaded === true;
    } catch (err) {
      console.error('[LiveCapture] Error checking model status:', err);
      return true;  // Optimistic fallback
    }
  }, []);

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
      console.log('[LiveCapture] Translation:', settings.showTranslation ? settings.translateTo : 'disabled');

      // Call Rust command to start capture with all settings
      await invoke('start_capture', {
        deviceType: settings.audioSource,
        modelSize: settings.modelSize,
        discordWebhook: settings.discordEnabled ? settings.discordWebhook : null,
        translateTo: settings.showTranslation ? settings.translateTo : null,
        showTranslation: settings.showTranslation
      });

      console.log('[LiveCapture] Started successfully');
    } catch (err) {
      console.error('[LiveCapture] Start failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start live capture';
      setError(errorMessage);
      setIsActive(false);
      setIsConnected(false);
    }
  }, [isActive, settings]);

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
   * Update settings and persist to localStorage
   *
   * Model changes trigger a clean stop/restart to avoid hot-swap issues.
   * Translation changes are sent to backend mid-stream (safe operation).
   *
   * IMPORTANT: Before switching models, we check if the target model is downloaded.
   * If not, we set an error and don't proceed with the switch.
   */
  const updateSettings = useCallback(async (newSettings: Partial<LiveCaptureSettings>) => {
    // Check if model is changing while capture is active
    const modelChanged = 'modelSize' in newSettings && newSettings.modelSize !== settings.modelSize;
    const wasActive = isActive;

    // If model changed during active capture, do clean restart
    if (modelChanged && wasActive && newSettings.modelSize) {
      console.log('[LiveCapture] Model change requested:', settings.modelSize, '→', newSettings.modelSize);

      // Check if target model is downloaded BEFORE stopping capture
      setIsModelSwitching(true);
      setError(null);

      const isAvailable = await checkModelAvailable(newSettings.modelSize);

      if (!isAvailable) {
        const modelName = mapModelName(newSettings.modelSize);
        console.error(`[LiveCapture] Model '${modelName}' is not downloaded!`);
        setIsModelSwitching(false);
        setError(`Model '${modelName}' is not downloaded. Please download it first in Settings → Model Management.`);
        return;  // Don't proceed with model switch
      }

      console.log('[LiveCapture] Model is available, performing clean restart...');
      console.log('[LiveCapture] Old model:', settings.modelSize, '→ New model:', newSettings.modelSize);

      // Stop current capture
      await stop();

      // Update settings (this also persists to localStorage)
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        localStorage.setItem('liveCaptureSettings', JSON.stringify(updated));
        return updated;
      });

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      // Restart with new model
      console.log('[LiveCapture] Restarting with new model...');
      await start();

      setIsModelSwitching(false);
      return;
    }

    // Normal settings update (no model change, or not active)
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('liveCaptureSettings', JSON.stringify(updated));
      return updated;
    });

    // If capture is active and translation settings changed, update backend (safe mid-stream)
    if (isActive) {
      const needsTranslationUpdate =
        'translateTo' in newSettings ||
        'showTranslation' in newSettings;

      if (needsTranslationUpdate) {
        try {
          const currentSettings = {
            ...settings,
            ...newSettings
          };

          await invoke('update_capture_config', {
            translateTo: currentSettings.showTranslation ? currentSettings.translateTo : null,
            showTranslation: currentSettings.showTranslation,
            modelSize: currentSettings.modelSize  // Keep current model, no hot-swap
          });

          console.log('[LiveCapture] Translation config updated:', {
            translateTo: currentSettings.showTranslation ? currentSettings.translateTo : null,
            showTranslation: currentSettings.showTranslation
          });
        } catch (err) {
          console.error('[LiveCapture] Failed to update config:', err);
        }
      }
    }
  }, [isActive, settings, stop, start]);

  /**
   * Listen for caption events from Rust backend
   */
  useEffect(() => {
    console.log('[LiveCapture] Setting up event listeners...');

    const unlistenCaption = listen<{
      text: string;
      language: string;
      timestamp: number;
      model_info?: { model_size: string; device: string };
    }>(
      'caption',
      (event) => {
        // 🎯 DEBUG: Log with model info for troubleshooting
        if (event.payload.model_info) {
          console.log(
            `[LiveCapture] 🎯 Caption [model=${event.payload.model_info.model_size}|device=${event.payload.model_info.device}]:`,
            event.payload.text
          );
          setCurrentModelInfo({
            model_size: event.payload.model_info.model_size,
            device: event.payload.model_info.device,
          });
        } else {
          console.log('[LiveCapture] Received caption:', event.payload);
        }

        const caption: Caption = {
          id: `caption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: event.payload.text,
          language: event.payload.language,
          timestamp: event.payload.timestamp,
          modelInfo: event.payload.model_info ? {
            model_size: event.payload.model_info.model_size,
            device: event.payload.model_info.device,
          } : undefined,
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
    currentModelInfo,  // 🎯 DEBUG: Expose model info
    isModelSwitching,  // Track model switch in progress
    start,
    stop,
    updateSettings,
    checkModelAvailable,  // Allow components to check model availability
    isSupported,
  };

  return <LiveCaptureContext.Provider value={value}>{children}</LiveCaptureContext.Provider>;
};
