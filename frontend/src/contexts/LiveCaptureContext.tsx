/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIVE CAPTURE CONTEXT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * React context for managing real-time transcription state.
 *
 * Features:
 * - Audio capture management
 * - WebSocket connection management
 * - Caption state management
 * - Error handling
 * - Translation integration
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AudioCaptureService, AudioChunk, isAudioCaptureSupported } from '../services/audioCapture';
import { RealtimeWebSocket, CaptionMessage, TranslationMessage } from '../services/realtimeWebSocket';

export interface LiveCaptureSettings {
  language?: string | null;
  translateTo?: string | null;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  position: 'top' | 'bottom' | 'center';
  showTranslation: boolean;
  transcriptionMode: 'realtime' | 'accurate';
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
    language: null, // Auto-detect
    translateTo: null,
    fontSize: 'large',
    position: 'bottom',
    showTranslation: false,
    transcriptionMode: 'realtime', // Default to realtime mode
  });

  // Services (refs to persist across renders)
  const audioService = useRef<AudioCaptureService | null>(null);
  const websocket = useRef<RealtimeWebSocket | null>(null);

  // Check if supported
  const isSupported = isAudioCaptureSupported();

  /**
   * Start live capture
   */
  const start = useCallback(async () => {
    if (!isSupported) {
      setError('Live capture not supported in this browser');
      return;
    }

    if (isActive) {
      console.warn('[LiveCapture] Already active');
      return;
    }

    try {
      setError(null);
      setIsActive(true);

      // Initialize services if needed
      if (!audioService.current) {
        audioService.current = new AudioCaptureService({
          sampleRate: 16000,
          channelCount: 1,
        });

        audioService.current.setVolumeCallback((vol) => {
          setVolume(vol);
        });

        audioService.current.setErrorCallback((err) => {
          console.error('[LiveCapture] Audio error:', err);
          setError(err.message);
          stop();
        });
      }

      if (!websocket.current) {
        websocket.current = new RealtimeWebSocket({
          language: settings.language,
          translate_to: settings.translateTo,
        });

        websocket.current.setConnectionCallback((connected) => {
          setIsConnected(connected);
        });

        websocket.current.setMessageCallback((message) => {
          console.log('[LiveCapture] Received message:', message);
          if (message.type === 'caption') {
            // Always create a NEW caption with unique ID - never append/update
            const caption: Caption = {
              id: `caption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              text: message.text,
              language: message.language,
              timestamp: message.timestamp,
            };
            console.log('[LiveCapture] Creating NEW caption:', caption);

            // Force new caption by clearing old one first, then setting new
            setCurrentCaption(null);
            setTimeout(() => {
              setCurrentCaption(caption);
            }, 50); // Small delay to ensure clean animation transition
          } else if (message.type === 'translation') {
            console.log('[LiveCapture] Setting translation:', message.text);
            setCurrentCaption((prev) => {
              if (prev) {
                return {
                  ...prev,
                  translation: message.text,
                  translationLanguage: message.language,
                };
              }
              return prev;
            });
          }
        });

        websocket.current.setErrorCallback((err) => {
          console.error('[LiveCapture] WebSocket error:', err);
          setError(err.message);
        });
      }

      // Connect WebSocket
      console.log('[LiveCapture] Connecting to server...');
      await websocket.current.connect();

      // Start audio capture
      console.log('[LiveCapture] Starting audio capture...');

      audioService.current.setAudioChunkCallback((chunk: AudioChunk) => {
        if (websocket.current && websocket.current.isConnected()) {
          websocket.current.sendAudio(chunk.data);
        }
      });

      await audioService.current.start();

      console.log('[LiveCapture] Started successfully');
    } catch (err) {
      console.error('[LiveCapture] Start failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start live capture';
      setError(errorMessage);
      setIsActive(false);

      // Cleanup on error
      cleanup();
    }
  }, [isActive, isSupported, settings.language, settings.translateTo]);

  /**
   * Stop live capture
   */
  const stop = useCallback(() => {
    console.log('[LiveCapture] Stopping...');

    if (audioService.current) {
      audioService.current.stop();
    }

    if (websocket.current) {
      websocket.current.disconnect();
    }

    setIsActive(false);
    setIsConnected(false);
    setVolume(0);
    setCurrentCaption(null);

    console.log('[LiveCapture] Stopped');
  }, []);

  /**
   * Cleanup services
   */
  const cleanup = useCallback(() => {
    if (audioService.current) {
      audioService.current.stop();
      audioService.current = null;
    }

    if (websocket.current) {
      websocket.current.disconnect();
      websocket.current = null;
    }
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback(
    (newSettings: Partial<LiveCaptureSettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }));

      // Update WebSocket config if connected
      if (websocket.current && websocket.current.isConnected()) {
        if ('language' in newSettings || 'translateTo' in newSettings || 'transcriptionMode' in newSettings) {
          websocket.current.sendConfig({
            language: newSettings.language !== undefined ? newSettings.language : settings.language,
            translate_to:
              newSettings.translateTo !== undefined ? newSettings.translateTo : settings.translateTo,
            model_size: newSettings.transcriptionMode === 'realtime' ? 'tiny' : 'small',
          });
        }
      }
    },
    [settings.language, settings.translateTo]
  );

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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
