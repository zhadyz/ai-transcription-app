# Setup Python Embeddable Runtime for Tauri Bundle
# This script downloads Python 3.11 embeddable and installs backend dependencies
# Run during build process, not committed to Git

param(
    [string]$PythonVersion = "3.11.9",
    [string]$TargetDir = "python-embed"
)

$ErrorActionPreference = "Stop"

# Change to src-tauri directory (script is called from project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcTauriDir = Split-Path -Parent $scriptDir
Set-Location $srcTauriDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stygian - Python Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Gray

# Determine architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "win32" }
$pythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-$arch.zip"
$pythonZip = "python-embed.zip"

# Create target directory
Write-Host "`n[1/5] Creating Python directory..." -ForegroundColor Yellow
if (Test-Path $TargetDir) {
    Write-Host "Cleaning existing Python installation..." -ForegroundColor Gray
    Remove-Item -Recurse -Force $TargetDir
}
New-Item -ItemType Directory -Path $TargetDir | Out-Null

# Download Python embeddable
Write-Host "`n[2/5] Downloading Python $PythonVersion embeddable ($arch)..." -ForegroundColor Yellow
Write-Host "URL: $pythonUrl" -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonZip -UseBasicParsing
    $downloadSize = [math]::Round((Get-Item $pythonZip).Length / 1MB, 2)
    Write-Host "Downloaded: $downloadSize MB" -ForegroundColor Green
} catch {
    Write-Host "Error downloading Python: $_" -ForegroundColor Red
    exit 1
}

# Extract Python
Write-Host "`n[3/5] Extracting Python..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $pythonZip -DestinationPath $TargetDir -Force
    Remove-Item $pythonZip
    Write-Host "Extracted successfully" -ForegroundColor Green
} catch {
    Write-Host "Error extracting Python: $_" -ForegroundColor Red
    exit 1
}

# Enable pip in embedded Python and add backend to path
Write-Host "`n[4/5] Configuring embedded Python for pip..." -ForegroundColor Yellow
$pthFile = Get-ChildItem -Path $TargetDir -Filter "python*._pth" | Select-Object -First 1
if ($pthFile) {
    # Create the correct python311._pth content with backend path
    $pthContent = @"
python311.zip
.
../backend

# Uncomment to run site.main() automatically
import site
"@
    Set-Content -Path $pthFile.FullName -Value $pthContent -NoNewline
    Write-Host "Enabled site-packages and added backend to path" -ForegroundColor Green
} else {
    Write-Host "Warning: Could not find ._pth file" -ForegroundColor Yellow
}

# Download get-pip.py
Write-Host "Downloading get-pip.py..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile "$TargetDir\get-pip.py" -UseBasicParsing
    Write-Host "Downloaded get-pip.py" -ForegroundColor Green
} catch {
    Write-Host "Error downloading get-pip.py: $_" -ForegroundColor Red
    exit 1
}

# Install pip
Write-Host "Installing pip..." -ForegroundColor Gray
$pythonExe = Join-Path $TargetDir "python.exe"
& $pythonExe "$TargetDir\get-pip.py" --no-warn-script-location
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing pip" -ForegroundColor Red
    exit 1
}
Write-Host "pip installed successfully" -ForegroundColor Green

# Install backend dependencies (SKIPPED - install separately after deployment)
Write-Host "`n[5/5] Skipping backend dependencies..." -ForegroundColor Yellow
Write-Host "Note: Python dependencies must be installed separately" -ForegroundColor Yellow
Write-Host "Run 'python-embed\python.exe -m pip install -r backend\requirements.txt' after installation" -ForegroundColor Gray

# Cleanup
Remove-Item "$TargetDir\get-pip.py" -ErrorAction SilentlyContinue

# Compress python-embed for bundling (reduces build-time file processing)
Write-Host "`n[6/6] Compressing Python environment for distribution..." -ForegroundColor Yellow
$archivePath = "$TargetDir.zip"
if (Test-Path $archivePath) {
    Remove-Item $archivePath -Force
}

try {
    Compress-Archive -Path $TargetDir -DestinationPath $archivePath -CompressionLevel Optimal -Force
    $archiveSizeMB = [math]::Round((Get-Item $archivePath).Length / 1MB, 2)
    Write-Host "Created archive: $archiveSizeMB MB" -ForegroundColor Green

    # Remove uncompressed directory (we only need the archive for bundling)
    Write-Host "Removing uncompressed directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force $TargetDir
    Write-Host "Cleanup complete" -ForegroundColor Green
} catch {
    Write-Host "Error creating archive: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Python setup complete!" -ForegroundColor Green
Write-Host "Archive: $archivePath" -ForegroundColor Gray
Write-Host "Size: $archiveSizeMB MB (compressed)" -ForegroundColor Gray
Write-Host "Note: Archive will be extracted on first application launch" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Create backend.zip archive
Write-Host "`n[7/7] Creating backend archive..." -ForegroundColor Yellow
$backendDir = "backend"
$backendZip = "backend.zip"

# Check if backend directory exists
if (-not (Test-Path $backendDir)) {
    Write-Host "Error: Backend directory not found at: $backendDir" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
    exit 1
}

if (Test-Path $backendZip) {
    Remove-Item $backendZip -Force
}

try {
    Compress-Archive -Path $backendDir -DestinationPath $backendZip -CompressionLevel Optimal -Force
    $backendSizeMB = [math]::Round((Get-Item $backendZip).Length / 1MB, 2)
    Write-Host "Created backend archive: $backendSizeMB MB" -ForegroundColor Green
} catch {
    Write-Host "Error creating backend archive: $_" -ForegroundColor Red
    exit 1
}
