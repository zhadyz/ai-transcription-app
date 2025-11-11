/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REAL-TIME TRANSCRIPTION WEBSOCKET CLIENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WebSocket client for real-time transcription service.
 * Streams audio to backend and receives transcription results.
 *
 * Features:
 * - WebSocket connection management
 * - Audio streaming (Float32Array → binary)
 * - Caption reception and parsing
 * - Automatic reconnection
 * - Heartbeat/ping-pong
 */

import { BACKEND_URL } from '../config/backend';

export interface RealtimeConfig {
  language?: string | null; // null = auto-detect
  translate_to?: string | null;
  min_chunk_duration?: number;
}

export interface CaptionMessage {
  type: 'caption';
  text: string;
  language: string;
  start: number;
  end: number;
  is_final: boolean;
  timestamp: number;
}

export interface TranslationMessage {
  type: 'translation';
  text: string;
  language: string;
  timestamp: number;
}

export type MessageCallback = (message: CaptionMessage | TranslationMessage) => void;
export type ConnectionCallback = (connected: boolean) => void;
export type ErrorCallback = (error: Error) => void;

export class RealtimeWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // ms
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;

  private isIntentionalClose = false;
  private config: RealtimeConfig;

  private onMessage: MessageCallback | null = null;
  private onConnection: ConnectionCallback | null = null;
  private onError: ErrorCallback | null = null;

  constructor(config: RealtimeConfig = {}) {
    // Build WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = BACKEND_URL().replace(/^https?:\/\//, '');
    this.url = `${wsProtocol}//${backendHost}/ws/realtime`;

    this.config = config;

    console.log('[RealtimeWS] Initialized:', this.url);
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.warn('[RealtimeWS] Already connected');
        resolve();
        return;
      }

      console.log('[RealtimeWS] Connecting...');
      this.isIntentionalClose = false;

      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';

        // Connection opened
        this.ws.onopen = () => {
          console.log('[RealtimeWS] Connected');
          this.reconnectAttempts = 0;
          this.startPingInterval();

          if (this.onConnection) {
            this.onConnection(true);
          }

          // Send config if provided
          if (Object.keys(this.config).length > 0) {
            this.sendConfig(this.config);
          }

          resolve();
        };

        // Message received
        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        // Connection error
        this.ws.onerror = (event) => {
          console.error('[RealtimeWS] Error:', event);
          const error = new Error('WebSocket connection error');
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        };

        // Connection closed
        this.ws.onclose = (event) => {
          console.log(`[RealtimeWS] Closed: ${event.code} - ${event.reason}`);
          this.stopPingInterval();

          if (this.onConnection) {
            this.onConnection(false);
          }

          // Attempt reconnection if not intentional
          if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('[RealtimeWS] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[RealtimeWS] Disconnecting...');
    this.isIntentionalClose = true;

    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send audio chunk to server
   */
  sendAudio(audioData: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeWS] Cannot send audio: not connected');
      return;
    }

    // Send as binary (Float32Array as ArrayBuffer)
    this.ws.send(audioData.buffer);
  }

  /**
   * Send configuration update
   */
  sendConfig(config: RealtimeConfig): void {
    this.config = { ...this.config, ...config };
    this.sendJSON({
      type: 'config',
      ...this.config,
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Set callback for messages
   */
  setMessageCallback(callback: MessageCallback): void {
    this.onMessage = callback;
  }

  /**
   * Set callback for connection status
   */
  setConnectionCallback(callback: ConnectionCallback): void {
    this.onConnection = callback;
  }

  /**
   * Set callback for errors
   */
  setErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: MessageEvent): void {
    // Text message (JSON)
    if (typeof event.data === 'string') {
      try {
        const message = JSON.parse(event.data);
        this.handleJSONMessage(message);
      } catch (error) {
        console.error('[RealtimeWS] Failed to parse JSON:', error);
      }
    }
    // Binary message (not expected from server for now)
    else if (event.data instanceof ArrayBuffer) {
      console.debug('[RealtimeWS] Binary message received (unexpected)');
    }
  }

  /**
   * Handle JSON message
   */
  private handleJSONMessage(message: any): void {
    const type = message.type;

    switch (type) {
      case 'connected':
        console.log('[RealtimeWS] Server confirmed connection:', message.session_id);
        break;

      case 'caption':
      case 'translation':
        if (this.onMessage) {
          this.onMessage(message as CaptionMessage | TranslationMessage);
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'config_updated':
        console.log('[RealtimeWS] Config updated:', message.config);
        break;

      case 'ping':
        // Server ping - respond with pong
        this.sendJSON({ type: 'pong', timestamp: Date.now() });
        break;

      default:
        console.debug('[RealtimeWS] Unknown message type:', type);
    }
  }

  /**
   * Send JSON message
   */
  private sendJSON(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeWS] Cannot send JSON: not connected');
      return;
    }

    this.ws.send(JSON.stringify(data));
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[RealtimeWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = window.setTimeout(() => {
      console.log('[RealtimeWS] Attempting reconnect...');
      this.connect().catch((error) => {
        console.error('[RealtimeWS] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Start ping interval (keep-alive)
   */
  private startPingInterval(): void {
    if (this.pingInterval !== null) return;

    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendJSON({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // Ping every 30s
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval !== null) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
