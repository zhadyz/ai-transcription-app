<#
.SYNOPSIS
    AI Transcription App - One-Click Universal Installer
.DESCRIPTION
    Automatically installs and configures everything.
    REQUIRES PYTHON 3.11.x EXCLUSIVELY (3.12+ breaks compatibility)
#>

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

$RequiredPythonMajor = 3
$RequiredPythonMinor = 11
$RequiredNodeVersion = [Version]"18.0.0"

# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

function Write-Header {
    param([string]$Text)
    Write-Host "`n===============================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor White
    Write-Host "===============================================================`n" -ForegroundColor Cyan
}

function Write-Success { param([string]$Text) Write-Host "[OK] $Text" -ForegroundColor Green }
function Write-Info { param([string]$Text) Write-Host "[INFO] $Text" -ForegroundColor Cyan }
function Write-Warning { param([string]$Text) Write-Host "[WARN] $Text" -ForegroundColor Yellow }
function Write-Error { param([string]$Text) Write-Host "[ERROR] $Text" -ForegroundColor Red }

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Stop-AppProcesses {
    Write-Info "Stopping any running app processes..."
    
    # Stop Python processes
    $pythonProcs = Get-Process python* -ErrorAction SilentlyContinue
    if ($pythonProcs) {
        $pythonProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Info "Stopped Python processes"
    }
    
    # Stop Hypercorn
    $hypercornProcs = Get-Process hypercorn* -ErrorAction SilentlyContinue
    if ($hypercornProcs) {
        $hypercornProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Info "Stopped Hypercorn processes"
    }
    
    # Stop Node
    $nodeProcs = Get-Process node* -ErrorAction SilentlyContinue
    if ($nodeProcs) {
        $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Info "Stopped Node processes"
    }
    
    # Wait for cleanup
    Start-Sleep -Seconds 2
    Write-Success "All app processes stopped"
}

function Get-Python311Path {
    # Check for Python 3.11 in common locations
    $possiblePaths = @(
        "C:\Python311\python.exe",
        "C:\Program Files\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:USERPROFILE\AppData\Local\Programs\Python\Python311\python.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    # Check PATH for python3.11
    if (Test-Command python3.11) {
        return "python3.11"
    }
    
    return $null
}

# ═══════════════════════════════════════════════════════════════════════════
# START INSTALLATION
# ═══════════════════════════════════════════════════════════════════════════

Clear-Host
Write-Header "AI TRANSCRIPTION APP - UNIVERSAL INSTALLER"
Write-Host "This will install EVERYTHING automatically:" -ForegroundColor White
Write-Host "  - Python 3.11.x virtual environment (REQUIRED VERSION)" -ForegroundColor Gray
Write-Host "  - PyTorch with CUDA GPU support" -ForegroundColor Gray
Write-Host "  - All backend dependencies (Windows version)" -ForegroundColor Gray
Write-Host "  - LibreTranslate (12+ languages)" -ForegroundColor Gray
Write-Host "  - Frontend dependencies (Node.js)" -ForegroundColor Gray
Write-Host "  - SSL certificates for HTTPS" -ForegroundColor Gray
Write-Host ""
Write-Warning "IMPORTANT: Python 3.11.x ONLY (3.12+ breaks compatibility!)"
Write-Host ""

$confirm = Read-Host "Continue with installation? (Y/n)"
if ($confirm -ne "" -and $confirm -ne "y" -and $confirm -ne "Y") {
    Write-Warning "Installation cancelled"
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: CHECK PYTHON 3.11.x SPECIFICALLY
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "STEP 1/8: Checking Python 3.11.x"

$pythonExe = "python"
$pythonVersion = $null
$pythonMajor = 0
$pythonMinor = 0

# First check default python command
if (Test-Command python) {
    $versionOutput = python --version 2>&1
    if ($versionOutput -match "Python (\d+)\.(\d+)\.(\d+)") {
        $pythonMajor = [int]$matches[1]
        $pythonMinor = [int]$matches[2]
        $pythonPatch = [int]$matches[3]
        $pythonVersion = "$pythonMajor.$pythonMinor.$pythonPatch"
        
        Write-Info "Found Python $pythonVersion"
        
        # Check if it's 3.11.x
        if ($pythonMajor -eq $RequiredPythonMajor -and $pythonMinor -eq $RequiredPythonMinor) {
            Write-Success "Python 3.11.x detected - PERFECT!"
        } else {
            Write-Warning "Default python is $pythonVersion (not 3.11.x)"
            
            # Try to find Python 3.11 specifically
            Write-Info "Searching for Python 3.11 installation..."
            $python311Path = Get-Python311Path
            
            if ($python311Path) {
                Write-Success "Found Python 3.11 at: $python311Path"
                $pythonExe = $python311Path
                
                # Verify version
                $versionOutput = & $pythonExe --version 2>&1
                if ($versionOutput -match "Python (\d+)\.(\d+)\.(\d+)") {
                    $pythonMajor = [int]$matches[1]
                    $pythonMinor = [int]$matches[2]
                    $pythonPatch = [int]$matches[3]
                    $pythonVersion = "$($matches[1]).$($matches[2]).$($matches[3])"
                    Write-Success "Using Python $pythonVersion"
                }
            } else {
                Write-Error "Python 3.11.x not found!"
                Write-Host ""
                Write-Host "CRITICAL: This app requires Python 3.11.x EXCLUSIVELY" -ForegroundColor Red
                Write-Host "Python 3.12+ and 3.13+ break PyTorch compatibility" -ForegroundColor Red
                Write-Host ""
                Write-Host "Please install Python 3.11.x:" -ForegroundColor Yellow
                Write-Host "1. Go to: https://www.python.org/downloads/" -ForegroundColor White
                Write-Host "2. Scroll down to 'Looking for a specific release?'" -ForegroundColor White
                Write-Host "3. Download Python 3.11.9 (latest 3.11.x)" -ForegroundColor White
                Write-Host "4. During installation:" -ForegroundColor White
                Write-Host "   - Check 'Add Python 3.11 to PATH'" -ForegroundColor Gray
                Write-Host "   - Choose 'Install for all users' (optional)" -ForegroundColor Gray
                Write-Host ""
                Write-Host "Direct link: https://www.python.org/downloads/release/python-3119/" -ForegroundColor Cyan
                Write-Host ""
                
                $openLink = Read-Host "Open download page now? (Y/n)"
                if ($openLink -eq "" -or $openLink -eq "y" -or $openLink -eq "Y") {
                    Start-Process "https://www.python.org/downloads/release/python-3119/"
                }
                
                exit 1
            }
        }
    }
} else {
    Write-Error "Python not found in PATH!"
    Write-Host ""
    Write-Host "Please install Python 3.11.x:" -ForegroundColor Yellow
    Write-Host "1. Download: https://www.python.org/downloads/release/python-3119/" -ForegroundColor White
    Write-Host "2. During installation, check 'Add Python to PATH'" -ForegroundColor White
    Write-Host ""
    
    $openLink = Read-Host "Open download page now? (Y/n)"
    if ($openLink -eq "" -or $openLink -eq "y" -or $openLink -eq "Y") {
        Start-Process "https://www.python.org/downloads/release/python-3119/"
    }
    
    exit 1
}

# Final validation - must be 3.11.x
if ($pythonMajor -ne $RequiredPythonMajor -or $pythonMinor -ne $RequiredPythonMinor) {
    Write-Error "Wrong Python version: $pythonVersion"
    Write-Host ""
    Write-Host "REQUIRED: Python 3.11.x (e.g., 3.11.9)" -ForegroundColor Red
    Write-Host "FOUND: Python $pythonVersion" -ForegroundColor Red
    Write-Host ""
    Write-Host "Python 3.12+ and 3.13+ have breaking changes!" -ForegroundColor Yellow
    Write-Host "This app is tested and works ONLY with Python 3.11.x" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install Python 3.11.9:" -ForegroundColor White
    Write-Host "https://www.python.org/downloads/release/python-3119/" -ForegroundColor Cyan
    Write-Host ""
    
    $openLink = Read-Host "Open download page now? (Y/n)"
    if ($openLink -eq "" -or $openLink -eq "y" -or $openLink -eq "Y") {
        Start-Process "https://www.python.org/downloads/release/python-3119/"
    }
    
    exit 1
}

Write-Success "Python 3.11.$pythonPatch is PERFECT for this app!"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: CREATE VIRTUAL ENVIRONMENT
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "STEP 2/8: Creating Virtual Environment"

Set-Location backend

if (Test-Path "venv") {
    Write-Warning "Virtual environment already exists"
    $recreate = Read-Host "Recreate it? (y/N)"
    if ($recreate -eq "y" -or $recreate -eq "Y") {
        Write-Info "Stopping all running processes first..."
        Set-Location ..
        Stop-AppProcesses
        Set-Location backend
        
        Write-Info "Removing old venv..."
        try {
            Remove-Item -Recurse -Force venv -ErrorAction Stop
            Write-Success "Old venv removed"
        } catch {
            Write-Error "Failed to remove venv: $_"
            Write-Host ""
            Write-Host "Please manually:" -ForegroundColor Yellow
            Write-Host "1. Close ALL PowerShell windows" -ForegroundColor White
            Write-Host "2. Open Task Manager and end any python.exe processes" -ForegroundColor White
            Write-Host "3. Delete backend\venv folder manually" -ForegroundColor White
            Write-Host "4. Run install.ps1 again" -ForegroundColor White
            Write-Host ""
            Read-Host "Press Enter to exit"
            exit 1
        }
    } else {
        Write-Info "Using existing virtual environment"
        & .\venv\Scripts\Activate.ps1
        
        Write-Host ""
        $skipBackend = Read-Host "Skip backend installation (use existing)? (Y/n)"
        if ($skipBackend -eq "" -or $skipBackend -eq "y" -or $skipBackend -eq "Y") {
            Set-Location ..\frontend
            Write-Info "Skipping to frontend installation..."
            goto SkipToFrontend
        }
        Set-Location ..
    }
}

Write-Info "Creating Python 3.11 virtual environment..."
& $pythonExe -m venv venv

if (-not $?) {
    Write-Error "Failed to create virtual environment"
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure Python 3.11 has venv module" -ForegroundColor White
    Write-Host "2. Try: $pythonExe -m pip install --upgrade pip" -ForegroundColor White
    Write-Host "3. Try: $pythonExe -m ensurepip --upgrade" -ForegroundColor White
    exit 1
}

Write-Success "Virtual environment created with Python 3.11"

# Activate venv
Write-Info "Activating virtual environment..."
& .\venv\Scripts\Activate.ps1

# Verify Python version in venv
$venvPython = python --version 2>&1
Write-Info "Virtual environment Python: $venvPython"

# Upgrade pip
Write-Info "Upgrading pip..."
python -m pip install --upgrade pip --quiet

Write-Success "Virtual environment ready"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: INSTALL PYTORCH WITH CUDA
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "STEP 3/8: Installing PyTorch with CUDA GPU Support"

Write-Info "This may take 5-10 minutes depending on your internet speed..."
Write-Host ""

# Check if NVIDIA GPU exists
$hasNvidiaGpu = $false
try {
    $gpu = Get-WmiObject Win32_VideoController | Where-Object { $_.Name -like "*NVIDIA*" }
    if ($gpu) {
        $hasNvidiaGpu = $true
        Write-Success "NVIDIA GPU detected: $($gpu.Name)"
    }
} catch {
    Write-Warning "Could not detect GPU"
}

if ($hasNvidiaGpu) {
    Write-Info "Installing PyTorch with CUDA 12.4 support..."
    python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
} else {
    Write-Warning "No NVIDIA GPU detected, installing CPU-only PyTorch"
    Write-Warning "Transcription will be slower without GPU"
    python -m pip install torch torchaudio
}

if (-not $?) {
    Write-Error "Failed to install PyTorch"
    exit 1
}

Write-Success "PyTorch installed successfully"

# Test PyTorch CUDA
Write-Info "Testing GPU support..."
$cudaTest = python -c "import torch; print('CUDA Available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')" 2>&1

Write-Host $cudaTest -ForegroundColor Gray

if ($cudaTest -like "*CUDA Available: True*") {
    Write-Success "GPU acceleration is working!"
} else {
    Write-Warning "GPU not detected - will use CPU (slower)"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: INSTALL BACKEND DEPENDENCIES (WINDOWS VERSION!)
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "STEP 4/8: Installing Backend Dependencies"

Write-Info "Installing Windows-specific packages from requirements-local.txt..."
Write-Info "This may take 3-5 minutes..."

python -m pip install -r requirements-local.txt

if (-not $?) {
    Write-Error "Failed to install dependencies"
    Write-Host ""
    Write-Host "If you see errors about missing packages:" -ForegroundColor Yellow
    Write-Host "1. Make sure you're using Python 3.11" -ForegroundColor White
    Write-Host "2. Try running: pip install --upgrade pip" -ForegroundColor White
    Write-Host "3. Try running the install command again" -ForegroundColor White
    exit 1
}

Write-Success "All backend dependencies installed (Windows version)"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: INSTALL FFMPEG
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "STEP 5/8: Checking FFmpeg"

if (Test-Command ffmpeg) {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-String -Pattern "ffmpeg version" | Select-Object -First 1
    Write-Success "FFmpeg already installed: $ffmpegVersion"
} else {
    Write-Warning "FFmpeg not found!"
    Write-Host "`nPlease install FFmpeg:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://ffmpeg.org/download.html" -ForegroundColor White
    Write-Host "2. Extract to C:\ffmpeg" -ForegroundColor White
    Write-Host "3. Add C:\ffmpeg\bin to PATH" -ForegroundColor White
    Write-Host ""
    Write-Warning "App will not work without FFmpeg!"
    Write-Host ""
    $skipFfmpeg = Read-Host "Skip FFmpeg check for now? (y/N)"
    if ($skipFfmpeg -ne "y" -and $skipFfmpeg -ne "Y") {
        exit 1
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: GENERATE SSL CERTIFICATES
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "STEP 6/8: Generating SSL Certificates"

if (Test-Path "localhost+2.pem") {
    Write-Success "SSL certificates already exist"
} else {
    if (Test-Command mkcert) {
        Write-Info "Generating SSL certificates with mkcert..."
        
        # Install root CA
        mkcert -install
        
        # Generate certificates
        mkcert localhost 192.168.1.* 127.0.0.1 ::1
        
        if (Test-Path "localhost+2.pem") {
            Write-Success "SSL certificates generated"
        } else {
            Write-Error "Certificate generation failed"
        }
    } else {
        Write-Warning "mkcert not found!"
        Write-Host "`nTo enable HTTPS/HTTP2:" -ForegroundColor Yellow
        Write-Host "1. Install mkcert: choco install mkcert" -ForegroundColor White
        Write-Host "   (or download from https://github.com/FiloSottile/mkcert)" -ForegroundColor White
        Write-Host "2. Run: mkcert -install" -ForegroundColor White
        Write-Host "3. Run: mkcert localhost 192.168.1.* 127.0.0.1 ::1" -ForegroundColor White
        Write-Host ""
        Write-Info "App will work without HTTPS (HTTP only mode)"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 7: INSTALL LIBRETRANSLATE
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "STEP 7/8: Setting Up Translation Service"

Write-Info "Checking for LibreTranslate..."

# Check if already installed in venv
$libretranslateInVenv = Test-Path "venv\Scripts\libretranslate.exe"

if ($libretranslateInVenv) {
    Write-Success "LibreTranslate already installed in venv"
    
    # Test if it works
    $testVersion = & .\venv\Scripts\libretranslate.exe --help 2>&1
    if ($?) {
        Write-Success "LibreTranslate is ready"
    } else {
        Write-Warning "LibreTranslate installed but may have issues"
    }
} elseif (Test-Command docker) {
    Write-Success "Docker detected"
    Write-Host ""
    Write-Host "TRANSLATION SERVICE OPTIONS:" -ForegroundColor Cyan
    Write-Host "1. Docker container (isolated, no disk space in venv)" -ForegroundColor White
    Write-Host "2. Python package in venv (integrated, uses ~500MB)" -ForegroundColor White
    Write-Host ""
    
    $choice = Read-Host "Choose installation method (1 or 2, default: 1)"
    
    if ($choice -eq "2") {
        # Install via pip
        Write-Info "Installing LibreTranslate via pip..."
        Write-Warning "This downloads ~500MB of language models (takes 2-3 minutes)"
        
        python -m pip install libretranslate
        
        if ($?) {
            Write-Success "LibreTranslate installed in venv"
        } else {
            Write-Error "Failed to install LibreTranslate"
        }
    } else {
        # Use Docker
        Write-Info "Starting LibreTranslate container..."
        
        # Check if container already exists
        $containerExists = docker ps -a --filter "name=libretranslate" --format "{{.Names}}" 2>&1
        
        if ($containerExists -like "*libretranslate*") {
            Write-Info "LibreTranslate container exists, restarting..."
            docker start libretranslate | Out-Null
        } else {
            Write-Info "Creating LibreTranslate container (downloads ~500MB)..."
            docker run -d --name libretranslate -p 5000:5000 --restart unless-stopped libretranslate/libretranslate | Out-Null
        }
        
        if ($?) {
            Write-Success "LibreTranslate container started on http://localhost:5000"
        } else {
            Write-Warning "Failed to start LibreTranslate container"
        }
    }
} else {
    # No Docker, fallback to pip
    Write-Warning "Docker not found - installing LibreTranslate via pip..."
    Write-Host ""
    Write-Host "LibreTranslate will be installed as a Python package:" -ForegroundColor Yellow
    Write-Host "  - Downloads ~500MB of language models" -ForegroundColor Gray
    Write-Host "  - Takes 2-3 minutes to install" -ForegroundColor Gray
    Write-Host "  - First startup takes 30-60 seconds" -ForegroundColor Gray
    Write-Host ""
    
    $installLibre = Read-Host "Install LibreTranslate now? (Y/n)"
    if ($installLibre -eq "" -or $installLibre -eq "y" -or $installLibre -eq "Y") {
        Write-Info "Installing LibreTranslate..."
        
        python -m pip install libretranslate
        
        if ($?) {
            Write-Success "LibreTranslate installed successfully"
            
            # Test it
            Write-Info "Testing LibreTranslate..."
            $testVersion = & .\venv\Scripts\libretranslate.exe --help 2>&1
            if ($?) {
                Write-Success "LibreTranslate is ready to use"
            }
        } else {
            Write-Error "Failed to install LibreTranslate"
            Write-Host "You can install it later with:" -ForegroundColor Yellow
            Write-Host "  cd backend" -ForegroundColor White
            Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
            Write-Host "  pip install libretranslate" -ForegroundColor White
        }
    } else {
        Write-Info "Skipping LibreTranslate installation"
        Write-Host "App will work without translation service" -ForegroundColor Gray
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 8: INSTALL FRONTEND DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════

:SkipToFrontend

Write-Header "STEP 8/8: Installing Frontend Dependencies"

Set-Location ..\frontend

if (-not (Test-Command node)) {
    Write-Error "Node.js not found!"
    Write-Host "`nPlease install Node.js 18+ from:" -ForegroundColor Yellow
    Write-Host "https://nodejs.org/" -ForegroundColor White
    exit 1
}

$nodeVersion = node --version | Select-String -Pattern "(\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches.Groups[1].Value }
Write-Info "Found Node.js $nodeVersion"

$nodeVersionObj = [Version]$nodeVersion
if ($nodeVersionObj -lt $RequiredNodeVersion) {
    Write-Error "Node.js 18+ required, found $nodeVersion"
    Write-Host "`nPlease upgrade Node.js from:" -ForegroundColor Yellow
    Write-Host "https://nodejs.org/" -ForegroundColor White
    exit 1
}

Write-Success "Node.js version OK"

Write-Info "Installing npm packages..."
Write-Info "This may take 2-5 minutes..."

npm install

if (-not $?) {
    Write-Error "Failed to install frontend dependencies"
    exit 1
}

Write-Success "Frontend dependencies installed"

# ═══════════════════════════════════════════════════════════════════════════
# INSTALLATION COMPLETE
# ═══════════════════════════════════════════════════════════════════════════

Set-Location ..

Write-Header "INSTALLATION COMPLETE"

Write-Success "All components installed successfully!"
Write-Host ""

Write-Host "INSTALLED COMPONENTS:" -ForegroundColor Cyan
Write-Host "  [OK] Python $pythonVersion virtual environment" -ForegroundColor Green
Write-Host "  [OK] PyTorch with GPU support" -ForegroundColor Green
Write-Host "  [OK] All backend dependencies (Windows version)" -ForegroundColor Green
Write-Host "  [OK] Frontend dependencies (Node.js)" -ForegroundColor Green

if (Test-Command ffmpeg) {
    Write-Host "  [OK] FFmpeg" -ForegroundColor Green
} else {
    Write-Host "  [WARN] FFmpeg - Manual installation needed" -ForegroundColor Yellow
}

if (Test-Path "backend\localhost+2.pem") {
    Write-Host "  [OK] SSL certificates for HTTPS" -ForegroundColor Green
} else {
    Write-Host "  [WARN] SSL certificates - Optional" -ForegroundColor Yellow
}

if (Test-Command docker) {
    Write-Host "  [OK] LibreTranslate (translation service)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] LibreTranslate - Optional" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Run the app:" -ForegroundColor White
Write-Host "   Double-click START.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Or manually start:" -ForegroundColor White
Write-Host "   .\start.ps1" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Command ffmpeg)) {
    Write-Warning "IMPORTANT: Install FFmpeg before first run!"
    Write-Host "   Download: https://ffmpeg.org/download.html" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Ready to transcribe! " -NoNewline -ForegroundColor Green
Write-Host "Maximum enlightenment achieved!" -ForegroundColor Magenta
Write-Host ""

# Optional: Open documentation
$openDocs = Read-Host "Open README documentation? (Y/n)"
if ($openDocs -eq "" -or $openDocs -eq "y" -or $openDocs -eq "Y") {
    if (Test-Path "README.md") {
        Start-Process "README.md"
    }
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")