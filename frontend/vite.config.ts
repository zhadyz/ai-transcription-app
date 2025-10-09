import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // ═══════════════════════════════════════════════════════════════════════════
  // PLUGINS - WebAssembly + React with Fast Refresh
  // ═══════════════════════════════════════════════════════════════════════════
  plugins: [
    wasm(),           // WASM support for zero-copy streaming
    topLevelAwait(),  // Top-level await for async WASM initialization
    react({
      // Fast Refresh for instant HMR
      fastRefresh: true,
      // REMOVED: Babel console removal (redundant - esbuild handles it)
    }),
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ESBUILD - Minification and optimization (ROOT LEVEL)
  // ═══════════════════════════════════════════════════════════════════════════
  esbuild: {
    drop: ['console', 'debugger'],  // Remove console.log and debugger in production
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PATH RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVELOPMENT SERVER - Network Exposed + Hot Reload
  // ═══════════════════════════════════════════════════════════════════════════
  server: {
    host: '0.0.0.0',      // Expose on network (mobile access via QR code)
    port: 5173,           // Default port
    strictPort: true,     // Fail if port already in use
    open: false,          // Don't auto-open (startup script handles this)
    cors: true,           // Enable CORS for backend communication
    
    // Hot Module Replacement
    hmr: {
      overlay: true,      // Show errors as overlay
      clientPort: 5173,   // HMR client port
    },

    // Proxy backend API calls (optional - for production builds)
    // proxy: {
    //   '/api': {
    //     target: 'https://192.168.1.144:8443',
    //     changeOrigin: true,
    //     secure: false,
    //   },
    // },

    // Watch configuration
    watch: {
      usePolling: false,  // Don't use polling (faster on Windows)
      interval: 100,      // Check every 100ms
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW SERVER - For Testing Production Builds
  // ═══════════════════════════════════════════════════════════════════════════
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    open: false,
    cors: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD CONFIGURATION - Production Optimizations
  // ═══════════════════════════════════════════════════════════════════════════
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,      // Generate sourcemaps for debugging
    
    // Use esbuild minifier (built-in, no extra dependency needed)
    minify: 'esbuild',

    // Code splitting strategy
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // Animation libraries
          'animation': ['framer-motion'],
          
          // RxJS and state management
          'state': ['rxjs', '@automerge/automerge', 'zustand'],
          
          // Socket and messaging
          'socket': ['socket.io-client', '@msgpack/msgpack'],
        },
        
        // Naming strategy for chunks
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },

    // Chunk size warning limit (KB)
    chunkSizeWarningLimit: 1000,

    // CSS code splitting
    cssCodeSplit: true,

    // Asset inlining threshold (smaller assets become base64)
    assetsInlineLimit: 4096, // 4KB

    // Target modern browsers
    target: 'esnext',

    // Report compressed size
    reportCompressedSize: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDENCY OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  optimizeDeps: {
    // Exclude packages that shouldn't be pre-bundled
    exclude: [
      '@automerge/automerge',  // CRDT library (special handling needed)
    ],
    
    // Force include packages that need pre-bundling
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'rxjs',
      'zustand',
      'socket.io-client',
    ],

    // Use esbuild for fast dependency pre-bundling
    esbuildOptions: {
      target: 'esnext',
      supported: {
        'top-level-await': true,  // Enable top-level await
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE - Worker & WASM Optimizations
  // ═══════════════════════════════════════════════════════════════════════════
  worker: {
    format: 'es',         // Use ES modules in workers
    plugins: () => [wasm()],  // FIXED: plugins is now a function
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENTAL - Cutting-edge Features
  // ═══════════════════════════════════════════════════════════════════════════
  experimental: {
    // Enable render-on-demand for better performance
    renderBuiltUrl(filename: string) {
      return { relative: true }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════════════════════
  logLevel: 'info',     // 'info' | 'warn' | 'error' | 'silent'
  clearScreen: true,    // Clear terminal on restart
})