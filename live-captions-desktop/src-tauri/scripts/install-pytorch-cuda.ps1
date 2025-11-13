# Install PyTorch with CUDA to short path and copy DLLs
# Workaround for Windows 260-character path limit

param(
    [string]$TorchTempDir = "C:\torch-temp",
    [string]$TargetPythonDir = "python-embed"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PyTorch CUDA DLL Bundling" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Create short temp directory for PyTorch
Write-Host "`n[1/5] Creating temporary directory..." -ForegroundColor Yellow
if (Test-Path $TorchTempDir) {
    Write-Host "Cleaning existing temp directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force $TorchTempDir
}
New-Item -ItemType Directory -Path $TorchTempDir | Out-Null
New-Item -ItemType Directory -Path "$TorchTempDir\venv" | Out-Null

# Step 2: Create minimal Python venv in short path
Write-Host "`n[2/5] Setting up temporary Python environment..." -ForegroundColor Yellow
$pythonExe = Join-Path (Get-Location) "$TargetPythonDir\python.exe"
& $pythonExe -m venv "$TorchTempDir\venv"
$tempPython = "$TorchTempDir\venv\Scripts\python.exe"

# Step 3: Install PyTorch with CUDA in short path
Write-Host "`n[3/5] Installing PyTorch 2.6.0+cu124..." -ForegroundColor Yellow
Write-Host "This may take several minutes (downloading 2.5GB)..." -ForegroundColor Gray
& $tempPython -m pip install --upgrade pip --quiet
& $tempPython -m pip install torch==2.6.0+cu124 --index-url https://download.pytorch.org/whl/cu124 --no-warn-script-location

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing PyTorch" -ForegroundColor Red
    exit 1
}

# Step 4: Copy CUDA DLLs to target python-embed
Write-Host "`n[4/5] Copying CUDA DLLs to python-embed..." -ForegroundColor Yellow
$torchLibSource = "$TorchTempDir\venv\Lib\site-packages\torch\lib"
$torchLibTarget = Join-Path (Get-Location) "$TargetPythonDir\Lib\site-packages\torch\lib"

if (!(Test-Path $torchLibSource)) {
    Write-Host "Warning: torch/lib not found in temp installation" -ForegroundColor Yellow
    $torchLibSource = "$TorchTempDir\venv\Lib\site-packages\torch\bin"
}

if (Test-Path $torchLibSource) {
    # Create target lib directory
    if (!(Test-Path $torchLibTarget)) {
        New-Item -ItemType Directory -Path $torchLibTarget -Force | Out-Null
    }

    # Copy all DLL files
    $dlls = Get-ChildItem -Path $torchLibSource -Filter "*.dll" -Recurse
    Write-Host "Found $($dlls.Count) DLL files" -ForegroundColor Gray

    foreach ($dll in $dlls) {
        Copy-Item -Path $dll.FullName -Destination $torchLibTarget -Force
        Write-Host "  Copied: $($dll.Name)" -ForegroundColor Gray
    }

    Write-Host "DLLs copied successfully" -ForegroundColor Green
} else {
    Write-Host "Warning: Could not find torch DLLs" -ForegroundColor Yellow
}

# Step 5: Cleanup
Write-Host "`n[5/5] Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $TorchTempDir -ErrorAction SilentlyContinue
Write-Host "Cleanup complete" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PyTorch CUDA setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
