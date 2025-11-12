# Setup Python Embeddable Runtime for Tauri Bundle
# This script downloads Python 3.11 embeddable and installs backend dependencies
# Run during build process, not committed to Git

param(
    [string]$PythonVersion = "3.11.9",
    [string]$TargetDir = "python-embed"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stygian Captions - Python Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

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

# Enable pip in embedded Python
Write-Host "`n[4/5] Configuring embedded Python for pip..." -ForegroundColor Yellow
$pthFile = Get-ChildItem -Path $TargetDir -Filter "python*._pth" | Select-Object -First 1
if ($pthFile) {
    $content = Get-Content $pthFile.FullName
    $content = $content -replace '#import site', 'import site'
    Set-Content -Path $pthFile.FullName -Value $content
    Write-Host "Enabled site-packages" -ForegroundColor Green
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

# Install backend dependencies
Write-Host "`n[5/5] Installing backend dependencies..." -ForegroundColor Yellow
$backendDir = Join-Path (Get-Location) "backend"
$requirementsFile = Join-Path $backendDir "requirements.txt"

if (Test-Path $requirementsFile) {
    Write-Host "Requirements file: $requirementsFile" -ForegroundColor Gray
    & $pythonExe -m pip install -r $requirementsFile --no-warn-script-location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "Warning: requirements.txt not found at $requirementsFile" -ForegroundColor Yellow
}

# Cleanup
Remove-Item "$TargetDir\get-pip.py" -ErrorAction SilentlyContinue

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Python setup complete!" -ForegroundColor Green
Write-Host "Location: $TargetDir" -ForegroundColor Gray
$sizeInMB = [math]::Round((Get-ChildItem -Recurse $TargetDir | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
Write-Host "Size: $sizeInMB MB" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
