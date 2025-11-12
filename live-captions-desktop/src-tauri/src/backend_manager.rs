// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDED PYTHON BACKEND MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Manages the lifecycle of the embedded Python FastAPI backend process:
// - Finds available port dynamically
// - Spawns Python process with correct environment
// - Health checks until ready
// - Graceful shutdown on app exit

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

        let python_exe = resources_dir.join("python-embed").join("python.exe");
        let backend_dir = resources_dir.join("backend");
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
