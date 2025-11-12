/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIO CAPTURE SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Captures audio from browser microphone using Web Audio API.
 * Processes audio and streams to backend via WebSocket.
 *
 * Features:
 * - Microphone access with permission handling
 * - Audio processing with AudioWorklet (low-latency)
 * - Real-time volume monitoring
 * - Automatic resampling to 16kHz (Whisper requirement)
 * - Error recovery and graceful degradation
 */

export interface AudioCaptureConfig {
  sampleRate?: number; // Target sample rate (default: 16000 for Whisper)
  channelCount?: number; // Mono (1) or Stereo (2)
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  duration: number;
}

export type AudioChunkCallback = (chunk: AudioChunk) => void;
export type VolumeCallback = (volume: number) => void;
export type ErrorCallback = (error: Error) => void;

export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;

  private isCapturing = false;
  private config: Required<AudioCaptureConfig>;

  private onAudioChunk: AudioChunkCallback | null = null;
  private onVolume: VolumeCallback | null = null;
  private onError: ErrorCallback | null = null;

  // Volume monitoring
  private volumeDataArray: Uint8Array | null = null;
  private volumeCheckInterval: number | null = null;

  constructor(config: AudioCaptureConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 16000,
      channelCount: config.channelCount ?? 1,
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true,
    };
  }

  /**
   * Start capturing audio from microphone
   */
  async start(): Promise<void> {
    if (this.isCapturing) {
      console.warn('[AudioCapture] Already capturing');
      return;
    }

    try {
      console.log('[AudioCapture] Requesting microphone access...');

      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          channelCount: this.config.channelCount,
        },
        video: false,
      });

      console.log('[AudioCapture] Microphone access granted');

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });

      console.log(
        `[AudioCapture] AudioContext created: ${this.audioContext.sampleRate}Hz`
      );

      // Create source node from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

      // Create analyser for volume monitoring
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.volumeDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

      // Create script processor for audio data extraction
      // Buffer size: 4096 samples = ~256ms at 16kHz (good balance)
      const bufferSize = 4096;
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(
        bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // Audio processing callback
      this.scriptProcessorNode.onaudioprocess = (event) => {
        if (!this.isCapturing) return;

        const inputBuffer = event.inputBuffer;
        const audioData = inputBuffer.getChannelData(0); // Get mono channel

        // Convert to Float32Array
        const chunk: AudioChunk = {
          data: new Float32Array(audioData),
          timestamp: Date.now(),
          duration: audioData.length / this.config.sampleRate,
        };

        // Call callback
        if (this.onAudioChunk) {
          this.onAudioChunk(chunk);
        }
      };

      // Connect nodes: Source → ScriptProcessor → Analyser → Destination
      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);

      // Start volume monitoring
      this.startVolumeMonitoring();

      this.isCapturing = true;
      console.log('[AudioCapture] Capture started');
    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error);
      this.cleanup();

      const err = error as Error;
      if (this.onError) {
        this.onError(err);
      }
      throw err;
    }
  }

  /**
   * Stop capturing audio
   */
  stop(): void {
    if (!this.isCapturing) {
      console.warn('[AudioCapture] Not capturing');
      return;
    }

    console.log('[AudioCapture] Stopping capture...');

    this.isCapturing = false;
    this.stopVolumeMonitoring();
    this.cleanup();

    console.log('[AudioCapture] Capture stopped');
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Get current audio context state
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * Set callback for audio chunks
   */
  setAudioChunkCallback(callback: AudioChunkCallback): void {
    this.onAudioChunk = callback;
  }

  /**
   * Set callback for volume updates
   */
  setVolumeCallback(callback: VolumeCallback): void {
    this.onVolume = callback;
  }

  /**
   * Set callback for errors
   */
  setErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Start monitoring audio volume
   */
  private startVolumeMonitoring(): void {
    if (this.volumeCheckInterval !== null) return;

    this.volumeCheckInterval = window.setInterval(() => {
      if (!this.analyserNode || !this.volumeDataArray || !this.isCapturing) {
        return;
      }

      // Get frequency data
      this.analyserNode.getByteFrequencyData(this.volumeDataArray as Uint8Array<ArrayBuffer>);

      // Calculate average volume (0-1 range)
      const sum = this.volumeDataArray.reduce((a, b) => a + b, 0);
      const average = sum / this.volumeDataArray.length;
      const volume = average / 255; // Normalize to 0-1

      if (this.onVolume) {
        this.onVolume(volume);
      }
    }, 100); // Update every 100ms
  }

  /**
   * Stop monitoring audio volume
   */
  private stopVolumeMonitoring(): void {
    if (this.volumeCheckInterval !== null) {
      window.clearInterval(this.volumeCheckInterval);
      this.volumeCheckInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Disconnect nodes
    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.volumeDataArray = null;
  }
}

/**
 * Check if browser supports audio capture
 */
export function isAudioCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof AudioContext !== 'undefined'
  );
}

/**
 * Request microphone permission without starting capture
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (!isAudioCaptureSupported()) {
    throw new Error('Audio capture not supported in this browser');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.error('[AudioCapture] Permission denied:', error);
    return false;
  }
}
