import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    react()
  ],
  clearScreen: false,

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        overlay: path.resolve(__dirname, 'overlay.html'),
      },
    },
  },

  server: {
    port: 1420,
    strictPort: true,
    cors: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  optimizeDeps: {
    exclude: [
      '@automerge/automerge',
    ],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'rxjs',
      'zustand',
      'socket.io-client',
    ],
    esbuildOptions: {
      target: 'esnext',
      supported: {
        'top-level-await': true,
      },
    },
  },

  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
});
