// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDED PYTHON BACKEND MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Manages the lifecycle of the embedded Python FastAPI backend process:
// - Finds available port dynamically
// - Spawns Python process with correct environment
// - Health checks until ready
// - Graceful shutdown on app exit

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;
use tokio::time::sleep;
use tauri::{AppHandle, Emitter, Manager};

/// Progress update payload for frontend setup screen
#[derive(serde::Serialize, Clone)]
pub struct SetupProgress {
    pub stage: String,
    pub percent: u32,
    pub detail: Option<String>,
}

/// Emit setup progress to frontend
fn emit_progress(app_handle: &AppHandle, stage: &str, percent: u32, detail: Option<&str>) {
    let _ = app_handle.emit("setup-progress", SetupProgress {
        stage: stage.to_string(),
        percent,
        detail: detail.map(|s| s.to_string()),
    });
    println!("📊 Setup progress: {}% - {}", percent, stage);
}

/// Strip Windows extended-length path prefix (\\?\) to fix Command::new() issues
/// This is necessary because Command::new() doesn't handle \\?\ prefix well with spaces
#[cfg(target_os = "windows")]
fn normalize_path(path: &Path) -> PathBuf {
    let path_str = path.to_string_lossy();
    if path_str.starts_with(r"\\?\") {
        PathBuf::from(&path_str[4..])
    } else {
        path.to_path_buf()
    }
}

#[cfg(not(target_os = "windows"))]
fn normalize_path(path: &Path) -> PathBuf {
    path.to_path_buf()
}

/// Backend manager state - holds the Python process and connection details
#[allow(dead_code)]
pub struct BackendManager {
    process: Option<Child>,
    port: u16,
    backend_url: String,
}

impl BackendManager {
    /// Ensure Python environment is extracted from bundled archive (first-run only)
    fn ensure_python_extracted(resources_dir: &PathBuf, app_handle: &AppHandle) -> Result<PathBuf, String> {
        let python_dir = resources_dir.join("python-embed");
        let python_zip = resources_dir.join("python-embed.zip");

        // If python-embed directory already exists, we're good
        if python_dir.exists() && python_dir.join("python.exe").exists() {
            println!("✓ Python environment already extracted");
            emit_progress(app_handle, "Python environment ready", 10, None);
            return Ok(python_dir);
        }

        emit_progress(app_handle, "Extracting Python environment...", 5, Some("First-time setup - this may take 30-60 seconds"));
        println!("📦 First run detected - extracting Python environment...");

        // Validate ZIP exists
        if !python_zip.exists() {
            return Err(format!(
                "Python archive not found at: {:?}\nPlease ensure python-embed.zip is bundled correctly.",
                python_zip
            ));
        }

        // Extract using PowerShell (Windows-only for now)
        #[cfg(target_os = "windows")]
        {
            println!("⏳ Extracting python-embed.zip (this may take 30-60 seconds)...");

            // Normalize paths to remove \\?\ prefix for PowerShell compatibility
            let python_zip_normalized = normalize_path(&python_zip);
            let resources_dir_normalized = normalize_path(resources_dir);

            let output = Command::new("powershell.exe")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-Command")
                .arg(format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    python_zip_normalized.display(),
                    resources_dir_normalized.display()
                ))
                .output()
                .map_err(|e| format!("Failed to run PowerShell extraction: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Python extraction failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }

            println!("✓ Python environment extracted successfully");
        }

        #[cfg(not(target_os = "windows"))]
        {
            return Err("Python extraction not implemented for non-Windows platforms yet".to_string());
        }

        // Verify extraction (skip check on Windows due to long path issues)
        // The extraction may succeed but .exists() fails with paths > 260 chars
        #[cfg(not(target_os = "windows"))]
        {
            if !python_dir.join("python.exe").exists() {
                return Err(format!(
                    "Python extraction completed but python.exe not found at: {:?}",
                    python_dir.join("python.exe")
                ));
            }
        }

        emit_progress(app_handle, "Python environment extracted", 10, None);
        println!("✓ Python environment ready at: {:?}", python_dir);
        Ok(python_dir)
    }

    /// Ensure backend is extracted from bundled archive (first-run only)
    fn ensure_backend_extracted(resources_dir: &PathBuf, app_handle: &AppHandle) -> Result<PathBuf, String> {
        let backend_dir = resources_dir.join("backend");
        let backend_zip = resources_dir.join("backend.zip");

        // If backend directory already exists, we're good
        if backend_dir.exists() && backend_dir.join("app").exists() {
            println!("✓ Backend already extracted");
            emit_progress(app_handle, "Backend files ready", 20, None);
            return Ok(backend_dir);
        }

        emit_progress(app_handle, "Extracting backend files...", 15, None);
        println!("📦 First run detected - extracting backend...");

        // Validate ZIP exists
        if !backend_zip.exists() {
            return Err(format!(
                "Backend archive not found at: {:?}\\nPlease ensure backend.zip is bundled correctly.",
                backend_zip
            ));
        }

        // Extract using PowerShell (Windows-only for now)
        #[cfg(target_os = "windows")]
        {
            println!("⏳ Extracting backend.zip...");

            // Normalize paths to remove \\?\ prefix for PowerShell compatibility
            let backend_zip_normalized = normalize_path(&backend_zip);
            let resources_dir_normalized = normalize_path(resources_dir);

            // Extract to resources_dir (the zip contains "backend/" folder already)
            let output = Command::new("powershell.exe")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-Command")
                .arg(format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    backend_zip_normalized.display(),
                    resources_dir_normalized.display()
                ))
                .output()
                .map_err(|e| format!("Failed to run PowerShell extraction: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Backend extraction failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }

            println!("✓ Backend extracted successfully");
        }

        #[cfg(not(target_os = "windows"))]
        {
            return Err("Backend extraction not implemented for non-Windows platforms yet".to_string());
        }

        // Verify extraction (skip check on Windows due to long path issues)
        // The extraction may succeed but .exists() fails with paths > 260 chars
        #[cfg(not(target_os = "windows"))]
        {
            if !backend_dir.join("app").exists() {
                return Err(format!(
                    "Backend extraction completed but app/ directory not found at: {:?}",
                    backend_dir.join("app")
                ));
            }
        }

        emit_progress(app_handle, "Backend files extracted", 20, None);
        println!("✓ Backend files ready at: {:?}", backend_dir);
        Ok(backend_dir)
    }

    /// Install Python dependencies on first run
    fn install_dependencies(python_dir: &PathBuf, backend_dir: &PathBuf, app_handle: &AppHandle) -> Result<(), String> {
        let deps_marker = python_dir.join(".deps_installed");

        // Skip if already installed
        if deps_marker.exists() {
            println!("✓ Dependencies already installed");
            emit_progress(app_handle, "Dependencies ready", 50, None);
            return Ok(());
        }

        emit_progress(app_handle, "Installing dependencies...", 30, Some("This may take several minutes on first launch"));
        println!("📦 First run detected - installing Python dependencies...");
        println!("⏳ This may take 2-3 minutes...");

        let python_exe = python_dir.join("python.exe");
        let requirements_txt = backend_dir.join("app").join("requirements.txt");

        // Check if requirements.txt exists
        if !requirements_txt.exists() {
            println!("⚠ No requirements.txt found, skipping dependency installation");
            // Create marker anyway to avoid repeated checks
            let _ = fs::write(&deps_marker, "");
            emit_progress(app_handle, "Dependencies ready", 50, None);
            return Ok(());
        }

        #[cfg(target_os = "windows")]
        {
            // Normalize paths to remove \\?\ prefix for Command::new() compatibility
            let python_exe_normalized = normalize_path(&python_exe);
            let requirements_txt_normalized = normalize_path(&requirements_txt);

            let output = Command::new(&python_exe_normalized)
                .arg("-m")
                .arg("pip")
                .arg("install")
                .arg("-r")
                .arg(&requirements_txt_normalized)
                .arg("--no-warn-script-location")
                .output()
                .map_err(|e| format!("Failed to run pip install: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Dependency installation failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }

            println!("✓ Dependencies installed successfully");
        }

        #[cfg(not(target_os = "windows"))]
        {
            return Err("Dependency installation not implemented for non-Windows platforms yet".to_string());
        }

        // Create marker file to indicate successful installation
        fs::write(&deps_marker, "").map_err(|e| format!("Failed to create deps marker: {}", e))?;

        emit_progress(app_handle, "Dependencies installed", 50, None);
        Ok(())
    }

    /// Check if CUDA torch is installed, if not download and install it (one-time setup)
    async fn ensure_cuda_torch(python_dir: &PathBuf, app_handle: &AppHandle) -> Result<(), String> {
        let python_exe = python_dir.join("python.exe");
        let python_exe_normalized = normalize_path(&python_exe);

        // Check for CUDA marker file
        let cuda_marker = python_dir.join(".cuda_torch_installed");
        if cuda_marker.exists() {
            println!("✓ CUDA PyTorch already installed");
            emit_progress(app_handle, "GPU support ready", 70, None);
            return Ok(());
        }

        emit_progress(app_handle, "Checking GPU support...", 55, None);
        // Check if CUDA is available on the system
        println!("🔍 Checking for NVIDIA GPU...");

        let check_cuda = Command::new(&python_exe_normalized)
            .arg("-c")
            .arg("import torch; print('cuda' if torch.cuda.is_available() else 'cpu')")
            .output();

        match check_cuda {
            Ok(output) => {
                let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if result == "cuda" {
                    println!("✓ CUDA PyTorch already available");
                    // Create marker so we don't check again
                    let _ = fs::write(&cuda_marker, "cuda");
                    emit_progress(app_handle, "GPU acceleration enabled", 70, None);
                    return Ok(());
                }
            }
            Err(_) => {
                // torch not installed yet, will install below
            }
        }

        // Check if NVIDIA GPU exists using nvidia-smi
        let nvidia_check = Command::new("nvidia-smi")
            .arg("--query-gpu=name")
            .arg("--format=csv,noheader")
            .output();

        let has_nvidia = match nvidia_check {
            Ok(output) => output.status.success() && !output.stdout.is_empty(),
            Err(_) => false,
        };

        if !has_nvidia {
            println!("ℹ No NVIDIA GPU detected - using CPU mode");
            let _ = fs::write(&cuda_marker, "cpu");
            emit_progress(app_handle, "Using CPU mode (no GPU detected)", 70, None);
            return Ok(());
        }

        println!("✓ NVIDIA GPU detected!");
        emit_progress(app_handle, "Downloading CUDA PyTorch...", 60, Some("One-time download (~2.5GB) - this may take a few minutes"));
        println!("📦 Downloading CUDA PyTorch (one-time setup, ~2.5GB)...");
        println!("   This may take a few minutes depending on your internet speed...");

        // Uninstall CPU torch first
        let _ = Command::new(&python_exe_normalized)
            .arg("-m")
            .arg("pip")
            .arg("uninstall")
            .arg("-y")
            .arg("torch")
            .output();

        // Install CUDA torch (cu121 for CUDA 12.1, widely compatible)
        let install_output = Command::new(&python_exe_normalized)
            .arg("-m")
            .arg("pip")
            .arg("install")
            .arg("torch")
            .arg("--index-url")
            .arg("https://download.pytorch.org/whl/cu121")
            .output()
            .map_err(|e| format!("Failed to run pip install: {}", e))?;

        if !install_output.status.success() {
            let stderr = String::from_utf8_lossy(&install_output.stderr);
            eprintln!("⚠ CUDA torch installation failed: {}", stderr);
            eprintln!("   Falling back to CPU mode");

            emit_progress(app_handle, "GPU setup failed, using CPU mode", 70, Some("Performance may be reduced"));

            // Reinstall CPU torch
            let _ = Command::new(&python_exe_normalized)
                .arg("-m")
                .arg("pip")
                .arg("install")
                .arg("torch")
                .arg("--index-url")
                .arg("https://download.pytorch.org/whl/cpu")
                .output();

            let _ = fs::write(&cuda_marker, "cpu_fallback");
            return Ok(());
        }

        println!("✓ CUDA PyTorch installed successfully!");

        // Verify CUDA is working
        let verify = Command::new(&python_exe_normalized)
            .arg("-c")
            .arg("import torch; print('CUDA available:', torch.cuda.is_available())")
            .output();

        if let Ok(output) = verify {
            println!("   {}", String::from_utf8_lossy(&output.stdout).trim());
        }

        // Create marker
        let _ = fs::write(&cuda_marker, "cuda_installed");

        emit_progress(app_handle, "GPU acceleration enabled", 70, None);
        Ok(())
    }

    /// Create a new backend manager and start the Python backend
    pub async fn new(app_handle: &AppHandle) -> Result<Self, String> {
        println!("🐍 Initializing embedded Python backend...");
        emit_progress(app_handle, "Initializing...", 0, Some("Starting Stygian backend"));

        // Find an available port
        let port = Self::find_available_port()?;
        println!("✓ Found available port: {}", port);

        // Get resource paths
        let resources_dir = app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;

        // Ensure Python is extracted (first-run only)
        let python_dir = Self::ensure_python_extracted(&resources_dir, app_handle)?;

        // Ensure backend is extracted (first-run only)
        let backend_dir = Self::ensure_backend_extracted(&resources_dir, app_handle)?;

        // Install dependencies from requirements.txt (first-run only)
        Self::install_dependencies(&python_dir, &backend_dir, app_handle)?;

        // Check and install CUDA torch if needed (one-time download)
        Self::ensure_cuda_torch(&python_dir, app_handle).await?;

        let python_exe = python_dir.join("python.exe");
        let main_py = backend_dir.join("app").join("main.py");

        // Validate paths exist (skip on Windows due to long path issues with .exists())
        #[cfg(not(target_os = "windows"))]
        {
            if !python_exe.exists() {
                return Err(format!(
                    "Python executable not found at: {:?}\nPlease ensure python-embed is bundled correctly.",
                    python_exe
                ));
            }

            if !main_py.exists() {
                return Err(format!(
                    "Backend main.py not found at: {:?}\nPlease ensure backend is bundled correctly.",
                    main_py
                ));
            }
        }

        // Normalize paths to remove \\?\ prefix for Command::new() compatibility
        let python_exe_normalized = normalize_path(&python_exe);
        let main_py_normalized = normalize_path(&main_py);
        let backend_dir_normalized = normalize_path(&backend_dir);

        println!("✓ Python executable: {:?}", python_exe_normalized);
        println!("✓ Backend directory: {:?}", backend_dir_normalized);
        println!("✓ Main script: {:?}", main_py_normalized);

        emit_progress(app_handle, "Starting backend server...", 80, None);

        // Spawn Python process using module syntax for proper imports
        let process = Command::new(&python_exe_normalized)
            .arg("-u") // Unbuffered output for real-time logs
            .arg("-m")
            .arg("app.main")
            .current_dir(&backend_dir_normalized)
            .env("API_PORT", port.to_string())
            .env("API_HOST", "127.0.0.1") // Localhost only for security
            .env("ENV", "production") // Production mode (no SSL, no reload)
            .env("PYTHONPATH", backend_dir_normalized.to_string_lossy().to_string())
            .env("PYTHONIOENCODING", "utf-8") // Ensure UTF-8 encoding
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Python process: {}", e))?;

        println!("✓ Python backend process spawned (PID: {:?})", process.id());

        let backend_url = format!("http://127.0.0.1:{}", port);

        let mut manager = BackendManager {
            process: Some(process),
            port,
            backend_url,
        };

        // Wait for backend to be ready
        manager.wait_for_health(app_handle).await?;

        // Emit setup complete event
        emit_progress(app_handle, "Ready!", 100, None);
        let _ = app_handle.emit("setup-complete", ());

        Ok(manager)
    }

    /// Get the backend URL for frontend connections
    pub fn get_backend_url(&self) -> String {
        self.backend_url.clone()
    }

    /// Get the port number the backend is running on
    #[allow(dead_code)]
    pub fn get_port(&self) -> u16 {
        self.port
    }

    /// Find an available port in the range 8000-9000
    fn find_available_port() -> Result<u16, String> {
        use std::net::TcpListener;

        println!("🔍 Searching for available port (8000-9000)...");

        for port in 8000..=9000 {
            if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) {
                drop(listener); // Release the port immediately
                println!("✓ Port {} is available", port);
                return Ok(port);
            }
        }

        Err("No available ports in range 8000-9000. Please close some applications.".to_string())
    }

    /// Wait for backend health endpoint to respond (max 600 seconds for first-launch setup)
    /// This timeout is generous because:
    /// - First launch may require pip install of large packages (torch ~2GB)
    /// - Model loading (Whisper) can take 30-60 seconds
    /// - CUDA initialization adds overhead
    async fn wait_for_health(&mut self, app_handle: &AppHandle) -> Result<(), String> {
        emit_progress(app_handle, "Starting AI models...", 85, Some("Loading Whisper transcription model"));
        println!("⏳ Waiting for backend to start (this may take a few minutes on first launch)...");

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let health_url = format!("{}/health", self.backend_url);
        let max_attempts = 600; // 10 minutes max for first-launch scenarios

        for attempt in 1..=max_attempts {
            // Check if process is still alive
            if let Some(ref mut process) = self.process {
                if let Ok(Some(status)) = process.try_wait() {
                    // Capture stdout and stderr before returning error
                    let mut stderr_output = String::new();
                    let mut stdout_output = String::new();

                    if let Some(stderr) = process.stderr.as_mut() {
                        use std::io::Read;
                        let _ = stderr.read_to_string(&mut stderr_output);
                    }

                    if let Some(stdout) = process.stdout.as_mut() {
                        use std::io::Read;
                        let _ = stdout.read_to_string(&mut stdout_output);
                    }

                    eprintln!("❌ Backend process output:");
                    if !stdout_output.is_empty() {
                        eprintln!("STDOUT:\n{}", stdout_output);
                    }
                    if !stderr_output.is_empty() {
                        eprintln!("STDERR:\n{}", stderr_output);
                    }

                    return Err(format!(
                        "Backend process exited unexpectedly with status: {:?}\n\nSTDOUT:\n{}\n\nSTDERR:\n{}",
                        status, stdout_output, stderr_output
                    ));
                }
            }

            // Try health check
            match client.get(&health_url).send().await {
                Ok(response) if response.status().is_success() => {
                    println!("✓ Backend is healthy! (took {} seconds)", attempt);
                    println!("✓ Backend ready at: {}", self.backend_url);
                    emit_progress(app_handle, "Backend ready!", 95, None);
                    return Ok(());
                }
                Ok(response) => {
                    println!(
                        "⚠ Health check returned status: {} (attempt {}/{})",
                        response.status(),
                        attempt,
                        max_attempts
                    );
                }
                Err(_e) => {
                    // Update frontend progress every 10 seconds
                    if attempt % 10 == 0 {
                        let elapsed_secs = attempt;
                        let detail = format!("Waiting for AI models... ({} seconds)", elapsed_secs);
                        emit_progress(app_handle, "Loading AI models...", 90, Some(&detail));
                    }
                    // Show progress every 30 seconds, or on first attempt
                    if attempt == 1 || attempt % 30 == 0 {
                        let minutes = attempt / 60;
                        let seconds = attempt % 60;
                        if minutes > 0 {
                            println!("⏳ Still waiting for backend... ({}m {}s elapsed)", minutes, seconds);
                        } else {
                            println!("⏳ Waiting for backend... ({} seconds elapsed)", attempt);
                        }
                    }
                }
            }

            sleep(Duration::from_secs(1)).await;
        }

        Err(format!(
            "Backend failed to become healthy after {} seconds. Check logs at: {:?}",
            max_attempts,
            self.backend_url
        ))
    }

    /// Gracefully shutdown the Python backend process
    pub fn shutdown(&mut self) {
        if let Some(mut process) = self.process.take() {
            println!("🛑 Shutting down Python backend (PID: {:?})...", process.id());

            // Try graceful shutdown first (send SIGTERM on Unix, close on Windows)
            #[cfg(target_os = "windows")]
            {
                // On Windows, kill() sends SIGKILL (forceful)
                // We don't have a graceful shutdown mechanism built-in, so just kill it
                let _ = process.kill();
            }

            #[cfg(not(target_os = "windows"))]
            {
                use std::os::unix::process::CommandExt;
                // On Unix, we can send SIGTERM for graceful shutdown
                let _ = nix::sys::signal::kill(
                    nix::unistd::Pid::from_raw(process.id() as i32),
                    nix::sys::signal::Signal::SIGTERM,
                );
            }

            // Wait up to 5 seconds for process to exit
            let start = std::time::Instant::now();
            loop {
                match process.try_wait() {
                    Ok(Some(status)) => {
                        println!("✓ Backend exited with status: {:?}", status);
                        break;
                    }
                    Ok(None) => {
                        if start.elapsed() > Duration::from_secs(5) {
                            println!("⚠ Backend did not exit gracefully, force killing...");
                            let _ = process.kill();
                            let _ = process.wait();
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => {
                        println!("⚠ Error waiting for backend exit: {}", e);
                        break;
                    }
                }
            }

            println!("✓ Backend shutdown complete");
        }
    }
}

impl Drop for BackendManager {
    fn drop(&mut self) {
        // Ensure cleanup on drop (e.g., if panic occurs)
        self.shutdown();
    }
}
