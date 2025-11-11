# Suggested Commands for Development

## Windows-Specific Commands (Git Bash)

### System Utilities
- `ls` - List directory contents
- `cd <path>` - Change directory (use quotes for paths with spaces: `cd "path with spaces"`)
- `pwd` - Print working directory
- `cat <file>` - Display file contents
- `grep <pattern> <file>` - Search for pattern in files
- `find . -name <pattern>` - Find files by name pattern
- `ipconfig | findstr IPv4` - Find local IP address (PowerShell)
- `netstat -ano | findstr :<PORT>` - Identify process using a port
- `taskkill /F /PID <pid>` - Kill process by PID
- `tasklist` - List all running processes

### Git Commands
- `git status` - Check repository status
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit with message
- `git push` - Push to remote
- `git pull` - Pull from remote
- `git log` - View commit history
- `git diff` - View unstaged changes

## Docker Commands (Primary Deployment Method)

### Quick Start
- `START-HERE.bat` - **ONE-CLICK START** for Windows Docker deployment (recommended)
- Double-click `START-HERE.bat` to auto-start Docker, display IP, and open browser

### Docker Compose
- `docker-compose up -d` - Start all services in detached mode
- `docker-compose down` - Stop and remove all containers
- `docker-compose restart` - Restart all services
- `docker-compose logs -f` - Follow logs from all services
- `docker-compose logs -f backend` - Follow backend logs only
- `docker-compose logs -f frontend` - Follow frontend logs only
- `docker-compose build` - Rebuild containers
- `docker-compose build backend` - Rebuild backend only
- `docker-compose ps` - List running containers
- `docker-compose exec backend bash` - Access backend container shell
- `docker-compose exec frontend sh` - Access frontend container shell

### Docker Management
- `docker info` - Verify Docker daemon status
- `docker ps` - List running containers
- `docker ps -a` - List all containers (including stopped)
- `docker images` - List Docker images
- `docker system prune` - Clean up unused containers/images (use with caution)

### Docker GPU Support
- `docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi` - Verify GPU access

## Frontend Development

### Development Server
- `cd frontend` - Navigate to frontend directory
- `npm install` - Install dependencies
- `npm run dev` - Start Vite development server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### File Operations
- View package.json: `cat frontend/package.json`
- Check TypeScript config: `cat frontend/tsconfig.json`
- View Vite config: `cat frontend/vite.config.ts`

## Backend Development

### Native Development (Python 3.11.x required)
- `cd backend` - Navigate to backend directory
- `python -m venv venv` - Create virtual environment
- `venv\Scripts\activate` (Windows) - Activate virtual environment
- `pip install -r requirements-local.txt` - Install Windows dependencies
- `pip install -r requirements.txt` - Install Linux/Docker dependencies
- `hypercorn app.main:app --bind 0.0.0.0:8000 --reload` - Start backend server with auto-reload

### Service Management
- `python x.py` - Automated installer and service launcher (native deployment)
- `OnyxTranscription.exe` - Alternative automated installer (Windows)

### Python Utilities
- `python --version` - Check Python version (must be 3.11.x)
- `pip list` - List installed packages
- `pip freeze > requirements.txt` - Export dependencies
- `python -c "import torch; print(torch.cuda.is_available())"` - Verify CUDA availability

## Translation Service

### LibreTranslate (Docker)
- `docker run -d -p 5000:5000 libretranslate/libretranslate` - Start LibreTranslate container
- `curl http://localhost:5000/languages` - Verify service availability

### LibreTranslate (Native)
- `pip install libretranslate` - Install LibreTranslate
- `libretranslate --host 0.0.0.0 --port 5000` - Start service

## Testing and Validation

### Test Scripts (in project root)
- `python fully_automated_test.py` - Fully automated testing
- `python test_automation.py` - Test automation script
- `python test_websocket.py` - WebSocket connection testing
- `python test_with_real_audio.py` - Audio transcription testing

### Stress Testing
- `python backend/stress_test.py` - Backend stress testing

## Accessing the Application

### Local Access
- Browser: `http://localhost` (Docker) or `http://localhost:5173` (native frontend dev)
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs` (FastAPI Swagger UI)

### Network Access (Mobile/Other Devices)
- Find IP: Check `APP-INFO.txt` (created by START-HERE.bat)
- Or run: `ipconfig | findstr IPv4` (Windows PowerShell)
- Access: `http://<YOUR-IP-ADDRESS>` (Docker)
- Access: `http://<YOUR-IP-ADDRESS>:5173` (native dev)

## Troubleshooting

### Port Conflicts
- Check port usage: `netstat -ano | findstr :80` or `netstat -ano | findstr :8000`
- Kill process: `taskkill /F /PID <pid>`

### Docker Issues
- Restart Docker Desktop
- Check daemon: `docker info`
- View logs: `docker-compose logs -f`

### SSL/TLS Certificate Regeneration
```bash
cd backend
mkcert -install
mkcert localhost 192.168.1.* 192.168.*.* 127.0.0.1 ::1
```

### FFmpeg Verification
- `ffmpeg -version` - Check FFmpeg installation

## Configuration Files

### Backend Configuration
- Environment variables: `backend/.env`
- Docker environment: `docker-compose.yml` (backend.environment section)
- Main config: `backend/app/config.py`

### Frontend Configuration
- Backend URL config: `frontend/src/config/backend.ts`
- Vite config: `frontend/vite.config.ts`
- TailwindCSS: `frontend/tailwind.config.js`

## Project Structure Navigation
```bash
# Key directories
ls backend/app/api/routes/      # API endpoints
ls backend/app/services/         # Business logic
ls backend/app/models/           # Pydantic models
ls frontend/src/components/      # React components
ls frontend/src/hooks/           # Custom React hooks
ls frontend/src/core/            # CRDT synchronization
```

## Log Analysis
```bash
cat scripts/installer.log       # Installer logs
ls backend/logs/                 # Backend application logs
docker-compose logs -f           # Docker container logs
```
