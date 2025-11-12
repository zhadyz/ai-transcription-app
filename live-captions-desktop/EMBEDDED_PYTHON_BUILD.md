# Embedded Python Build System

This document explains how the embedded Python backend works and how to build the installer.

## Architecture

```
Stygian.msi (Installer)
├─ Stygian.exe (Tauri Desktop App)
├─ resources/
│  ├─ python-embed/ (Python 3.11 embeddable runtime ~30MB)
│  │  ├─ python.exe
│  │  ├─ python311.dll
│  │  ├─ Lib/ (standard library)
│  │  └─ Lib/site-packages/ (installed dependencies ~400MB)
│  └─ backend/ (FastAPI backend code)
│     ├─ app/
│     │  ├─ main.py (entry point)
│     │  ├─ api/
│     │  └─ services/
│     └─ requirements.txt
```

## Build Process

### Automated (Production)

The build process is automated via GitHub Actions:

```yaml
1. Checkout code
2. Install Node.js and Rust
3. Run: npm run tauri build
   └─ beforeBuildCommand executes:
      a. npm run build (Vite frontend)
      b. powershell setup-python.ps1 (downloads Python + installs deps)
4. Tauri bundles everything into Stygian.msi
5. Upload artifact to GitHub Releases
```

### Manual (Development)

#### Windows:

```powershell
# 1. Setup Python embeddable (one-time)
cd live-captions-desktop/src-tauri
powershell -ExecutionPolicy Bypass -File scripts/setup-python.ps1

# 2. Build installer
cd ..
npm run tauri build

# Output: src-tauri/target/release/bundle/msi/Stygian_1.0.1_x64_en-US.msi
```

#### Linux/macOS:

```bash
# 1. Setup Python embeddable
cd live-captions-desktop/src-tauri
./scripts/setup-python.sh  # TODO: Create Linux/Mac version

# 2. Build installer
cd ..
npm run tauri build

# Output:
# - Linux: .deb, .appimage
# - macOS: .dmg
```

## Development Mode

For development with live reload:

```bash
# Option 1: Use Docker backend (current method)
cd transcription-app
docker-compose up -d
cd live-captions-desktop
npm run tauri dev

# Option 2: Use embedded Python (after setup-python.ps1 runs)
cd live-captions-desktop
npm run tauri dev
# Rust will spawn python-embed/python.exe automatically
```

## File Structure

```
live-captions-desktop/
├─ src-tauri/
│  ├─ scripts/
│  │  └─ setup-python.ps1      # Downloads & configures Python
│  ├─ python-embed/            # NOT in Git (downloaded at build time)
│  │  ├─ python.exe
│  │  ├─ python311.dll
│  │  └─ Lib/site-packages/
│  ├─ src/
│  │  ├─ backend_manager.rs    # Spawns/manages Python process
│  │  └─ main.rs               # Tauri entry point
│  └─ tauri.conf.json          # Bundle config (includes resources)
├─ backend/                    # Backend source (IN Git)
│  ├─ app/
│  └─ requirements.txt
└─ package.json
```

## What's in Git vs. Build Artifacts

**IN GIT (source code):**
- ✅ `backend/` (FastAPI source code)
- ✅ `backend/requirements.txt`
- ✅ `src-tauri/scripts/setup-python.ps1` (build script)
- ✅ `src-tauri/src/backend_manager.rs`

**NOT IN GIT (generated at build time):**
- ❌ `src-tauri/python-embed/` (downloaded by setup-python.ps1)
- ❌ `backend/__pycache__/`
- ❌ `src-tauri/target/` (Rust build artifacts)

## Runtime Flow

1. **User installs `Stygian.msi`**
   - Copies files to `C:\Program Files\Stygian\`

2. **User launches `Stygian.exe`**
   - Rust `main()` runs
   - `BackendManager::new()` spawned
   - Finds resources: `AppHandle::path().resource_dir()`
     - `python-embed/python.exe`
     - `backend/app/main.py`

3. **Python backend starts**
   - Port: Dynamically allocated (8000-9000)
   - URL: Stored in `AppState.backend_url`
   - Health check: Polls `/health` until ready

4. **App ready**
   - Frontend gets backend URL via `invoke('get_backend_url')`
   - WebSocket connects to backend
   - Live transcription works

5. **User closes app**
   - `on_window_event()` fires
   - `BackendManager::shutdown()` terminates Python
   - Clean exit

## Installer Naming

- **Windows**: `Stygian_1.0.1_x64_en-US.msi`
- **Linux**: `stygian_1.0.1_amd64.deb`
- **macOS**: `Stygian.dmg`

## Size Estimates

| Component | Size |
|-----------|------|
| Tauri app (Rust + WebView) | ~10MB |
| Python 3.11 embeddable | ~30MB |
| Python dependencies (torch, faster-whisper, etc.) | ~400MB |
| **Total installer** | **~450MB** |
| Models (downloaded on first run) | ~500MB-1GB |

## Troubleshooting

### Build fails: "Python setup failed"
```powershell
# Manually run setup script with verbose output
cd src-tauri
powershell -ExecutionPolicy Bypass -File scripts/setup-python.ps1
```

### Runtime error: "Backend initialization failed"
- Check: `python-embed/python.exe` exists in app resources
- Check: `backend/app/main.py` exists
- Check: Ports 8000-9000 not all in use
- Logs: Check console output for Python errors

### Models not found
- Models download on first run to `AppData/Roaming/Stygian/models/`
- If download fails, manually place models in that directory

## CI/CD Pipeline

See `.github/workflows/release.yml` for automated build configuration.

**Workflow triggers:**
- On push to `main` branch
- On tag creation (`v*`)

**Build matrix:**
- Windows (x64)
- Linux (x64)
- macOS (x64, ARM64)

**Artifacts:**
- Uploaded to GitHub Releases
- Signed installers (Windows/macOS)
- Checksums provided
