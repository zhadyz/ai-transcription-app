#!/usr/bin/env python3
"""
AI Transcription Installer v2.0 - Complete System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Engineered by: hollowed_eyes
Philosophy: Complete automation. Intelligent adaptation. Flawless execution.
"""

import sys
import os
import platform
import subprocess
import shutil
import time
import logging
import json
import socket
import re
import signal
import atexit
from pathlib import Path
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime

MIN_RAM_GB = 8.0
MIN_DISK_GB = 10.0
REQUIRED_PORTS = [8000, 5173, 80]
PYTORCH_INSTALL_TIMEOUT = 600
DOCKER_STARTUP_TIMEOUT = 60
LIBRETRANSLATE_PORT = 5000
BACKEND_HTTP_PORT = 8000
BACKEND_HTTPS_PORT = 8443
FRONTEND_PORT = 5173

if not getattr(sys, 'frozen', False):
    missing = []
    for pkg in ['rich', 'psutil', 'requests']:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    
    if missing:
        print(f"⚙️  Installing required components: {', '.join(missing)}...")
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install"] + missing + ["-q"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception as e:
            print(f"❌ Setup failed: {e}")
            print(f"💡 Please install manually: pip install {' '.join(missing)}")
            sys.exit(1)

from rich.console import Console
from rich.progress import (
    Progress, 
    SpinnerColumn, 
    TextColumn, 
    BarColumn, 
    TimeElapsedColumn,
    TaskProgressColumn
)
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich import box
from rich.align import Align
import psutil
import requests
import webbrowser

console = Console()

scripts_dir = Path("scripts")
scripts_dir.mkdir(exist_ok=True)

LOG = scripts_dir / "installer.log"
STATE = scripts_dir / ".install_state.json"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler(LOG, mode='w')]
)
log = logging.getLogger(__name__)

class Stage(Enum):
    DETECT = "detect"
    VALIDATE = "validate"
    PYTORCH = "pytorch"
    BACKEND = "backend"
    FRONTEND = "frontend"
    FFMPEG = "ffmpeg"
    SSL = "ssl"
    LIBRETRANSLATE = "libretranslate"
    DOCKER = "docker"
    VERIFY = "verify"
    COMPLETE = "complete"

@dataclass
class InstallState:
    stage: Stage
    mode: str
    started_at: str
    completed_stages: List[str]
    timings: Dict[str, float]
    errors: List[str]
    version: str = "2.0"
    use_zerocopy: bool = False
    libretranslate_mode: Optional[str] = None
    
    def save(self):
        try:
            data = asdict(self)
            data['stage'] = self.stage.value
            tmp = STATE.with_suffix('.tmp')
            tmp.write_text(json.dumps(data, indent=2))
            tmp.replace(STATE)
        except Exception as e:
            log.error(f"State persistence failed: {e}")
    
    @classmethod
    def load(cls) -> Optional['InstallState']:
        if not STATE.exists():
            return None
        try:
            data = json.loads(STATE.read_text())
            if data.get('version', '1.0') != '2.0':
                log.info(f"Old state version {data.get('version', '1.0')} detected, starting fresh")
                STATE.unlink()
                return None
            data['stage'] = Stage(data['stage'])
            return cls(**data)
        except Exception as e:
            log.warning(f"State corrupted, starting fresh: {e}")
            try:
                STATE.unlink()
            except:
                pass
            return None
    
    @classmethod
    def new(cls, mode: str) -> 'InstallState':
        return cls(
            version="2.0",
            stage=Stage.DETECT,
            mode=mode,
            started_at=datetime.now().isoformat(),
            completed_stages=[],
            timings={},
            errors=[]
        )
    
    def complete_stage(self, stage: Stage, elapsed: float):
        self.completed_stages.append(stage.value)
        self.timings[stage.value] = elapsed
        self.save()
        log.info(f"{stage.value} completed in {elapsed:.1f}s")

@dataclass
class GPU:
    name: str
    vram_gb: float
    cuda: Optional[str] = None
    
    @property
    def recommended_model(self) -> str:
        if self.vram_gb >= 16: return "large-v3 (best quality)"
        if self.vram_gb >= 8: return "large-v2"
        if self.vram_gb >= 6: return "medium"
        return "small"

@dataclass
class System:
    os: str
    cores: int
    ram_gb: float
    disk_gb: float
    python_ver: Optional[Tuple[int, int, int]]
    python_path: Optional[str]
    node_ver: Optional[str]
    npm_path: Optional[str]
    docker_installed: bool
    docker_running: bool
    mkcert_installed: bool
    ffmpeg_installed: bool
    gpu: Optional[GPU]
    ip: str

def run(cmd: List[str], timeout: int = 3) -> Optional[str]:
    try:
        flags = subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, creationflags=flags)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception as e:
        log.debug(f"{' '.join(cmd)}: {e}")
        return None

def find_python_311() -> Tuple[Optional[Tuple[int, int, int]], Optional[str]]:
    is_windows = platform.system() == "Windows"
    
    if is_windows:
        for launcher in ["py -3.11", "py -3.11-64"]:
            out = run(launcher.split() + ["--version"])
            if out and "3.11" in out:
                path = run(launcher.split() + ["-c", "import sys; print(sys.executable)"])
                if path:
                    m = re.search(r'3\.11\.(\d+)', out)
                    if m:
                        return (3, 11, int(m.group(1))), path
    
    for cmd in ["python", "python3", "python3.11"]:
        out = run([cmd, "--version"])
        if out:
            m = re.search(r'(\d+)\.(\d+)\.(\d+)', out)
            if m:
                ver = tuple(map(int, m.groups()))
                if ver[0] == 3 and ver[1] == 11:
                    path = run([cmd, "-c", "import sys; print(sys.executable)"])
                    return ver, path
    
    return None, None

def find_node() -> Tuple[Optional[str], Optional[str]]:
    out = run(["node", "--version"])
    node_ver = out.lstrip('v') if out else None
    npm_path = shutil.which("npm")
    
    if node_ver:
        try:
            major = int(node_ver.split('.')[0])
            if major < 18:
                log.warning(f"Node.js {node_ver} < 18 (required)")
                return None, None
        except:
            pass
    
    return node_ver, npm_path

def check_docker() -> Tuple[bool, bool]:
    if shutil.which("docker"):
        is_running = run(["docker", "info"], timeout=3) is not None
        return True, is_running
    
    if platform.system() == "Windows":
        docker_paths = [
            Path("C:/Program Files/Docker/Docker/resources/bin/docker.exe"),
            Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Docker/Docker/resources/bin/docker.exe",
        ]
        
        for docker_exe in docker_paths:
            if docker_exe.exists():
                is_running = run([str(docker_exe), "info"], timeout=3) is not None
                return True, is_running
    
    return False, False

def check_mkcert() -> bool:
    return shutil.which("mkcert") is not None

def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None

def find_gpu() -> Optional[GPU]:
    try:
        import torch
        if torch.cuda.is_available():
            return GPU(
                name=torch.cuda.get_device_name(0),
                vram_gb=torch.cuda.get_device_properties(0).total_memory / (1024**3),
                cuda=torch.version.cuda
            )
    except ImportError:
        log.debug("PyTorch not installed - GPU detection deferred")
    except Exception as e:
        log.debug(f"GPU detection: {e}")
    return None

def get_smart_ip() -> str:
    try:
        import psutil
        
        for interface, addrs in psutil.net_if_addrs().items():
            if any(x in interface.lower() for x in ['vmware', 'virtualbox', 'hyper-v', 'wsl', 'loopback', 'docker', 'vethernet']):
                continue
            
            for addr in addrs:
                if addr.family == socket.AF_INET:
                    ip = addr.address
                    if ip.startswith('192.168.1.'):
                        log.info(f"Found preferred IP: {ip} on {interface}")
                        return ip
        
        for interface, addrs in psutil.net_if_addrs().items():
            if any(x in interface.lower() for x in ['vmware', 'virtualbox', 'hyper-v', 'wsl', 'loopback', 'docker', 'vethernet']):
                continue
            
            for addr in addrs:
                if addr.family == socket.AF_INET:
                    ip = addr.address
                    if ip.startswith('192.168.'):
                        log.info(f"Found fallback IP: {ip} on {interface}")
                        return ip
    except Exception as e:
        log.debug(f"psutil IP detection failed: {e}")
    
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        return "localhost"

def check_port_in_use(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            result = s.connect_ex(("localhost", port))
            return result == 0
    except:
        return False

def check_port(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("localhost", port)) != 0
    except:
        return True

def detect_system() -> System:
    python_ver, python_path = find_python_311()
    docker_installed, docker_running = check_docker()
    node_ver, npm_path = find_node()
    
    return System(
        os=f"{platform.system()} {platform.release()}",
        cores=psutil.cpu_count(),
        ram_gb=psutil.virtual_memory().total / (1024**3),
        disk_gb=psutil.disk_usage('.').free / (1024**3),
        python_ver=python_ver,
        python_path=python_path,
        node_ver=node_ver,
        npm_path=npm_path,
        docker_installed=docker_installed,
        docker_running=docker_running,
        mkcert_installed=check_mkcert(),
        ffmpeg_installed=check_ffmpeg(),
        gpu=find_gpu(),
        ip=get_smart_ip()
    )

def validate_system(sys: System, mode: str) -> List[str]:
    issues = []
    
    if sys.ram_gb < MIN_RAM_GB:
        issues.append(f"Insufficient RAM: {sys.ram_gb:.1f}GB available, {MIN_RAM_GB:.0f}GB required")
        issues.append("→ Close other applications or upgrade hardware")
    
    if sys.disk_gb < MIN_DISK_GB:
        issues.append(f"Low disk space: {sys.disk_gb:.1f}GB free, {MIN_DISK_GB:.0f}GB required")
        issues.append("→ Free up disk space before installation")
    
    if mode == "manual":
        if not sys.python_ver:
            issues.append("Python 3.11 not found")
            issues.append("→ Download: https://www.python.org/downloads/release/python-3119/")
        elif sys.python_ver[0] != 3 or sys.python_ver[1] != 11:
            ver = ".".join(map(str, sys.python_ver))
            issues.append(f"Python version mismatch: {ver} found, 3.11 required")
            issues.append("→ Download Python 3.11.9: https://www.python.org/downloads/release/python-3119/")
        
        if not sys.npm_path:
            issues.append("Node.js 18+ not found (required for frontend)")
            issues.append("→ Download: https://nodejs.org/")
        elif not sys.node_ver:
            issues.append("Node.js found but version cannot be determined")
            issues.append("→ Ensure Node.js 18+ is installed")
    
    blocked = [p for p in REQUIRED_PORTS if not check_port(p)]
    if blocked:
        issues.append(f"Port conflict: {blocked} already in use")
        issues.append("→ Close applications using these ports")
    
    return issues

def parse_pip_progress(line: str) -> Optional[Tuple[float, float]]:
    match = re.search(r'(\d+\.?\d*)\s*/\s*(\d+\.?\d*)\s*(MB|GB|KB)', line)
    if match:
        current = float(match.group(1))
        total = float(match.group(2))
        unit = match.group(3)
        
        multiplier = {'KB': 1024, 'MB': 1024**2, 'GB': 1024**3}
        return current * multiplier[unit], total * multiplier[unit]
    
    return None

def parse_npm_progress(line: str) -> Optional[Tuple[int, int]]:
    match = re.search(r'\[(\d+)/(\d+)\]', line)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None

def parse_docker_progress(line: str) -> Optional[Tuple[str, float]]:
    match = re.search(r'(\w+):\s+\w+\s+\[.*?\]\s+(\d+\.?\d*)(MB|GB|KB)/(\d+\.?\d*)(MB|GB|KB)', line)
    if match:
        layer_id = match.group(1)
        current = float(match.group(2))
        total = float(match.group(4))
        return layer_id, (current / total) * 100
    return None

def exec_stream_pip(cmd: List[str], cwd: Optional[Path], timeout: int, desc: str, 
                    progress: Progress) -> Tuple[bool, float]:
    log.info(f"Executing: {' '.join(cmd)}")
    start = time.time()
    
    task = progress.add_task(f"[cyan]{desc}", total=100, visible=True)
    current_package = ""
    
    try:
        proc = subprocess.Popen(
            cmd, 
            cwd=cwd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            bufsize=1
        )
        
        for line in iter(proc.stdout.readline, ''):
            if not line:
                continue
                
            log.debug(line.rstrip())
            
            if "Downloading" in line or "Collecting" in line:
                pkg_match = re.search(r'(Downloading|Collecting)\s+(\S+)', line)
                if pkg_match:
                    current_package = pkg_match.group(2).split('-')[0]
                    progress.update(task, description=f"[cyan]{desc} - {current_package}")
            
            parsed = parse_pip_progress(line)
            if parsed:
                current_bytes, total_bytes = parsed
                if total_bytes > 0:
                    percentage = (current_bytes / total_bytes) * 100
                    progress.update(task, completed=percentage)
                    
                    current_mb = current_bytes / (1024**2)
                    total_mb = total_bytes / (1024**2)
                    progress.update(
                        task, 
                        description=f"[cyan]{desc} - {current_package} ({current_mb:.1f}/{total_mb:.1f} MB)"
                    )
        
        proc.wait(timeout=timeout)
        elapsed = time.time() - start
        
        progress.update(task, completed=100)
        progress.remove_task(task)
        
        if proc.returncode != 0:
            log.error(f"Exit code {proc.returncode}")
        
        return proc.returncode == 0, elapsed
        
    except Exception as e:
        elapsed = time.time() - start
        log.error(f"Execution failed: {e}")
        progress.remove_task(task)
        return False, elapsed

def exec_stream_npm(cmd: List[str], cwd: Optional[Path], timeout: int, desc: str,
                    progress: Progress) -> Tuple[bool, float]:
    log.info(f"Executing: {' '.join(cmd)}")
    start = time.time()
    
    task = progress.add_task(f"[cyan]{desc}", total=100, visible=True)
    
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        total_packages = 0
        current_package = 0
        
        for line in iter(proc.stdout.readline, ''):
            if not line:
                continue
                
            log.debug(line.rstrip())
            
            parsed = parse_npm_progress(line)
            if parsed:
                current_package, total_packages = parsed
                if total_packages > 0:
                    percentage = (current_package / total_packages) * 100
                    progress.update(
                        task, 
                        completed=percentage,
                        description=f"[cyan]{desc} ({current_package}/{total_packages} packages)"
                    )
        
        proc.wait(timeout=timeout)
        elapsed = time.time() - start
        
        progress.update(task, completed=100)
        progress.remove_task(task)
        
        if proc.returncode != 0:
            log.error(f"Exit code {proc.returncode}")
        
        return proc.returncode == 0, elapsed
        
    except Exception as e:
        elapsed = time.time() - start
        log.error(f"Execution failed: {e}")
        progress.remove_task(task)
        return False, elapsed

def exec_stream_docker(cmd: List[str], cwd: Optional[Path], timeout: int, desc: str,
                       progress: Progress) -> Tuple[bool, float]:
    log.info(f"Executing: {' '.join(cmd)}")
    start = time.time()
    
    task = progress.add_task(f"[cyan]{desc}", total=100, visible=True)
    layers = {}
    
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        for line in iter(proc.stdout.readline, ''):
            if not line:
                continue
                
            log.debug(line.rstrip())
            
            if "Pulling" in line:
                service = re.search(r'Pulling\s+(\S+)', line)
                if service:
                    progress.update(task, description=f"[cyan]{desc} - Pulling {service.group(1)}")
            elif "Building" in line:
                progress.update(task, description=f"[cyan]{desc} - Building images")
            elif "Creating" in line:
                progress.update(task, description=f"[cyan]{desc} - Creating containers")
            
            parsed = parse_docker_progress(line)
            if parsed:
                layer_id, layer_progress = parsed
                layers[layer_id] = layer_progress
                
                if layers:
                    avg_progress = sum(layers.values()) / len(layers)
                    progress.update(task, completed=avg_progress)
        
        proc.wait(timeout=timeout)
        elapsed = time.time() - start
        
        progress.update(task, completed=100)
        progress.remove_task(task)
        
        if proc.returncode != 0:
            log.error(f"Exit code {proc.returncode}")
        
        return proc.returncode == 0, elapsed
        
    except Exception as e:
        elapsed = time.time() - start
        log.error(f"Execution failed: {e}")
        progress.remove_task(task)
        return False, elapsed

def exec_stream(cmd: List[str], cwd: Optional[Path], timeout: int, desc: str, 
                progress: Progress) -> Tuple[bool, float]:
    log.info(f"Executing: {' '.join(cmd)}")
    start = time.time()
    
    task = progress.add_task(f"[cyan]{desc}", total=None)
    
    try:
        proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, 
                               stderr=subprocess.STDOUT, text=True, bufsize=1)
        
        for line in iter(proc.stdout.readline, ''):
            if line:
                log.debug(line.rstrip())
        
        proc.wait(timeout=timeout)
        elapsed = time.time() - start
        progress.remove_task(task)
        
        if proc.returncode != 0:
            log.error(f"Exit code {proc.returncode}")
        
        return proc.returncode == 0, elapsed
        
    except Exception as e:
        elapsed = time.time() - start
        log.error(f"Execution failed: {e}")
        progress.remove_task(task)
        return False, elapsed

def exec_quiet(cmd: List[str], cwd: Optional[Path] = None, timeout: int = 60) -> bool:
    log.info(f"Executing: {' '.join(cmd)}")
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, timeout=timeout)
        if r.returncode != 0:
            log.error(r.stderr.decode())
        return r.returncode == 0
    except Exception as e:
        log.error(f"Execution failed: {e}")
        return False

def validate_venv(venv_path: Path, expected_python: str) -> Tuple[bool, str]:
    venv_py = venv_path / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python")
    
    if not venv_py.exists():
        return False, "Python executable missing"
    
    try:
        result = subprocess.run([str(venv_py), "--version"], capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            return False, "Python executable not working"
        
        if "3.11" not in result.stdout:
            return False, f"Wrong Python version ({result.stdout.strip()})"
        
        result = subprocess.run([str(venv_py), "-m", "pip", "--version"], capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            return False, "pip not functional"
        
        return True, "OK"
        
    except Exception as e:
        log.debug(f"venv validation error: {e}")
        return False, f"Validation failed"

def validate_node_modules(node_modules_path: Path) -> Tuple[bool, str]:
    if not node_modules_path.exists():
        return False, "Does not exist"
    
    try:
        contents = list(node_modules_path.iterdir())
        if not contents:
            return False, "Empty folder"
        
        bin_folder = node_modules_path / ".bin"
        if not bin_folder.exists():
            return False, "Incomplete installation"
        
        return True, "OK"
        
    except Exception as e:
        log.debug(f"node_modules validation error: {e}")
        return False, "Validation failed"

def validate_docker_containers(root: Path, ip: str) -> Tuple[bool, str]:
    if not shutil.which("docker-compose"):
        return False, "docker-compose not found"
    
    if not (root / "docker-compose.yml").exists():
        return False, "docker-compose.yml not found"
    
    try:
        result = subprocess.run(["docker-compose", "ps", "-q"], cwd=root, capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            return False, "docker-compose command failed"
        
        container_ids = result.stdout.strip()
        if not container_ids:
            return False, "No containers found"
        
        result = subprocess.run(["docker-compose", "ps", "--status", "running", "-q"], cwd=root, capture_output=True, text=True, timeout=5)
        running_ids = result.stdout.strip()
        if not running_ids:
            return False, "Containers exist but not running"
        
        backend_check = requests.get(f"http://{ip}:8000/health", timeout=2)
        if backend_check.status_code != 200:
            return False, "Backend not responding"
        
        frontend_check = requests.get(f"http://{ip}/", timeout=2)
        if frontend_check.status_code != 200:
            return False, "Frontend not responding"
        
        return True, "OK"
        
    except subprocess.TimeoutExpired:
        return False, "docker-compose timeout"
    except requests.exceptions.RequestException:
        return False, "Services not responding"
    except Exception as e:
        log.debug(f"Docker validation error: {e}")
        return False, "Validation failed"

def install_ffmpeg_auto(progress: Progress, state: InstallState) -> bool:
    if Stage.FFMPEG.value in state.completed_stages:
        if check_ffmpeg():
            console.print("[green]✓[/green] FFmpeg installed")
            return True
        else:
            console.print("[yellow]⚠[/yellow] FFmpeg missing (was previously found)")
    
    start = time.time()
    
    if check_ffmpeg():
        console.print("[green]✓[/green] FFmpeg found")
        state.complete_stage(Stage.FFMPEG, time.time() - start)
        return True
    
    console.print("[yellow]⚠[/yellow] FFmpeg not found")
    console.print("  [dim]Attempting auto-install...[/dim]")
    
    if platform.system() == "Windows":
        task = progress.add_task("[cyan]Trying winget", total=None)
        if exec_quiet(["winget", "install", "ffmpeg", "-e", "--silent", "--accept-source-agreements"], timeout=180):
            progress.remove_task(task)
            time.sleep(2)
            if check_ffmpeg():
                console.print("[green]✓[/green] FFmpeg installed via winget")
                state.complete_stage(Stage.FFMPEG, time.time() - start)
                return True
        progress.remove_task(task)
        
        task = progress.add_task("[cyan]Trying chocolatey", total=None)
        if exec_quiet(["choco", "install", "ffmpeg", "-y"], timeout=180):
            progress.remove_task(task)
            time.sleep(2)
            if check_ffmpeg():
                console.print("[green]✓[/green] FFmpeg installed via chocolatey")
                state.complete_stage(Stage.FFMPEG, time.time() - start)
                return True
        progress.remove_task(task)
    
    console.print("\n[red]✗[/red] Auto-install failed - manual installation required")
    console.print("\n[bold]FFmpeg is REQUIRED for audio processing[/bold]")
    console.print("  [dim]The application cannot work without it[/dim]\n")
    
    if platform.system() == "Windows":
        console.print("[bold]Install FFmpeg (choose one):[/bold]")
        console.print("  1. PowerShell: [cyan]winget install ffmpeg[/cyan]")
        console.print("  2. Chocolatey: [cyan]choco install ffmpeg[/cyan]")
        console.print("  3. Manual: Download from https://ffmpeg.org/download.html")
        console.print("     • Extract to C:\\ffmpeg")
        console.print("     • Add C:\\ffmpeg\\bin to PATH")
        console.print("     • Restart terminal/installer")
    elif platform.system() == "Darwin":
        console.print("[bold]Install FFmpeg:[/bold]")
        console.print("  [cyan]brew install ffmpeg[/cyan]")
    else:
        console.print("[bold]Install FFmpeg:[/bold]")
        console.print("  Ubuntu/Debian: [cyan]sudo apt install ffmpeg[/cyan]")
        console.print("  CentOS/RHEL:   [cyan]sudo yum install ffmpeg[/cyan]")
    
    console.print("\n[yellow]After installing FFmpeg, run this installer again[/yellow]")
    console.print("[dim]Your progress has been saved[/dim]")
    return False

def install_ssl_auto(backend: Path, progress: Progress, state: InstallState) -> bool:
    if Stage.SSL.value in state.completed_stages:
        cert_files = list(backend.glob("localhost+*.pem"))
        if cert_files:
            state.use_zerocopy = True
            return True
    
    start = time.time()
    
    cert_files = list(backend.glob("localhost+*.pem"))
    key_files = list(backend.glob("localhost+*-key.pem"))
    
    if cert_files and key_files:
        console.print(f"[green]✓[/green] SSL certificates found ({cert_files[0].name})")
        state.use_zerocopy = True
        state.complete_stage(Stage.SSL, time.time() - start)
        return True
    
    if check_mkcert():
        console.print("[cyan]Generating SSL certificates...[/cyan]")
        
        exec_quiet(["mkcert", "-install"], cwd=backend, timeout=30)
        
        if exec_quiet(["mkcert", "localhost", "192.168.1.*", "192.168.*.*", "127.0.0.1", "::1"], cwd=backend, timeout=30):
            cert_files = list(backend.glob("localhost+*.pem"))
            if cert_files:
                console.print(f"[green]✓[/green] SSL certificates generated ({cert_files[0].name})")
                state.use_zerocopy = True
                state.complete_stage(Stage.SSL, time.time() - start)
                return True
    
    console.print("[dim]SSL certificates unavailable (HTTPS disabled)[/dim]")
    state.use_zerocopy = False
    state.complete_stage(Stage.SSL, time.time() - start)
    return True

def install_libretranslate_auto(sys: System, backend: Path, venv_py: str, progress: Progress, state: InstallState) -> bool:
    if Stage.LIBRETRANSLATE.value in state.completed_stages:
        console.print("[green]✓[/green] Translation service configured")
        return True
    
    start = time.time()
    
    venv_libretranslate = backend / "venv" / ("Scripts/libretranslate.exe" if platform.system() == "Windows" else "bin/libretranslate")
    
    if venv_libretranslate.exists():
        console.print("[green]✓[/green] Translation service installed")
        state.libretranslate_mode = "pip"
        state.complete_stage(Stage.LIBRETRANSLATE, time.time() - start)
        return True
    
    if sys.docker_installed:
        result = run(["docker", "ps", "-a", "--filter", "name=libretranslate", "--format", "{{.Names}}"])
        if result and "libretranslate" in result:
            console.print("[green]✓[/green] Translation service (Docker)")
            state.libretranslate_mode = "docker"
            state.complete_stage(Stage.LIBRETRANSLATE, time.time() - start)
            return True
    
    if sys.docker_installed and sys.docker_running:
        console.print("[cyan]Setting up translation service (Docker)...[/cyan]")
        
        success = exec_quiet([
            "docker", "run", "-d",
            "--name", "libretranslate",
            "-p", f"{LIBRETRANSLATE_PORT}:5000",
            "--restart", "unless-stopped",
            "libretranslate/libretranslate"
        ], timeout=300)
        
        if success:
            console.print(f"[green]✓[/green] Translation service started")
            state.libretranslate_mode = "docker"
            state.complete_stage(Stage.LIBRETRANSLATE, time.time() - start)
            return True
    
    console.print("[cyan]Installing translation service...[/cyan]")
    console.print("  [dim]Downloading language models (~500MB, takes 2-3 min)...[/dim]")
    
    success, elapsed = exec_stream_pip(
        [venv_py, "-m", "pip", "install", "libretranslate"],
        backend,
        300,
        "Installing LibreTranslate",
        progress
    )
    
    if success:
        console.print("[green]✓[/green] Translation service installed")
        state.libretranslate_mode = "pip"
        state.complete_stage(Stage.LIBRETRANSLATE, time.time() - start)
        return True
    else:
        console.print("[yellow]⚠[/yellow] Translation service unavailable (not critical)")
        state.libretranslate_mode = None
        state.complete_stage(Stage.LIBRETRANSLATE, time.time() - start)
        return True

def start_docker() -> bool:
    if platform.system() == "Windows":
        paths = [
            Path("C:/Program Files/Docker/Docker/Docker Desktop.exe"),
            Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Docker/Docker/Docker Desktop.exe"
        ]
        
        for path in paths:
            if path.exists():
                subprocess.Popen([str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                break
    
    for delay in [1, 2, 4, 8, 16]:
        if run(["docker", "info"], timeout=2):
            return True
        time.sleep(delay)
    
    for _ in range(29):
        if run(["docker", "info"], timeout=2):
            return True
        time.sleep(1)
    
    return False

def install_docker(root: Path, ip: str, progress: Progress, state: InstallState) -> bool:
    if not (root / "docker-compose.yml").exists():
        console.print("[red]✗[/red] docker-compose.yml not found")
        log.error(f"Expected at: {root / 'docker-compose.yml'}")
        return False
    
    if Stage.DOCKER.value in state.completed_stages:
        is_valid, reason = validate_docker_containers(root, ip)
        
        if is_valid:
            console.print("[green]✓[/green] Docker containers already running")
            return True
        else:
            console.print(f"[yellow]⚠[/yellow] Containers have issues: {reason}")
            
            if reason == "Containers exist but not running":
                console.print("[cyan]Starting existing containers...[/cyan]")
                result = subprocess.run(["docker-compose", "up", "-d"], cwd=root, capture_output=True, timeout=30)
                
                if result.returncode == 0:
                    time.sleep(3)
                    is_valid, reason = validate_docker_containers(root, ip)
                    if is_valid:
                        console.print("[green]✓[/green] Containers started")
                        return True
            
            if Confirm.ask("Rebuild containers?", default=True):
                console.print("[cyan]Stopping existing containers...[/cyan]")
                subprocess.run(["docker-compose", "down"], cwd=root, capture_output=True, timeout=30)
                console.print("[green]✓[/green] Containers stopped")
            else:
                return False
    
    start = time.time()
    
    success, elapsed = exec_stream_docker(
        ["docker-compose", "up", "--build", "-d"],
        root,
        600,
        "Building and starting containers",
        progress
    )
    
    if not success:
        console.print("[red]✗[/red] Container build failed")
        return False
    
    state.complete_stage(Stage.DOCKER, elapsed)
    console.print(f"[green]✓[/green] Containers started ({elapsed:.1f}s)")
    
    checks = [
        (f"http://{ip}:8000/health", "Backend health"),
        (f"http://{ip}/", "Frontend ready"),
    ]
    
    for url, desc in checks:
        task = progress.add_task(f"[cyan]{desc}", total=None)
        
        success = False
        for delay in [1, 2, 4, 8, 16]:
            try:
                log.debug(f"Health check: {url}")
                r = requests.get(url, timeout=3)
                if r.status_code == 200:
                    success = True
                    break
            except:
                pass
            time.sleep(delay)
        
        progress.remove_task(task)
        
        if not success:
            console.print(f"[red]✗[/red] {desc} failed")
            return False
        
        console.print(f"[green]✓[/green] {desc}")
    
    time.sleep(3)
    return True

def install_pytorch(sys: System, venv_py: str, backend: Path, progress: Progress, state: InstallState) -> bool:
    if Stage.PYTORCH.value in state.completed_stages:
        try:
            result = subprocess.run([venv_py, "-c", "import torch; print(torch.__version__)"],
                                  capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                version = result.stdout.strip()
                console.print(f"[green]✓[/green] PyTorch {version} already installed")
                return True
            else:
                console.print("[yellow]⚠[/yellow] PyTorch marked complete but not found")
                if not Confirm.ask("Reinstall PyTorch?", default=True):
                    return True
        except Exception as e:
            log.warning(f"PyTorch validation failed: {e}")
    
    cache = backend / ".pip_cache"
    cache.mkdir(exist_ok=True)
    
    cmd = [
        venv_py, "-m", "pip", "install",
        "torch==2.6.0", "torchaudio==2.6.0",
        "--extra-index-url", "https://download.pytorch.org/whl/cu124",
        "--cache-dir", str(cache),
        "--only-binary", ":all:"
    ]
    
    success, elapsed = exec_stream_pip(cmd, backend, PYTORCH_INSTALL_TIMEOUT, "Installing PyTorch 2.6.0", progress)
    
    if success:
        state.complete_stage(Stage.PYTORCH, elapsed)
        console.print(f"[green]✓[/green] PyTorch installed ({elapsed:.1f}s)")
    else:
        console.print("[red]✗[/red] PyTorch installation failed")
        state.errors.append("PyTorch installation failed")
        state.save()
    
    return success

def install_deps_parallel(venv_py: str, backend: Path, frontend: Path, npm_path: str, progress: Progress, state: InstallState) -> bool:
    backend_done = Stage.BACKEND.value in state.completed_stages
    frontend_done = Stage.FRONTEND.value in state.completed_stages
    
    if backend_done and frontend_done:
        console.print("[green]✓[/green] Dependencies already installed")
        return True
    
    cache = backend / ".pip_cache"
    
    if not backend_done:
        req = backend / "requirements-local.txt"
        if not req.exists():
            req = backend / "requirements.txt"
        
        if not req.exists():
            console.print(f"[red]✗[/red] Requirements file not found")
            return False
        
        cmd = [venv_py, "-m", "pip", "install", "--cache-dir", str(cache), "-r", str(req)]
        success, elapsed = exec_stream_pip(cmd, backend, 600, "Installing backend dependencies", progress)
        
        if success:
            state.complete_stage(Stage.BACKEND, elapsed)
            console.print(f"[green]✓[/green] Backend deps ({elapsed:.1f}s)")
        else:
            console.print(f"[red]✗[/red] Backend deps failed")
            return False
    
    if not frontend_done and (frontend / "package.json").exists() and npm_path:
        if not npm_path:
            console.print("[red]✗[/red] Node.js/npm not found")
            console.print("\n[bold]Node.js is REQUIRED for this application[/bold]")
            console.print("  Download from: https://nodejs.org/\n")
            console.print("[yellow]After installing, run this installer again[/yellow]")
            return False
        
        node_modules = frontend / "node_modules"
        if node_modules.exists():
            is_valid, reason = validate_node_modules(node_modules)
            if not is_valid:
                console.print(f"[yellow]⚠[/yellow] Reinstalling node packages ({reason})")
                shutil.rmtree(node_modules, ignore_errors=True)
                time.sleep(0.5)
        
        cmd = [npm_path, "install", "--prefer-offline"]
        success, elapsed = exec_stream_npm(cmd, frontend, 600, "Installing frontend dependencies", progress)
        
        if success:
            state.complete_stage(Stage.FRONTEND, elapsed)
            console.print(f"[green]✓[/green] Frontend deps ({elapsed:.1f}s)")
        else:
            console.print(f"[red]✗[/red] Frontend deps failed")
            return False
    
    return True

def install_manual(sys: System, root: Path, progress: Progress, state: InstallState) -> bool:
    backend = root / "backend"
    frontend = root / "frontend"
    venv = backend / "venv"
    
    if not backend.exists() or not frontend.exists():
        console.print("[red]✗[/red] Project structure invalid")
        return False
    
    if venv.exists():
        is_valid, reason = validate_venv(venv, sys.python_path)
        
        if is_valid:
            console.print("[green]✓[/green] Using existing virtual environment")
        else:
            console.print(f"[yellow]⚠[/yellow] Existing venv has issues: {reason}")
            
            if Confirm.ask("Recreate virtual environment?", default=True):
                shutil.rmtree(venv, ignore_errors=True)
                time.sleep(0.5)
            else:
                console.print("[yellow]⚠[/yellow] Using existing venv (may cause issues)")
    
    if not venv.exists():
        task = progress.add_task("[cyan]Creating virtual environment", total=None)
        success = exec_quiet([sys.python_path, "-m", "venv", str(venv)])
        progress.remove_task(task)
        
        if not success:
            console.print("[red]✗[/red] Virtual environment creation failed")
            return False
        console.print("[green]✓[/green] Virtual environment created")
    
    venv_py = str(venv / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python"))
    
    if not install_pytorch(sys, venv_py, backend, progress, state):
        return False
    
    if not install_deps_parallel(venv_py, backend, frontend, sys.npm_path, progress, state):
        return False
    
    if not install_ffmpeg_auto(progress, state):
        return False
    
    if not install_ssl_auto(backend, progress, state):
        return False
    
    if not install_libretranslate_auto(sys, backend, venv_py, progress, state):
        return False
    
    return True

def verify_manual(backend: Path, progress: Progress) -> bool:
    venv_py = backend / "venv" / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python")
    
    task = progress.add_task("[cyan]Verifying installation", total=None)
    
    try:
        r = subprocess.run([str(venv_py), "-c", "import torch; print(torch.__version__)"],
                          capture_output=True, timeout=5)
        progress.remove_task(task)
        
        if r.returncode == 0:
            ver = r.stdout.decode().strip()
            console.print(f"[green]✓[/green] PyTorch {ver} operational")
            return True
        
        console.print("[red]✗[/red] Import test failed")
        return False
        
    except Exception as e:
        progress.remove_task(task)
        console.print(f"[red]✗[/red] Verification error: {e}")
        return False

def cleanup_failed(root: Path, state: InstallState):
    backend = root / "backend"
    frontend = root / "frontend"
    
    if Stage.PYTORCH.value not in state.completed_stages:
        venv = backend / "venv"
        if venv.exists():
            shutil.rmtree(venv, ignore_errors=True)
    
    if Stage.FRONTEND.value not in state.completed_stages:
        node_modules = frontend / "node_modules"
        if node_modules.exists():
            shutil.rmtree(node_modules, ignore_errors=True)

def start_services_manual(root: Path, sys: System, state: InstallState, progress: Progress) -> bool:
    backend = root / "backend"
    frontend = root / "frontend"
    venv_py = backend / "venv" / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python")
    
    processes = []
    
    try:
        console.print("\n[bold cyan]Starting Services[/bold cyan]\n")
        
        if state.libretranslate_mode == "pip":
            console.print("[cyan]Starting LibreTranslate...[/cyan]")
            venv_libretranslate = backend / "venv" / ("Scripts/libretranslate.exe" if platform.system() == "Windows" else "bin/libretranslate")
            
            if venv_libretranslate.exists():
                try:
                    lt_proc = subprocess.Popen(
                        [str(venv_libretranslate), "--host", "0.0.0.0", "--port", str(LIBRETRANSLATE_PORT)],
                        cwd=backend,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
                    )
                    processes.append(("LibreTranslate", lt_proc))
                    console.print(f"[green]✓[/green] LibreTranslate started (PID: {lt_proc.pid})")
                    time.sleep(2)
                except Exception as e:
                    console.print(f"[yellow]⚠[/yellow] LibreTranslate failed to start: {e}")
        
        elif state.libretranslate_mode == "docker":
            result = run(["docker", "ps", "--filter", "name=libretranslate", "--format", "{{.Names}}"])
            if result and "libretranslate" in result:
                console.print("[green]✓[/green] LibreTranslate (Docker) already running")
            else:
                console.print("[yellow]⚠[/yellow] LibreTranslate Docker container not running")
                console.print("  Start manually: docker start libretranslate")
        
        console.print("[cyan]Starting HTTP backend...[/cyan]")
        
        http_proc = subprocess.Popen(
            [str(venv_py), "-m", "hypercorn", "app.main:app",
             "--bind", f"0.0.0.0:{BACKEND_HTTP_PORT}",
             "--keep-alive", "300"],
            cwd=backend,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        )
        processes.append(("Backend HTTP", http_proc))
        console.print(f"[green]✓[/green] HTTP backend started (PID: {http_proc.pid})")
        
        if state.use_zerocopy:
            console.print("[cyan]Starting HTTPS backend (ZeroCopy)...[/cyan]")
            
            cert_files = list(backend.glob("localhost+*.pem"))
            key_files = list(backend.glob("localhost+*-key.pem"))
            
            if cert_files and key_files:
                cert_file = cert_files[0]
                key_file = key_files[0]
                
                https_proc = subprocess.Popen(
                    [str(venv_py), "-m", "hypercorn", "app.main:app",
                     "--bind", f"0.0.0.0:{BACKEND_HTTPS_PORT}",
                     "--certfile", str(cert_file),
                     "--keyfile", str(key_file),
                     "--keep-alive", "300"],
                    cwd=backend,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
                )
                processes.append(("Backend HTTPS", https_proc))
                console.print(f"[green]✓[/green] HTTPS backend started (PID: {https_proc.pid})")
            else:
                console.print("[yellow]⚠[/yellow] SSL certificates not found, HTTPS disabled")
                state.use_zerocopy = False
        
        console.print("[cyan]Starting frontend...[/cyan]")
        
        npm_path = sys.npm_path if sys.npm_path else "npm"
        
        frontend_proc = subprocess.Popen(
            [npm_path, "run", "dev"],
            cwd=frontend,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        )
        processes.append(("Frontend", frontend_proc))
        console.print(f"[green]✓[/green] Frontend started (PID: {frontend_proc.pid})")
        
        console.print("\n[cyan]Waiting for services to initialize...[/cyan]")
        
        task = progress.add_task("[cyan]Initializing services", total=None)
        time.sleep(8)
        progress.remove_task(task)
        
        console.print("[cyan]Checking service health...[/cyan]")
        
        for attempt in range(10):
            try:
                r = requests.get(f"http://{sys.ip}:{BACKEND_HTTP_PORT}/health", timeout=2)
                if r.status_code == 200:
                    console.print(f"[green]✓[/green] Backend responding")
                    break
            except:
                if attempt < 9:
                    time.sleep(1)
                else:
                    console.print(f"[yellow]⚠[/yellow] Backend not responding (may still be starting)")
        
        for attempt in range(10):
            try:
                r = requests.get(f"http://{sys.ip}:{FRONTEND_PORT}/", timeout=2)
                if r.status_code == 200:
                    console.print(f"[green]✓[/green] Frontend ready")
                    break
            except:
                if attempt < 9:
                    time.sleep(1)
                else:
                    console.print(f"[yellow]⚠[/yellow] Frontend not responding (may still be starting)")
        
        console.print("\n[cyan]Opening application in browser...[/cyan]")
        url = f"http://{sys.ip}:{FRONTEND_PORT}"
        show_launch_screen(url, state)
        time.sleep(1)
        webbrowser.open(url)
        
        console.clear()
        console.print("\n[bold green]✓ Application Running[/bold green]\n")
        
        console.print("[bold]Access URLs:[/bold]")
        console.print(f"  • Application: [cyan]http://{sys.ip}:{FRONTEND_PORT}[/cyan]")
        console.print(f"  • Backend API: [cyan]http://{sys.ip}:{BACKEND_HTTP_PORT}[/cyan]")
        
        if state.use_zerocopy:
            console.print(f"  • ZeroCopy HTTPS: [magenta]https://{sys.ip}:{BACKEND_HTTPS_PORT}[/magenta]")
            console.print("\n[dim]First upload: Accept SSL certificate in browser[/dim]")
        
        if state.libretranslate_mode:
            console.print(f"  • Translation: [cyan]http://{sys.ip}:{LIBRETRANSLATE_PORT}[/cyan]")
        
        console.print("\n[bold]Mobile Access:[/bold]")
        console.print(f"  • Scan QR code in app for: [cyan]http://{sys.ip}:{FRONTEND_PORT}/mobile-upload[/cyan]")
        
        console.print("\n[bold]Process Management:[/bold]")
        for name, proc in processes:
            console.print(f"  • {name}: PID {proc.pid}")
        
        console.print("\n[yellow]Press Ctrl+C or Enter to stop all services...[/yellow]\n")
        
        def cleanup_processes():
            console.print("\n[cyan]Shutting down services...[/cyan]")
            for name, proc in processes:
                try:
                    if proc.poll() is None:
                        console.print(f"  Stopping {name} (PID {proc.pid})...")
                        proc.terminate()
                        try:
                            proc.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            proc.kill()
                except Exception as e:
                    log.debug(f"Error stopping {name}: {e}")
            console.print("[green]✓[/green] All services stopped\n")
        
        atexit.register(cleanup_processes)
        
        def signal_handler(sig, frame):
            cleanup_processes()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        if platform.system() != "Windows":
            signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            input()
        except (KeyboardInterrupt, EOFError):
            pass
        
        cleanup_processes()
        return True
        
    except Exception as e:
        console.print(f"\n[red]✗[/red] Error starting services: {e}")
        log.exception("Service startup failed")
        
        for name, proc in processes:
            try:
                if proc.poll() is None:
                    proc.terminate()
            except:
                pass
        
        return False

def check_services_ready(ip: str, mode: str) -> bool:
    try:
        url = f"http://{ip}" if mode == "docker" else f"http://{ip}:5173"
        log.info(f"Service check: {url}")
        
        r = requests.get(url, timeout=3)
        return r.status_code == 200
        
    except:
        return False

def show_launch_screen(url: str, state: InstallState):
    console.clear()
    
    if console.width < 70:
        console.print("\n[bold green]✓ Application Ready[/bold green]\n")
        console.print(f"[cyan]Opening in browser...[/cyan]\n")
        return
    
    border = "═" * 54
    
    art = f"""[green]
    ╔{border}╗
    ║                                                      ║
    ║                  ✓ APPLICATION READY                 ║
    ║                                                      ║
    ║              Opening in your browser...              ║
    ║                                                      ║
    ╚{border}╝[/green]
    """
    
    console.print(art)
    console.print()

def auto_close_timer(seconds: int):
    if platform.system() == "Windows":
        import msvcrt
        start = time.time()
        while time.time() - start < seconds:
            if msvcrt.kbhit():
                msvcrt.getch()
                return
            time.sleep(0.1)
    else:
        time.sleep(seconds)

def show_splash():
    console.clear()
    
    if console.width < 60:
        console.print("\n[bold cyan]AI Transcription Installer[/bold cyan]")
        console.print("[dim]v2.0 Complete System • hollowed_eyes[/dim]\n")
        return
    
    art = """[cyan]
    ╔══════════════════════════════════════════════════╗
    ║                                                  ║
    ║            AI Transcription Installer            ║
    ║                  v2.0 - Complete                 ║
    ║                                                  ║
    ║                                                  ║
    ║                   hollowed_eyes                  ║        
    ║                                                  ║
    ╚══════════════════════════════════════════════════╝[/cyan]
    """
    
    console.print(art)
    console.print()
    time.sleep(0.5)

def show_system_simple(sys: System):
    t = Table(box=box.SIMPLE, show_header=False, padding=(0, 2), border_style="dim")
    t.add_column(style="cyan", no_wrap=True, width=14)
    t.add_column()
    
    t.add_row("System", f"[white]{sys.os}[/white]")
    t.add_row("RAM", f"[white]{sys.ram_gb:.1f} GB[/white]")
    t.add_row("Storage", f"[white]{sys.disk_gb:.1f} GB available[/white]")
    t.add_row("", "")
    
    if sys.gpu:
        t.add_row("GPU", f"[magenta]{sys.gpu.name}[/magenta]")
        t.add_row("", f"[dim]{sys.gpu.vram_gb:.1f} GB • Recommended: {sys.gpu.recommended_model}[/dim]")
    
    console.print(t)
    console.print()

def explain_installation_mode(sys: System) -> str:
    console.print("[bold cyan]Installation Options[/bold cyan]\n")
    
    if sys.docker_installed:
        console.print("[green]✓[/green] [bold]Docker Desktop Detected[/bold]")
        console.print("  [dim]Recommended - fully automated with containers[/dim]")
        console.print("  [dim]• One-click setup and launch[/dim]")
        console.print("  [dim]• Easy to manage[/dim]\n")
        
        use_docker = Confirm.ask("Use Docker installation?", default=True)
        
        if use_docker:
            console.print("\n[green]→[/green] Using Docker (automated)")
            return "docker"
        else:
            console.print("\n[yellow]→[/yellow] Switching to manual installation")
    else:
        console.print("[yellow]ℹ[/yellow] [bold]Docker Desktop Not Found[/bold]")
        console.print("  [dim]No problem! Installing locally instead.[/dim]\n")
        
        console.print("[bold]Local installation:[/bold]")
        console.print("  [dim]• Uses Python on your computer[/dim]")
        console.print("  [dim]• Requires Python 3.11[/dim]\n")
        
        if not sys.python_ver:
            console.print("[red]✗[/red] Python 3.11 required but not found")
            console.print("\n[bold]Next steps:[/bold]")
            console.print("  1. Install Python 3.11: https://www.python.org/downloads/")
            console.print("  2. Run installer again\n")
            return None
        elif sys.python_ver[0] != 3 or sys.python_ver[1] != 11:
            ver = ".".join(map(str, sys.python_ver))
            console.print(f"[yellow]⚠[/yellow] Found Python {ver}, need 3.11")
            console.print("\n[bold]Install Python 3.11:[/bold]")
            console.print("  https://www.python.org/downloads/\n")
            return None
        
        console.print(f"[green]✓[/green] Python 3.11 ready")
    
    console.print()
    return "manual"

def show_summary(state: InstallState):
    total = sum(state.timings.values())
    
    if total < 60:
        time_str = f"{total:.1f}s"
    else:
        minutes = int(total // 60)
        seconds = int(total % 60)
        time_str = f"{minutes}m {seconds}s"
    
    console.print(f"\n[green]✓ Installation completed in {time_str}[/green]\n")

def show_post_install_info(state: InstallState, sys: System, root: Path):
    console.print("[bold green]✓ Installation Complete![/bold green]\n")
    
    if state.mode == "docker":
        console.print("[bold]Your application is ready[/bold]\n")
        console.print("[dim]Access URLs:[/dim]")
        console.print(f"  • Application: http://{sys.ip}")
        console.print(f"  • Backend API: http://{sys.ip}:8000")
        if state.libretranslate_mode:
            console.print(f"  • Translation: http://{sys.ip}:5000")
        console.print()
        
        console.print("[dim]Mobile access:[/dim]")
        console.print(f"  • Scan QR code in app for: http://{sys.ip}/mobile-upload")
        console.print()
        
        console.print("[dim]Management:[/dim]")
        console.print("  docker-compose logs -f    [dim]# View logs[/dim]")
        console.print("  docker-compose restart    [dim]# Restart[/dim]")
        console.print("  docker-compose down       [dim]# Stop[/dim]")
        
    else:
        console.print("[bold]Manual startup required:[/bold]\n")
        
        console.print("1. Backend:")
        console.print(f"   cd {root / 'backend'}")
        if platform.system() == "Windows":
            console.print("   venv\\Scripts\\activate")
        else:
            console.print("   source venv/bin/activate")
        console.print("   uvicorn app.main:app")
        console.print()
        
        if state.libretranslate_mode == "pip":
            console.print("2. Translation (optional):")
            console.print("   libretranslate --host 0.0.0.0 --port 5000")
            console.print()
        
        console.print(f"{'3' if state.libretranslate_mode == 'pip' else '2'}. Frontend (new terminal):")
        console.print(f"   cd {root / 'frontend'}")
        console.print("   npm run dev")
        console.print()
        
        console.print(f"4. Open: http://{sys.ip}:5173")
        
        if state.use_zerocopy:
            console.print("\n[bold cyan]ZeroCopy Enabled:[/bold cyan]")
            console.print("  First upload: Accept SSL certificate in browser")
            console.print("  Then enjoy 10x faster uploads!")

def main():
    try:
        root = Path.cwd()
        
        sys = detect_system()
        state = InstallState.load()
        
        # Check INSTALL STATE first, then use port detection
        if state and state.mode == "manual" and check_port_in_use(FRONTEND_PORT):
            url = f"http://{sys.ip}:{FRONTEND_PORT}"
            
            show_launch_screen(url, state)
            time.sleep(1)
            webbrowser.open(url)
            console.print("[dim]Auto-closing in 5 seconds...[/dim]")
            auto_close_timer(5)
            return
        
        if state and state.mode == "docker" and (check_port_in_use(80) or check_port_in_use(BACKEND_HTTP_PORT)):
            url = f"http://{sys.ip}"
            
            show_launch_screen(url, state)
            time.sleep(1)
            webbrowser.open(url)
            console.print("[dim]Auto-closing in 5 seconds...[/dim]")
            auto_close_timer(5)
            return
        
        # Fallback: port detection only if no state exists
        # Check port 5173 FIRST (manual mode - Vite is unique to manual)
        if not state and check_port_in_use(FRONTEND_PORT):
            url = f"http://{sys.ip}:{FRONTEND_PORT}"
            state = InstallState.new("manual")
            
            show_launch_screen(url, state)
            time.sleep(1)
            webbrowser.open(url)
            console.print("[dim]Auto-closing in 5 seconds...[/dim]")
            auto_close_timer(5)
            return
        
        # Then check Docker (port 80/8000 could be either mode)
        if not state and sys.docker_installed and (check_port_in_use(80) or check_port_in_use(BACKEND_HTTP_PORT)):
            url = f"http://{sys.ip}"
            state = InstallState.new("docker")
            
            show_launch_screen(url, state)
            time.sleep(1)
            webbrowser.open(url)
            console.print("[dim]Auto-closing in 5 seconds...[/dim]")
            auto_close_timer(5)
            return
        
        if state and state.stage == Stage.COMPLETE:
            console.clear()
            
            if state.mode == "docker":
                console.print("\n[yellow]Application installed but not running[/yellow]\n")
                show_post_install_info(state, sys, root)
                console.print("\n[dim]Press Enter to close...[/dim]")
                input()
                return
            
            else:
                console.print("\n[cyan]Launching application...[/cyan]\n")
                
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    console=console,
                    transient=True
                ) as progress:
                    if start_services_manual(root, sys, state, progress):
                        return
                    else:
                        console.print("\n[yellow]Could not start services automatically[/yellow]")
                        show_post_install_info(state, sys, root)
                        console.print("\n[dim]Press Enter to close...[/dim]")
                        input()
                        return
        
        show_splash()
        
        has_docker_compose = (root / "docker-compose.yml").exists()
        has_project_structure = (root / "backend").exists() and (root / "frontend").exists()
        
        if not has_docker_compose and not has_project_structure:
            console.clear()
            console.print("\n[red]✗ Not in project directory[/red]\n")
            console.print("[bold]Please run the installer from your project folder[/bold]")
            console.print(f"  Currently in: [dim]{root}[/dim]\n")
            console.print("Expected structure:")
            console.print("  • docker-compose.yml OR")
            console.print("  • backend/ and frontend/ folders\n")
            console.print("[dim]Press Enter to close...[/dim]")
            input()
            return
        
        console.print("[cyan]Checking system...[/cyan]")
        
        if sys.docker_installed:
            console.print(f"[green]✓[/green] Docker Desktop {'running' if sys.docker_running else 'found'}")
        else:
            console.print("[dim]○[/dim] Docker Desktop not found")
        
        if sys.python_ver:
            ver = ".".join(map(str, sys.python_ver))
            if sys.python_ver[1] == 11:
                console.print(f"[green]✓[/green] Python {ver}")
            else:
                console.print(f"[yellow]○[/yellow] Python {ver} (need 3.11)")
        else:
            console.print("[dim]○[/dim] Python 3.11 not found")
        
        if sys.node_ver and sys.npm_path:
            console.print(f"[green]✓[/green] Node.js {sys.node_ver}")
        elif sys.node_ver:
            console.print(f"[yellow]○[/yellow] Node.js {sys.node_ver} (need 18+)")
        else:
            console.print("[dim]○[/dim] Node.js not found")
        
        console.print()
        
        if state and state.completed_stages:
            console.print(f"[yellow]Incomplete installation found[/yellow]")
            console.print(f"Completed: {', '.join(state.completed_stages)}\n")
            
            if not Confirm.ask("Resume?", default=True):
                STATE.unlink()
                state = None
                console.print("[dim]Starting fresh...[/dim]\n")
        
        show_system_simple(sys)
        
        if not state:
            mode = explain_installation_mode(sys)
            if mode is None:
                console.print("[dim]Press Enter to close...[/dim]")
                input()
                return
            
            state = InstallState.new(mode)
            state.save()
        else:
            if state.mode == "docker":
                console.print(f"[green]→[/green] Continuing Docker installation\n")
            else:
                console.print(f"[green]→[/green] Continuing manual installation\n")
        
        if not state.completed_stages:
            issues = validate_system(sys, state.mode)
            if issues:
                console.print("[red]⚠ Requirements not met:[/red]\n")
                for issue in issues:
                    console.print(f"  • {issue}")
                console.print("\n[dim]Press Enter to close...[/dim]")
                input()
                return
        
        console.print()
        if state.mode == "docker":
            console.print("[bold]Ready to install (Docker mode)[/bold]")
            console.print("  [dim]Takes a few minutes...[/dim]")
        else:
            console.print("[bold]Ready to install (Manual mode)[/bold]")
            console.print("  [dim]Downloads PyTorch and dependencies (5-10 min)[/dim]")
        
        console.print()
        
        if not Confirm.ask("Continue?", default=True):
            console.print("\n[dim]Cancelled[/dim]")
            console.print("[dim]Press Enter to close...[/dim]")
            input()
            return
        
        console.print()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True
        ) as progress:
            
            if state.mode == "docker":
                if not sys.docker_running:
                    task = progress.add_task("[cyan]Starting Docker Desktop", total=None)
                    if not start_docker():
                        progress.remove_task(task)
                        console.print("[red]✗[/red] Docker failed to start")
                        console.print("\n[yellow]Start Docker Desktop and try again[/yellow]\n")
                        console.print("[dim]Press Enter to close...[/dim]")
                        input()
                        return
                    progress.remove_task(task)
                    console.print("[green]✓[/green] Docker started")
                
                success = install_docker(root, sys.ip, progress, state)
                
            else:
                success = install_manual(sys, root, progress, state)
                
                if success:
                    verify_manual(root / "backend", progress)
            
            if not success:
                cleanup_failed(root, state)
                console.print(f"\n[yellow]Installation incomplete[/yellow]")
                console.print(f"[dim]Run again to resume[/dim]")
                console.print("\n[dim]Press Enter to close...[/dim]")
                input()
                return
        
        state.stage = Stage.COMPLETE
        state.save()
        
        show_summary(state)
        
        if state.mode == "docker":
            console.print("[cyan]Opening application...[/cyan]")
            time.sleep(2)
            
            webbrowser.open(f"http://{sys.ip}")
            
            console.print("\n[dim]Auto-closing in 5 seconds...[/dim]")
            auto_close_timer(5)
        
        else:
            console.print("\n[bold cyan]Installation Complete! Starting services...[/bold cyan]\n")
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
                transient=True
            ) as progress:
                if start_services_manual(root, sys, state, progress):
                    return
                else:
                    console.print("\n[yellow]Could not start services automatically[/yellow]")
                    show_post_install_info(state, sys, root)
                    console.print("\n[dim]Press Enter to close...[/dim]")
                    input()
        
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Interrupted[/yellow]")
        if 'state' in locals():
            console.print("[dim]Progress saved - run again to resume[/dim]")
        console.print("\n[dim]Press Enter to close...[/dim]")
        input()
        
    except Exception as e:
        console.print(f"\n[red]Unexpected error[/red]")
        log.exception("Fatal error")
        
        if 'state' in locals() and 'root' in locals():
            cleanup_failed(root, state)
        
        console.print("[dim]Check log for details[/dim]")
        console.print("\n[dim]Press Enter to close...[/dim]")
        input()

if __name__ == "__main__":
    main()