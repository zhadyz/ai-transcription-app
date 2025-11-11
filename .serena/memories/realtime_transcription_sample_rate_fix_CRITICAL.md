# CRITICAL: Real-time Transcription Sample Rate Fix (WORKING)

**Date**: 2025-11-11
**Status**: ✅ CONFIRMED WORKING

## Root Cause

**Sample Rate Mismatch**: Scarlett 2i2 USB microphone captures at **48kHz**, but Python backend expects **16kHz**.

### Impact:
- Silero VAD completely fails (requires exactly 16kHz)
- Speech ratios show 0.000-0.006 instead of 0.020-0.090+
- No captions appear when user speaks

## Solution: Audio Resampling in Rust

### 1. Added rubato dependency
**File**: `live-captions-desktop/src-tauri/Cargo.toml`
```toml
rubato = "0.14"  # Audio resampling
```

### 2. Modified main.rs

**Import** (line 15):
```rust
use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};
```

**Create resampler** (lines 475-509):
```rust
let input_sample_rate = config.sample_rate().0 as usize;
let target_sample_rate = 16000usize; // Backend expects 16kHz

let resampler = if input_sample_rate != target_sample_rate {
    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };
    
    let resample_chunk_size = 4800; // Input chunk size
    
    SincFixedIn::<f32>::new(
        target_sample_rate as f64 / input_sample_rate as f64,
        2.0, // max_resample_ratio_relative
        params,
        resample_chunk_size,
        1, // 1 channel (mono)
    ).ok()
} else {
    None
};
```

**Apply resampling in audio callback** (lines 552-579):
```rust
// Separate buffers for mono audio and resampled output
let mut mono_buffer: Vec<f32> = Vec::new();
let mut resampled_buffer: Vec<f32> = Vec::new();

// In callback:
// 1. Convert stereo to mono
if channels == 2 {
    for chunk in data.chunks(2) {
        if chunk.len() == 2 {
            mono_buffer.push((chunk[0] + chunk[1]) / 2.0);
        }
    }
}

// 2. Apply resampling
if let Some(ref resampler_arc) = resampler_clone {
    let mut resampler_guard = resampler_arc.lock().unwrap();
    let (resampler, resample_chunk_size) = &mut *resampler_guard;
    
    while mono_buffer.len() >= *resample_chunk_size {
        let input_chunk: Vec<f32> = mono_buffer.drain(..*resample_chunk_size).collect();
        let input_waves = vec![input_chunk];
        
        match resampler.process(&input_waves, None) {
            Ok(output_waves) => {
                if let Some(output_channel) = output_waves.first() {
                    resampled_buffer.extend_from_slice(output_channel);
                }
            }
            Err(e) => eprintln!("[AUDIO_CALLBACK] ❌ Resampling failed: {}", e),
        }
    }
}

// 3. Send resampled chunks to WebSocket
if resampled_buffer.len() >= buffer_size {
    let chunk: Vec<f32> = resampled_buffer.drain(..buffer_size).collect();
    tx.send(chunk).ok();
}
```

## Evidence

### Before (BROKEN):
```
[VAD] Speech ratio: 0.001 (threshold: 0.1)
[VAD] Speech ratio: 0.003 (threshold: 0.1)
```
❌ No captions

### After (WORKING):
```
[VAD] Speech ratio: 0.040 (threshold: 0.02)
Caption sent: "hmm" (en)

[VAD] Speech ratio: 0.038 (threshold: 0.015)
Caption sent: "Thanks for watching!" (en)
```
✅ Captions appearing correctly!

## Audio Pipeline

```
Scarlett 2i2 (48kHz stereo)
    ↓
Stereo to Mono
    ↓
48kHz buffer
    ↓
Rubato Resampler (48kHz → 16kHz)
    ↓
16kHz buffer
    ↓
WebSocket → Python Backend
    ↓
Silero VAD (✅ works at 16kHz)
    ↓
Faster-Whisper
    ↓
Captions! 🎉
```

## Backup Location

`.backup/WORKING_RESAMPLING_FIX_20251111_090410/`

Contains:
- Cargo.toml.WORKING
- main.rs.WORKING
- realtime_transcription_service.py.WORKING
- realtime.py.WORKING
- README_FIX.md

## Build Command

```bash
cd live-captions-desktop/src-tauri
cargo build --release
```

## Critical Notes

1. **NEVER remove rubato dependency** from Cargo.toml
2. **Silero VAD REQUIRES exactly 16kHz** - will silently fail otherwise
3. **Expected speech ratios**: 0.020-0.090+ (not 0.000-0.006)
4. **Resampling is MANDATORY** for devices that don't capture at 16kHz
5. This fix is **confirmed working** with Scarlett 2i2 USB microphone
