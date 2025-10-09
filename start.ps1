<#
.SYNOPSIS
    Transcendent Transcription App - Unified Startup Script
.DESCRIPTION
    Starts both frontend and backend with optional ZeroCopy streaming.
    Servers run minimized - only main console visible.
#>

# Color functions
function Write-Header {
    param([string]$Text)
    Write-Host "`n===============================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor White
    Write-Host "===============================================================`n" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Info {
    param([string]$Text)
    Write-Host "[INFO] $Text" -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Text)
    Write-Host "[WARN] $Text" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

# Clear screen and show header
Clear-Host
Write-Header "AI TRANSCRIPTION APP - STARTUP"

# Get network IP - prioritize 192.168.1.x
$networkIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and
    $_.InterfaceAlias -notlike "*VMware*" -and
    $_.InterfaceAlias -notlike "*VirtualBox*" -and
    $_.InterfaceAlias -notlike "*Hyper-V*" -and
    $_.InterfaceAlias -notlike "*WSL*" -and
    $_.IPAddress -like "192.168.1.*"
}).IPAddress | Select-Object -First 1

# Fallback to any 192.168.x
if (-not $networkIP) {
    $networkIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.InterfaceAlias -notlike "*Loopback*" -and
        $_.InterfaceAlias -notlike "*VMware*" -and
        $_.InterfaceAlias -notlike "*VirtualBox*" -and
        $_.IPAddress -like "192.168.*"
    }).IPAddress | Select-Object -First 1
}

if (-not $networkIP) {
    $networkIP = "localhost"
    Write-Warning "Could not detect network IP, using localhost"
} else {
    Write-Info "Network IP detected: $networkIP"
}

# Ask about ZeroCopy streaming
Write-Host "`nZERO-COPY STREAMING (HTTP/2 + HTTPS)" -ForegroundColor Magenta
Write-Host "   - 10x faster uploads for large files" -ForegroundColor Gray
Write-Host "   - 64KB constant memory usage" -ForegroundColor Gray
Write-Host "   - SIMD acceleration" -ForegroundColor Gray
Write-Host "   - Requires HTTPS (SSL certificate)" -ForegroundColor Gray
Write-Host ""

$enableZeroCopy = Read-Host "Enable ZeroCopy Streaming? (Y/n)"
$enableZeroCopy = $enableZeroCopy.Trim()

if ($enableZeroCopy -eq "" -or $enableZeroCopy -eq "y" -or $enableZeroCopy -eq "Y") {
    $useZeroCopy = $true
    Write-Success "ZeroCopy ENABLED - Starting HTTPS + HTTP servers"
} else {
    $useZeroCopy = $false
    Write-Info "ZeroCopy DISABLED - Starting HTTP server only"
}

Write-Host ""

# Check if backend venv exists
if (-not (Test-Path "backend\venv")) {
    Write-Error "Backend virtual environment not found!"
    Write-Host "Run this first:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  python -m venv venv" -ForegroundColor White
    Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "  pip install -r requirements-local.txt" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if frontend node_modules exists
if (-not (Test-Path "frontend\node_modules")) {
    Write-Error "Frontend dependencies not found!"
    Write-Host "Run this first:" -ForegroundColor Yellow
    Write-Host "  cd frontend" -ForegroundColor White
    Write-Host "  npm install" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if SSL certificates exist (if using ZeroCopy)
if ($useZeroCopy -and -not (Test-Path "backend\localhost+2.pem")) {
    Write-Error "SSL certificates not found!"
    Write-Host "Run this first:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  mkcert -install" -ForegroundColor White
    Write-Host "  mkcert localhost 192.168.1.* 127.0.0.1 ::1" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# ===============================================================
# START LIBRETRANSLATE (TRANSLATION SERVICE)
# ===============================================================

Write-Header "STARTING LIBRETRANSLATE"

Write-Info "Starting LibreTranslate on port 5000..."

$libretranslateCmd = @"
cd '$PSScriptRoot\backend'
`$host.UI.RawUI.WindowTitle = 'LibreTranslate - Port 5000'
& '.\venv\Scripts\Activate.ps1'
Write-Host 'LibreTranslate Starting...' -ForegroundColor Yellow
Write-Host 'This may take 30-60 seconds on first run (downloading models)...' -ForegroundColor Gray
libretranslate --host 0.0.0.0 --port 5000
"@

$libretranslateProcess = Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", $libretranslateCmd `
    -WindowStyle Minimized `
    -PassThru

Write-Success "LibreTranslate starting (PID: $($libretranslateProcess.Id))..."
Write-Info "Waiting for LibreTranslate to initialize (30s)..."
Start-Sleep -Seconds 3

if ($libretranslateProcess.HasExited) {
    Write-Warning "LibreTranslate failed to start - translations will be disabled"
    Write-Host "   Install LibreTranslate: pip install libretranslate" -ForegroundColor Gray
} else {
    Write-Success "LibreTranslate running (PID: $($libretranslateProcess.Id))"
}

# ===============================================================
# START BACKEND
# ===============================================================

Write-Header "STARTING BACKEND"

# Get max file size from config
$maxFileSizeMB = 5000
Write-Info "Max upload size configured in app: ${maxFileSizeMB}MB"

# Always start HTTP server (port 8000) - runs minimized
Write-Info "Starting HTTP server on port 8000..."

$httpCmd = @"
cd '$PSScriptRoot\backend'
`$host.UI.RawUI.WindowTitle = 'Backend HTTP - Port 8000'
& '.\venv\Scripts\Activate.ps1'
Write-Host 'HTTP Backend Starting...' -ForegroundColor Green
hypercorn app.main:app --reload --bind 0.0.0.0:8000 --keep-alive 300
"@

$httpProcess = Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", $httpCmd `
    -WindowStyle Minimized `
    -PassThru

Start-Sleep -Seconds 3

if ($httpProcess.HasExited) {
    Write-Error "HTTP backend failed to start!"
    exit 1
}

Write-Success "HTTP backend running (PID: $($httpProcess.Id))"

# Start HTTPS server if ZeroCopy enabled
if ($useZeroCopy) {
    Write-Info "Starting HTTPS server on port 8443 (ZeroCopy)..."
    
    $httpsCmd = @"
cd '$PSScriptRoot\backend'
`$host.UI.RawUI.WindowTitle = 'Backend HTTPS - Port 8443 (ZeroCopy)'
& '.\venv\Scripts\Activate.ps1'
Write-Host 'HTTPS Backend Starting...' -ForegroundColor Magenta
hypercorn app.main:app --reload --bind 0.0.0.0:8443 --certfile localhost+2.pem --keyfile localhost+2-key.pem --keep-alive 300
"@

    $httpsProcess = Start-Process powershell -ArgumentList `
        "-NoExit", `
        "-Command", $httpsCmd `
        -WindowStyle Minimized `
        -PassThru
    
    Start-Sleep -Seconds 3
    
    if ($httpsProcess.HasExited) {
        Write-Error "HTTPS backend failed to start!"
        $useZeroCopy = $false
        Write-Warning "Continuing with HTTP only"
    } else {
        Write-Success "HTTPS backend running (PID: $($httpsProcess.Id))"
    }
}

Write-Success "HTTP backend running (PID: $($httpProcess.Id))"

# Start HTTPS server if ZeroCopy enabled
if ($useZeroCopy) {
    Write-Info "Starting HTTPS server on port 8443 (ZeroCopy, max upload: $($maxBodySizeBytes / 1024 / 1024)MB)..."
    
    $httpsCmd = @"
cd '$PSScriptRoot\backend'
`$host.UI.RawUI.WindowTitle = 'Backend HTTPS - Port 8443 (ZeroCopy)'
& '.\venv\Scripts\Activate.ps1'
Write-Host 'HTTPS Backend Starting...' -ForegroundColor Magenta
Write-Host 'Max file size: $($maxBodySizeBytes / 1024 / 1024)MB' -ForegroundColor Gray
hypercorn app.main:app --reload --bind 0.0.0.0:8443 --certfile localhost+2.pem --keyfile localhost+2-key.pem --max-body-size $maxBodySizeBytes --keep-alive $keepAliveTimeout
"@

    $httpsProcess = Start-Process powershell -ArgumentList `
        "-NoExit", `
        "-Command", $httpsCmd `
        -WindowStyle Minimized `
        -PassThru
    
    Start-Sleep -Seconds 3
    
    if ($httpsProcess.HasExited) {
        Write-Error "HTTPS backend failed to start!"
        $useZeroCopy = $false
        Write-Warning "Continuing with HTTP only"
    } else {
        Write-Success "HTTPS backend running (PID: $($httpsProcess.Id))"
    }
}
# ===============================================================
# START FRONTEND
# ===============================================================

Write-Header "STARTING FRONTEND"

Write-Info "Starting Vite dev server on port 5173..."

$frontendCmd = @"
cd '$PSScriptRoot\frontend'
`$host.UI.RawUI.WindowTitle = 'Frontend - Vite Dev Server'
Write-Host 'Frontend Starting...' -ForegroundColor Cyan
npm run dev
"@

$frontendProcess = Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", $frontendCmd `
    -WindowStyle Minimized `
    -PassThru

Write-Success "Frontend starting (PID: $($frontendProcess.Id))..."

# ===============================================================
# WAIT FOR SERVICES TO BE READY
# ===============================================================

Write-Header "WAITING FOR SERVICES"

Write-Info "Waiting for backend to initialize..."
Start-Sleep -Seconds 5

Write-Info "Waiting for frontend to build..."
Start-Sleep -Seconds 5

# ===============================================================
# VERIFY SERVICES ARE RUNNING
# ===============================================================

Write-Info "Verifying services..."

$httpRunning = -not $httpProcess.HasExited
$httpsRunning = if ($useZeroCopy) { -not $httpsProcess.HasExited } else { $false }
$frontendRunning = -not $frontendProcess.HasExited

if (-not $httpRunning) {
    Write-Error "HTTP backend stopped unexpectedly!"
    exit 1
}

if ($useZeroCopy -and -not $httpsRunning) {
    Write-Warning "HTTPS backend stopped, continuing with HTTP only"
    $useZeroCopy = $false
}

if (-not $frontendRunning) {
    Write-Error "Frontend stopped unexpectedly!"
    exit 1
}

Write-Success "All services verified running"

# ===============================================================
# OPEN BROWSER
# ===============================================================

Write-Header "OPENING BROWSER"

$frontendUrl = "http://${networkIP}:5173"

Write-Info "Opening application in browser..."
Start-Process $frontendUrl

if ($useZeroCopy) {
    Write-Host ""
    Write-Success "Zero-copy streaming enabled!"
    Write-Host "   First upload: Browser will ask to accept SSL certificate" -ForegroundColor Gray
    Write-Host "   Click 'Advanced' → 'Proceed' to enable HTTPS uploads" -ForegroundColor Gray
    Write-Host "   After that, uploads will be 10x faster!" -ForegroundColor Gray
}

# Open frontend
Start-Process $frontendUrl

# ===============================================================
# SHOW STATUS
# ===============================================================

Write-Header "STARTUP COMPLETE"

Write-Host "FRONTEND:  " -NoNewline -ForegroundColor Cyan
Write-Host $frontendUrl -ForegroundColor White

Write-Host "BACKEND:   " -NoNewline -ForegroundColor Green
Write-Host "http://${networkIP}:8000" -ForegroundColor White

if ($useZeroCopy) {
    Write-Host "ZEROCOPY:  " -NoNewline -ForegroundColor Magenta
    Write-Host "https://${networkIP}:8443" -ForegroundColor White
    Write-Host ""
    Write-Success "ZeroCopy streaming enabled!"
    Write-Host "   Frontend will auto-detect and use HTTPS for uploads" -ForegroundColor Gray
}

Write-Host ""
Write-Host "MOBILE ACCESS:" -ForegroundColor Cyan
Write-Host "   Open the app on desktop and scan the QR code" -ForegroundColor Gray
Write-Host "   Mobile URL: $frontendUrl" -ForegroundColor White

Write-Host ""
Write-Info "Server windows are MINIMIZED (not hidden)"
Write-Host "   You can restore them from taskbar to see logs" -ForegroundColor Gray
Write-Host "   This main console controls everything" -ForegroundColor Gray

Write-Host ""
Write-Host "Press Enter to shutdown all services..." -ForegroundColor Yellow
Read-Host

# ===============================================================
# CLEANUP
# ===============================================================

Write-Header "SHUTTING DOWN"

Write-Info "Stopping all services..."

# Stop the specific processes we started
try {
    if ($httpProcess -and -not $httpProcess.HasExited) {
        Write-Info "Stopping HTTP backend..."
        Stop-Process -Id $httpProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($httpsProcess -and -not $httpsProcess.HasExited) {
        Write-Info "Stopping HTTPS backend..."
        Stop-Process -Id $httpsProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        Write-Info "Stopping frontend..."
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Warning "Error stopping processes, forcing cleanup..."
    # Fallback: kill all hypercorn and node processes
    Get-Process | Where-Object { $_.ProcessName -eq "hypercorn" -or $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Success "All services stopped"
Write-Host ""
Write-Host "Goodbye!" -ForegroundColor Cyan
Start-Sleep -Seconds 2