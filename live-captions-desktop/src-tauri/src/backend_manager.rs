// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDED PYTHON BACKEND MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Manages the lifecycle of the embedded Python FastAPI backend process:
// - Finds available port dynamically
// - Spawns Python process with correct environment
// - Health checks until ready
// - Graceful shutdown on app exit

use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;
use tokio::time::sleep;
use tauri::{AppHandle, Manager};

/// Backend manager state - holds the Python process and connection details
#[allow(dead_code)]
pub struct BackendManager {
    process: Option<Child>,
    port: u16,
    backend_url: String,
}

impl BackendManager {
    /// Ensure Python environment is extracted from bundled archive (first-run only)
    fn ensure_python_extracted(resources_dir: &PathBuf) -> Result<PathBuf, String> {
        let python_dir = resources_dir.join("python-embed");
        let python_zip = resources_dir.join("python-embed.zip");

        // If python-embed directory already exists, we're good
        if python_dir.exists() && python_dir.join("python.exe").exists() {
            println!("✓ Python environment already extracted");
            return Ok(python_dir);
        }

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

            let output = Command::new("powershell.exe")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-Command")
                .arg(format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    python_zip.display(),
                    resources_dir.display()
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

        // Verify extraction
        if !python_dir.join("python.exe").exists() {
            return Err(format!(
                "Python extraction completed but python.exe not found at: {:?}",
                python_dir.join("python.exe")
            ));
        }

        Ok(python_dir)
    }

    /// Ensure backend is extracted from bundled archive (first-run only)
    fn ensure_backend_extracted(resources_dir: &PathBuf) -> Result<PathBuf, String> {
        let backend_dir = resources_dir.join("backend");
        let backend_zip = resources_dir.join("backend.zip");

        // If backend directory already exists, we're good
        if backend_dir.exists() && backend_dir.join("app").exists() {
            println!("✓ Backend already extracted");
            return Ok(backend_dir);
        }

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

            let output = Command::new("powershell.exe")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-Command")
                .arg(format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    backend_zip.display(),
                    resources_dir.display()
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

        // Verify extraction
        if !backend_dir.join("app").exists() {
            return Err(format!(
                "Backend extraction completed but app/ directory not found at: {:?}",
                backend_dir.join("app")
            ));
        }

        Ok(backend_dir)
    }

    /// Install Python dependencies on first run
    fn install_dependencies(python_dir: &PathBuf, backend_dir: &PathBuf) -> Result<(), String> {
        let deps_marker = python_dir.join(".deps_installed");

        // Skip if already installed
        if deps_marker.exists() {
            println!("✓ Dependencies already installed");
            return Ok(());
        }

        println!("📦 First run detected - installing Python dependencies...");
        println!("⏳ This may take 2-3 minutes...");

        let python_exe = python_dir.join("python.exe");
        let requirements_txt = backend_dir.join("app").join("requirements.txt");

        // Check if requirements.txt exists
        if !requirements_txt.exists() {
            println!("⚠ No requirements.txt found, skipping dependency installation");
            // Create marker anyway to avoid repeated checks
            let _ = fs::write(&deps_marker, "");
            return Ok(());
        }

        #[cfg(target_os = "windows")]
        {
            let output = Command::new(&python_exe)
                .arg("-m")
                .arg("pip")
                .arg("install")
                .arg("-r")
                .arg(&requirements_txt)
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

        Ok(())
    }

    /// Create a new backend manager and start the Python backend
    pub async fn new(app_handle: &AppHandle) -> Result<Self, String> {
        println!("🐍 Initializing embedded Python backend...");

        // Find an available port
        let port = Self::find_available_port()?;
        println!("✓ Found available port: {}", port);

        // Get resource paths
        let resources_dir = app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;

        // Ensure Python is extracted (first-run only)
        let python_dir = Self::ensure_python_extracted(&resources_dir)?;

        // Ensure backend is extracted (first-run only)
        let backend_dir = Self::ensure_backend_extracted(&resources_dir)?;

        // Install Python dependencies (first-run only)
        Self::install_dependencies(&python_dir, &backend_dir)?;

        let python_exe = python_dir.join("python.exe");
        let main_py = backend_dir.join("app").join("main.py");

        // Validate paths exist
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

        println!("✓ Python executable: {:?}", python_exe);
        println!("✓ Backend directory: {:?}", backend_dir);
        println!("✓ Main script: {:?}", main_py);

        // Spawn Python process
        let process = Command::new(&python_exe)
            .arg("-u") // Unbuffered output for real-time logs
            .arg(main_py)
            .current_dir(&backend_dir)
            .env("API_PORT", port.to_string())
            .env("API_HOST", "127.0.0.1") // Localhost only for security
            .env("ENV", "production") // Production mode (no SSL, no reload)
            .env("PYTHONPATH", &backend_dir)
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
        manager.wait_for_health().await?;

        Ok(manager)
    }

    /// Get the backend URL for frontend connections
    pub fn get_backend_url(&self) -> String {
        self.backend_url.clone()
    }

    /// Get the port number the backend is running on
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

    /// Wait for backend health endpoint to respond (max 60 seconds)
    async fn wait_for_health(&mut self) -> Result<(), String> {
        println!("⏳ Waiting for backend health check...");

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let health_url = format!("{}/health", self.backend_url);

        for attempt in 1..=60 {
            // Check if process is still alive
            if let Some(ref mut process) = self.process {
                if let Ok(Some(status)) = process.try_wait() {
                    return Err(format!(
                        "Backend process exited unexpectedly with status: {:?}",
                        status
                    ));
                }
            }

            // Try health check
            match client.get(&health_url).send().await {
                Ok(response) if response.status().is_success() => {
                    println!("✓ Backend is healthy! (attempt {}/60)", attempt);
                    println!("✓ Backend ready at: {}", self.backend_url);
                    return Ok(());
                }
                Ok(response) => {
                    println!(
                        "⚠ Health check returned status: {} (attempt {}/60)",
                        response.status(),
                        attempt
                    );
                }
                Err(e) => {
                    if attempt == 1 || attempt % 10 == 0 {
                        println!("⏳ Waiting for backend... (attempt {}/60): {}", attempt, e);
                    }
                }
            }

            sleep(Duration::from_secs(1)).await;
        }

        Err(format!(
            "Backend failed to become healthy after 60 seconds. Check logs at: {:?}",
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
