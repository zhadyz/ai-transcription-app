# Changelog

All notable changes to this project will be documented in this file.

## [1.5.1] - 2025-10-09

### Added
- **Large Model Support**: Added Whisper large-v2 and large-v3 model options
- **Adaptive File Validation**: Smart retry logic scales with file size (up to 8 attempts for 3GB+ files)
- **Disk Sync Safety**: Added `os.fsync()` to prevent race conditions with large file uploads

### Fixed
- **Large File Upload Bug**: Fixed "inode/blockdevice" error for files > 2GB
  - Files now wait up to 8 seconds for OS disk sync before validation
  - 500MB files: 1.2s max wait
  - 2GB files: 4.8s max wait  
  - 3GB+ files: 8.0s max wait
- **LibreTranslate Startup**: Fixed startup script to use correct venv path
- **Model Quality Validation**: Backend now accepts large-v2 and large-v3 quality parameters

### Changed
- Enhanced logging for file validation process
- Improved error messages for disk sync issues
- Better progress reporting during large file uploads

### Technical Details
- `stream_upload.py`: Added explicit file descriptor sync after flush
- `validation_service.py`: Implemented adaptive retry delays (0.2s - 1.0s per attempt)
- `transcribe.py`: Extended quality literal types and quality_map dictionaries
- `start.ps1`: Direct venv path execution for LibreTranslate

## [1.5.0] - 2025-10-08
...
🔴 REMOVED
 uvicorn → Replaced with hypercorn (HTTP/2 support)
 python-engineio → Not used
 python-socketio → Using native WebSocket
 simple-websocket → Not needed
bidict → Not used

🟢 ADDED
 hypercorn → HTTP/2 + HTTPS ASGI server
 requests with better session handling
 Updated pydantic settings
 Production-ready logging
 
🟡 UPDATED
⬆ fastapi → Latest stable
⬆ websockets → Latest
⬆ aiofiles → Latest
⬆ faster-whisper → Latest