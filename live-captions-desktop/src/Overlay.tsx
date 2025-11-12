import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from '@tauri-apps/api/core';

interface Caption {
  text: string;
  language: string;
  timestamp: number;
}

interface CaptionPair {
  caption: Caption;
  translation: Caption | null;
}

export default function Overlay() {
  console.log('[Overlay] 🚀 COMPONENT RENDERING - Component has mounted!');
  // Also log to Rust console
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    console.warn('[Overlay] OVERLAY COMPONENT IS ALIVE - Tauri detected');
  }

  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null);
  const [currentTranslation, setCurrentTranslation] = useState<Caption | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Make the root element transparent for overlay
    const root = document.getElementById('root');
    const body = document.body;
    const html = document.documentElement;

    if (root) root.style.backgroundColor = 'transparent';
    if (body) body.style.backgroundColor = 'transparent';
    if (html) html.style.backgroundColor = 'transparent';


    console.log('[Overlay] Setting up caption and translation listeners...');
    setIsLoaded(true);

    // Listen for caption and translation events from Rust
    const overlayWebview = getCurrentWebviewWindow();
    console.log('[Overlay] Webview label:', overlayWebview.label);

    // Listen for caption events
    const unlistenCaptions = overlayWebview.listen<Caption>("caption", (event) => {
      console.log('[Overlay] ✓ Received caption event:', event.payload);
      setCurrentCaption(event.payload);
      setCurrentTranslation(null); // Clear previous translation

      // Clear caption after 10 seconds
      setTimeout(() => {
        setCurrentCaption(null);
        setCurrentTranslation(null);
      }, 10000);
    });

    // Listen for translation events
    const unlistenTranslation = overlayWebview.listen<Caption>("translation", (event) => {
      console.log('[Overlay] ✓ Received translation event:', event.payload);
      setCurrentTranslation(event.payload);
    });

    console.log('[Overlay] Caption and translation listeners registered successfully');

    return () => {
      console.log('[Overlay] Cleaning up listeners...');
      unlistenCaptions.then((fn) => fn());
      unlistenTranslation.then((fn) => fn());
    };
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center pb-8"
      style={{
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {currentCaption && (
          <motion.div
            key={currentCaption.timestamp}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                color: '#FFFFFF',
                padding: '16px 28px',
                fontSize: '24px',
                fontWeight: '600',
                textAlign: 'center',
                borderRadius: '8px',
                pointerEvents: 'none',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
                maxWidth: '90vw',
                wordWrap: 'break-word',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div>{currentCaption.text}</div>
              {currentTranslation && (
                <div
                  style={{
                    color: '#C084FC',
                    fontSize: '22px',
                    fontWeight: '500',
                    marginTop: '4px',
                  }}
                >
                  {currentTranslation.text}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
