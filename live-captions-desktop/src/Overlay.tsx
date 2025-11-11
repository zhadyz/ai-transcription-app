import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from '@tauri-apps/api/core';

interface Caption {
  text: string;
  language: string;
  timestamp: number;
}

export default function Overlay() {
  console.log('[Overlay] 🚀 COMPONENT RENDERING - Component has mounted!');
  // Also log to Rust console
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    console.warn('[Overlay] OVERLAY COMPONENT IS ALIVE - Tauri detected');
  }

  const [captions, setCaptions] = useState<Caption[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Make the root element transparent for overlay
    const root = document.getElementById('root');
    const body = document.body;
    const html = document.documentElement;

    if (root) root.style.backgroundColor = 'transparent';
    if (body) body.style.backgroundColor = 'transparent';
    if (html) html.style.backgroundColor = 'transparent';


    console.log('[Overlay] Setting up caption listener...');
    setIsLoaded(true);

    // Listen for caption events from Rust on THIS webview window
    // IMPORTANT: Use getCurrentWebviewWindow() instead of getCurrentWindow() in Tauri v2
    const overlayWebview = getCurrentWebviewWindow();
    console.log('[Overlay] Webview label:', overlayWebview.label);

    // Set up event listener for caption events
    const unlistenCaptions = overlayWebview.listen<Caption>("caption", (event) => {
      console.log('[Overlay] ✓ Received caption event:', event.payload);
      const newCaption = event.payload;

      setCaptions((prev) => {
        // Keep only last 3 captions
        const updated = [newCaption, ...prev].slice(0, 3);
        console.log('[Overlay] Updated captions count:', updated.length);
        return updated;
      });

      // Remove caption after 10 seconds
      setTimeout(() => {
        setCaptions((prev) => prev.filter((c) => c.timestamp !== newCaption.timestamp));
      }, 10000);
    });

    console.log('[Overlay] Caption listener registered successfully');

    return () => {
      console.log('[Overlay] Cleaning up caption listener...');
      unlistenCaptions.then((fn) => fn());
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
        {captions.length > 0 && (
          <motion.div
            key={captions[0].timestamp}
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
                padding: '12px 24px',
                fontSize: '24px',
                fontWeight: '600',
                textAlign: 'center',
                borderRadius: '8px',
                pointerEvents: 'none',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
                maxWidth: '90vw',
                wordWrap: 'break-word',
              }}
            >
              {captions[0].text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
