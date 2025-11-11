// Prevents additional console window on Windows in release mode
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri::tray::TrayIconBuilder;
use tokio::sync::{mpsc, Mutex as TokioMutex};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};

#[derive(Clone, Serialize, Deserialize)]
struct CaptionPayload {
    text: String,
    language: String,
    timestamp: u64,
}

#[derive(Clone, Serialize, Deserialize)]
struct StatusPayload {
    status: String,
    message: String,
}

#[derive(Clone)]
struct AppState {
    is_capturing: Arc<Mutex<bool>>,
    ws_tx: Arc<Mutex<Option<mpsc::UnboundedSender<Vec<f32>>>>>,
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART LAUNCHER - Docker Detection & Auto-Start
// ═══════════════════════════════════════════════════════════════════════════

/// Check if Docker Desktop is running
fn check_docker_running() -> bool {
    println!("🔍 Checking if Docker is running...");

    #[cfg(target_os = "windows")]
    {
        // Check if Docker Desktop process is running on Windows
        let output = Command::new("tasklist")
            .args(&["/FI", "IMAGENAME eq Docker Desktop.exe"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return stdout.contains("Docker Desktop.exe");
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Check if docker daemon is running on Unix
        let output = Command::new("docker")
            .arg("info")
            .output();

        return output.is_ok() && output.unwrap().status.success();
    }

    false
}

/// Check if backend container is running
fn check_backend_container() -> bool {
    println!("🔍 Checking if backend container is running...");

    let output = Command::new("docker")
        .args(&["ps", "--filter", "name=transcription-backend", "--format", "{{.Names}}"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        return stdout.contains("transcription-backend");
    }

    false
}

/// Check backend health endpoint
async fn check_backend_health() -> bool {
    match reqwest::get("http://localhost:8000/health").await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

/// Start Docker backend using docker-compose
async fn start_docker_backend(project_dir: &str) -> Result<(), String> {
    println!("🚀 Starting Docker backend...");

    let output = Command::new("docker-compose")
        .current_dir(project_dir)
        .args(&["up", "-d"])
        .output()
        .map_err(|e| format!("Failed to execute docker-compose: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("docker-compose failed: {}", stderr));
    }

    println!("✓ Docker containers started");
    Ok(())
}

/// Initialize backend - check status, auto-start if needed, wait for health
async fn initialize_backend(app_handle: AppHandle) -> Result<(), String> {
    // Emit status: Checking Docker
    let _ = app_handle.emit("status", StatusPayload {
        status: "checking_docker".to_string(),
        message: "Checking if Docker is running...".to_string(),
    });

    // Check if Docker is running
    if !check_docker_running() {
        let _ = app_handle.emit("status", StatusPayload {
            status: "error".to_string(),
            message: "Docker Desktop is not running. Please start Docker Desktop.".to_string(),
        });
        return Err("Docker is not running".to_string());
    }

    println!("✓ Docker is running");

    // Emit status: Checking backend
    let _ = app_handle.emit("status", StatusPayload {
        status: "checking_backend".to_string(),
        message: "Checking if backend is running...".to_string(),
    });

    // Check if backend container is running
    if !check_backend_container() {
        println!("⚠ Backend container not running, starting...");

        let _ = app_handle.emit("status", StatusPayload {
            status: "starting_backend".to_string(),
            message: "Starting transcription backend...".to_string(),
        });

        // Get project directory (parent of live-captions-desktop)
        let project_dir = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .parent()
            .ok_or("Failed to get parent directory")?
            .to_str()
            .ok_or("Invalid path")?
            .to_string();

        start_docker_backend(&project_dir).await?;
    }

    println!("✓ Backend container is running");

    // Emit status: Waiting for health
    let _ = app_handle.emit("status", StatusPayload {
        status: "waiting_health".to_string(),
        message: "Waiting for backend to be ready...".to_string(),
    });

    // Poll health endpoint until ready (max 60 seconds)
    for i in 0..60 {
        if check_backend_health().await {
            println!("✓ Backend is healthy!");

            let _ = app_handle.emit("status", StatusPayload {
                status: "ready".to_string(),
                message: "Backend ready! You can start capturing.".to_string(),
            });

            return Ok(());
        }

        println!("⏳ Waiting for backend health... ({}/60)", i + 1);
        sleep(Duration::from_secs(1)).await;
    }

    // Timeout
    let _ = app_handle.emit("status", StatusPayload {
        status: "error".to_string(),
        message: "Backend failed to start within 60 seconds.".to_string(),
    });

    Err("Backend health check timeout".to_string())
}

#[tauri::command]
async fn start_capture(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    device_type: String,
) -> Result<String, String> {
    let mut is_capturing = state.is_capturing.lock().unwrap();

    if *is_capturing {
        return Ok("Already capturing".to_string());
    }

    *is_capturing = true;
    drop(is_capturing);

    println!("✓ Live capture enabled - captions will emit to main window");

    // Start WebSocket connection
    let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<Vec<f32>>();
    *state.ws_tx.lock().unwrap() = Some(audio_tx);

    // Spawn WebSocket task
    let app_handle_ws = app_handle.clone();
    let task_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() % 100000000;
    println!("[WS_TASK_{}] Spawning WebSocket task...", task_id);

    tokio::spawn(async move {
        println!("[WS_TASK_{}] Task started, connecting...", task_id);
        match connect_async("ws://localhost:8000/ws/realtime").await {
            Ok((ws_stream, _)) => {
                println!("[WS_TASK_{}] ✓ Connected to WebSocket", task_id);

                let (mut write, mut read) = ws_stream.split();

                // Send initial config
                let config = serde_json::json!({
                    "type": "config",
                    "language": null,
                    "model_size": "tiny"
                });
                let _ = write.send(Message::Text(config.to_string())).await;

                // Spawn audio sender task
                let write = Arc::new(TokioMutex::new(write));
                let write_clone = write.clone();

                tokio::spawn(async move {
                    println!("[AUDIO_RX] Audio receiver task started, waiting for chunks...");
                    let mut chunk_count = 0;
                    while let Some(audio_chunk) = audio_rx.recv().await {
                        chunk_count += 1;
                        if chunk_count == 1 {
                            println!("[AUDIO_RX] ✓ First chunk received from channel!");
                        }
                        if chunk_count % 10 == 0 {
                            println!("[AUDIO_RX] Received {} chunks from channel, sending to WebSocket", chunk_count);
                        }

                        // Convert f32 samples to bytes (Float32Array format)
                        let bytes: Vec<u8> = audio_chunk
                            .iter()
                            .flat_map(|&f| f.to_le_bytes())
                            .collect();

                        // Lock with tokio async mutex, send, and await
                        let mut write_guard = write_clone.lock().await;
                        match write_guard.send(Message::Binary(bytes.clone())).await {
                            Ok(_) => {
                                if chunk_count % 10 == 0 {
                                    println!("[AUDIO_RX] ✓ Sent {} chunks to WebSocket ({} bytes)", chunk_count, bytes.len());
                                }
                            }
                            Err(e) => {
                                eprintln!("[AUDIO_RX] ❌ Failed to send audio to WebSocket: {}", e);
                                break;
                            }
                        }
                        drop(write_guard); // Explicit drop to release lock quickly
                    }
                    println!("[AUDIO_RX] ⚠ Audio receiver loop exited (channel closed)");
                });

                // Receive captions
                while let Some(msg) = read.next().await {
                    println!("[WS] Received message from backend");

                    match msg {
                        Ok(Message::Text(text)) => {
                            println!("[WS] Message type: Text");
                            println!("[WS] Raw text: {}", text);

                            match serde_json::from_str::<serde_json::Value>(&text) {
                                Ok(data) => {
                                    println!("[WS] JSON parsed successfully");
                                    println!("[WS] Message type field: {:?}", data.get("type"));

                                    if data["type"] == "caption" {
                                        println!("[WS] ✓ Caption message detected");
                                        let caption = CaptionPayload {
                                            text: data["text"].as_str().unwrap_or("").to_string(),
                                            language: data["language"].as_str().unwrap_or("en").to_string(),
                                            timestamp: data["timestamp"].as_u64().unwrap_or(0),
                                        };

                                        println!("📝 Caption: {}", caption.text);

                                        // Emit to the MAIN window
                                        println!("[EMIT] Emitting caption to main window...");
                                        match app_handle_ws.emit("caption", &caption) {
                                            Ok(_) => println!("✓ Caption emitted to main window successfully"),
                                            Err(e) => eprintln!("❌ Failed to emit caption: {}", e),
                                        }
                                    } else {
                                        println!("[WS] Skipping non-caption message (type: {:?})", data.get("type"));
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[WS] ❌ JSON parsing failed: {}", e);
                                    eprintln!("[WS] Raw text was: {}", text);
                                }
                            }
                        }
                        Ok(Message::Binary(bytes)) => {
                            println!("[WS] Message type: Binary ({} bytes)", bytes.len());
                        }
                        Ok(Message::Ping(_)) => {
                            println!("[WS] Message type: Ping");
                        }
                        Ok(Message::Pong(_)) => {
                            println!("[WS] Message type: Pong");
                        }
                        Ok(Message::Close(_)) => {
                            println!("[WS] Message type: Close");
                            break;
                        }
                        Ok(msg) => {
                            println!("[WS] Message type: Other ({:?})", msg);
                        }
                        Err(e) => {
                            eprintln!("[WS] ❌ Error receiving message: {}", e);
                            break;
                        }
                    }
                }
                println!("[WS_TASK_{}] ⚠ WebSocket receive loop exited", task_id);
            }
            Err(e) => {
                eprintln!("[WS_TASK_{}] ❌ WebSocket connection failed: {}", task_id, e);
            }
        }
        println!("[WS_TASK_{}] Task ending", task_id);
    });

    // Start audio capture
    let state_clone = state.inner().clone();
    let device_type_clone = device_type.clone();
    std::thread::spawn(move || {
        capture_system_audio(state_clone, device_type_clone);
    });

    Ok("Capture started".to_string())
}

#[tauri::command]
async fn stop_capture(_app_handle: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let mut is_capturing = state.is_capturing.lock().unwrap();
    *is_capturing = false;
    *state.ws_tx.lock().unwrap() = None;

    println!("✓ Capture stopped");

    Ok("Capture stopped".to_string())
}


fn capture_system_audio(state: AppState, device_type: String) {
    let is_microphone = device_type == "microphone";

    if is_microphone {
        println!("🎤 Starting microphone capture...");
    } else {
        println!("🔊 Starting system audio capture...");
    }

    // Get WASAPI host explicitly on Windows for loopback support
    #[cfg(target_os = "windows")]
    let host = cpal::host_from_id(cpal::HostId::Wasapi).expect("WASAPI host");

    #[cfg(not(target_os = "windows"))]
    let host = cpal::default_host();

    // Get device based on user selection
    let device = if is_microphone {
        match host.default_input_device() {
            Some(d) => {
                println!("🎙️ Using microphone device: {}", d.name().unwrap_or_else(|_| "Unknown".to_string()));
                d
            },
            None => {
                eprintln!("❌ No microphone device found");
                return;
            }
        }
    } else {
        match host.default_output_device() {
            Some(d) => {
                println!("🔊 Using output device: {}", d.name().unwrap_or_else(|_| "Unknown".to_string()));
                d
            },
            None => {
                eprintln!("❌ No system audio device found");
                return;
            }
        }
    };

    println!("✓ Using device: {}", device.name().unwrap_or_else(|_| "Unknown".to_string()));

    // Get device config
    let config = if is_microphone {
        match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("❌ Failed to get microphone config: {}", e);
                return;
            }
        }
    } else {
        match device.default_output_config() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("❌ Failed to get system audio config: {}", e);
                return;
            }
        }
    };

    println!("✓ Sample rate: {} Hz", config.sample_rate().0);
    println!("✓ Channels: {}", config.channels());

    let stream_config = config.config();
    let channels = stream_config.channels as usize;
    let input_sample_rate = config.sample_rate().0 as usize;
    let target_sample_rate = 16000usize; // Backend expects 16kHz

    let err_fn = |err| eprintln!("❌ Stream error: {}", err);

    // Buffer size for sending resampled audio
    let buffer_size = 4096; // Send 4096 samples at a time (after resampling)

    // Create resampler if needed (48kHz → 16kHz)
    let resampler = if input_sample_rate != target_sample_rate {
        println!("🔄 Creating resampler: {} Hz → {} Hz", input_sample_rate, target_sample_rate);

        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        // Calculate chunk size for resampler (must be consistent)
        let resample_chunk_size = 4800; // Input chunk size for resampler

        match SincFixedIn::<f32>::new(
            target_sample_rate as f64 / input_sample_rate as f64,
            2.0, // max_resample_ratio_relative
            params,
            resample_chunk_size,
            1, // 1 channel (mono)
        ) {
            Ok(r) => {
                println!("✓ Resampler created successfully");
                Some(Arc::new(Mutex::new((r, resample_chunk_size))))
            }
            Err(e) => {
                eprintln!("❌ Failed to create resampler: {}", e);
                None
            }
        }
    } else {
        println!("✓ No resampling needed (already 16kHz)");
        None
    };

    // Clone Arc references for the closure
    let is_capturing_clone = state.is_capturing.clone();
    let ws_tx_clone = state.ws_tx.clone();
    let resampler_clone = resampler.clone();

    // Debug counter for callback invocations
    let mut callback_count = 0u64;
    let mut send_attempt_count = 0u64;
    let mut send_success_count = 0u64;

    // Separate buffers for mono audio and resampled output
    let mut mono_buffer: Vec<f32> = Vec::new();
    let mut resampled_buffer: Vec<f32> = Vec::new();

    let stream = match device.build_input_stream(
        &stream_config,
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            callback_count += 1;

            if callback_count.is_multiple_of(100) {
                println!("[AUDIO_CALLBACK] Invoked {} times, mono buffer: {}, resampled buffer: {}, send attempts: {}, successes: {}",
                    callback_count, mono_buffer.len(), resampled_buffer.len(), send_attempt_count, send_success_count);
            }

            if !*is_capturing_clone.lock().unwrap() {
                println!("[AUDIO_CALLBACK] Capturing stopped, returning");
                return;
            }

            // Convert stereo to mono if needed
            if channels == 2 {
                for chunk in data.chunks(2) {
                    if chunk.len() == 2 {
                        // Average left and right channels
                        mono_buffer.push((chunk[0] + chunk[1]) / 2.0);
                    }
                }
            } else {
                mono_buffer.extend_from_slice(data);
            }

            // Apply resampling if needed
            if let Some(ref resampler_arc) = resampler_clone {
                let mut resampler_guard = resampler_arc.lock().unwrap();
                let (resampler, resample_chunk_size) = &mut *resampler_guard;

                // Process full resample chunks
                while mono_buffer.len() >= *resample_chunk_size {
                    // Extract exactly resample_chunk_size samples
                    let input_chunk: Vec<f32> = mono_buffer.drain(..*resample_chunk_size).collect();

                    // Resample (convert to Vec<Vec<f32>> for rubato API)
                    let input_waves = vec![input_chunk];
                    match resampler.process(&input_waves, None) {
                        Ok(output_waves) => {
                            if let Some(output_channel) = output_waves.first() {
                                resampled_buffer.extend_from_slice(output_channel);
                            }
                        }
                        Err(e) => {
                            eprintln!("[AUDIO_CALLBACK] ❌ Resampling failed: {}", e);
                        }
                    }
                }
            } else {
                // No resampling needed, copy directly
                resampled_buffer.extend_from_slice(&mono_buffer);
                mono_buffer.clear();
            }

            // Send buffer when it reaches target size
            if resampled_buffer.len() >= buffer_size {
                send_attempt_count += 1;
                let tx_guard = ws_tx_clone.lock().unwrap();
                match tx_guard.as_ref() {
                    Some(tx) => {
                        let chunk: Vec<f32> = resampled_buffer.drain(..buffer_size).collect();
                        match tx.send(chunk) {
                            Ok(_) => {
                                send_success_count += 1;
                                if send_success_count.is_multiple_of(10) {
                                    println!("[AUDIO_CALLBACK] ✓ Sent {} resampled chunks to channel", send_success_count);
                                }
                            }
                            Err(e) => {
                                eprintln!("[AUDIO_CALLBACK] ❌ Channel send failed: {}", e);
                            }
                        }
                    }
                    None => {
                        println!("[AUDIO_CALLBACK] ⚠ ws_tx is None, cannot send (attempt {})", send_attempt_count);
                    }
                }
            }
        },
        err_fn,
        None,
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("❌ Failed to build stream: {}", e);
            return;
        }
    };

    if let Err(e) = stream.play() {
        eprintln!("❌ Failed to play stream: {}", e);
        return;
    }

    println!("✓ Audio capture running!");

    // Keep stream alive
    loop {
        std::thread::sleep(std::time::Duration::from_millis(100));
        if !*state.is_capturing.lock().unwrap() {
            break;
        }
    }
}

fn main() {
    let app_state = AppState {
        is_capturing: Arc::new(Mutex::new(false)),
        ws_tx: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .setup(|app| {
            // ═══════════════════════════════════════════════════════════════
            // SMART LAUNCHER - Initialize backend on startup
            // ═══════════════════════════════════════════════════════════════
            let app_handle = app.app_handle().clone();
            tauri::async_runtime::spawn(async move {
                match initialize_backend(app_handle).await {
                    Ok(_) => println!("✓ Smart Launcher: Backend initialized successfully"),
                    Err(e) => eprintln!("❌ Smart Launcher: Backend initialization failed: {}", e),
                }
            });

            // Create system tray
            let quit = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let start = tauri::menu::MenuItem::with_id(app, "start", "Start Captions", true, None::<&str>)?;
            let stop = tauri::menu::MenuItem::with_id(app, "stop", "Stop Captions", true, None::<&str>)?;

            let menu = tauri::menu::MenuBuilder::new(app)
                .item(&start)
                .item(&stop)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "quit" => app.exit(0),
                        "start" => {
                            let state_clone = app.state::<AppState>().inner().clone();
                            tauri::async_runtime::spawn(async move {
                                // Create a State wrapper for the cloned state
                                // Note: We'll need to refactor the functions to accept AppState directly
                                // For now, just set the is_capturing flag
                                *state_clone.is_capturing.lock().unwrap() = true;
                            });
                        }
                        "stop" => {
                            let state_clone = app.state::<AppState>().inner().clone();
                            tauri::async_runtime::spawn(async move {
                                *state_clone.is_capturing.lock().unwrap() = false;
                            });
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![start_capture, stop_capture])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
