# Task Completion Guidelines

## What to Do When a Task is Completed

When completing development tasks on this project, follow these steps to ensure code quality and proper testing:

### 1. Code Quality Checks

#### Frontend (TypeScript/React)
- **Lint**: Run `npm run lint` from the `frontend/` directory
  - Fix any ESLint errors or warnings
  - Ensure TypeScript compilation succeeds with no errors
- **Type Check**: TypeScript compiler runs during lint/build
  - Address any type errors before committing

#### Backend (Python)
- **No Formal Linter Configured**: Currently no automatic linting/formatting tool configured
- **Manual Review**: 
  - Check for proper type hints on functions
  - Verify docstrings follow project conventions (separator lines, clear descriptions)
  - Ensure logging statements are appropriate
  - Verify error handling with try-except blocks

### 2. Testing

#### Manual Testing Priority
This project emphasizes **manual testing** with real scenarios:

1. **Docker Deployment Test**:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   docker-compose logs -f
   ```
   - Verify all services start without errors
   - Check backend logs for successful model preloading
   - Verify frontend is accessible at `http://localhost`

2. **Functional Tests**:
   - Test file upload (small and large files)
   - Test transcription with different model sizes
   - Test translation functionality
   - Test mobile device pairing (QR code)
   - Test WebSocket real-time updates
   - Test different export formats (SRT, VTT, TXT, CSV, JSON)

3. **Automated Test Scripts** (if applicable):
   ```bash
   python fully_automated_test.py
   python test_websocket.py
   python test_with_real_audio.py
   ```

#### Native Development Testing
If running without Docker:
1. Start backend: `cd backend && hypercorn app.main:app --bind 0.0.0.0:8000 --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Test at `http://localhost:5173`

### 3. Build Verification

#### Frontend Build
```bash
cd frontend
npm run build
```
- Ensure build completes without errors
- Check for warnings about bundle size or unused dependencies
- Verify build output in `frontend/dist/`

#### Docker Build
```bash
docker-compose build
```
- Verify both frontend and backend containers build successfully
- No errors during dependency installation

### 4. Documentation Updates

When making significant changes:
- Update relevant sections in `README.md`
- Update API documentation if endpoints changed
- Update version history if releasing a new version
- Consider updating architecture documentation if structural changes made

### 5. Git Workflow

#### Before Committing
1. Check status: `git status`
2. Review changes: `git diff`
3. Stage relevant files: `git add <files>`
4. Check what's staged: `git diff --staged`

#### Committing
- Use descriptive commit messages
- Follow project convention: clear, concise description
- Reference issue numbers if applicable

#### Branch Strategy
- Main branch: `main`
- Current experimental branch: `experimental/v2.0-api-first`
- Feature branches: `feature/<feature-name>`

### 6. Performance Considerations

When making changes that could affect performance:
- **Backend**: Monitor memory usage, GPU utilization, processing time
- **Frontend**: Check bundle size with `npm run build`, test render performance
- **Docker**: Verify container resource usage with `docker stats`

### 7. Security Checks

Before completing tasks involving:
- **File uploads**: Verify file validation and size limits
- **API endpoints**: Check rate limiting is working
- **User input**: Ensure proper sanitization and validation
- **Environment variables**: Verify sensitive data not committed

### 8. Deployment Readiness

For production-ready changes:
1. Test in Docker environment (closest to production)
2. Verify all environment variables are documented
3. Test with GPU disabled (CPU mode) for compatibility
4. Test large file uploads (up to 5GB)
5. Verify mobile device connectivity
6. Check WebSocket stability under load

## Common Issues to Check

### Backend
- Port conflicts (8000, 8443, 5000)
- Python version compatibility (must be 3.11.x)
- CUDA availability for GPU mode
- FFmpeg installed and accessible
- LibreTranslate service running

### Frontend
- Port conflicts (80 for Docker, 5173 for dev)
- Node.js version (18.0+)
- Backend URL configuration correct
- WebSocket connection established
- CORS issues resolved

### Docker
- Docker Desktop running
- NVIDIA Docker runtime installed (if using GPU)
- Sufficient disk space for images
- Port mappings correct
- Volume mounts working

## Quality Standards

### Code Quality
- Follow existing code style conventions
- Add appropriate comments for complex logic
- Use meaningful variable and function names
- Implement proper error handling
- Add logging at appropriate levels

### Testing Quality
- Test happy path scenarios
- Test error conditions
- Test edge cases (large files, network issues, etc.)
- Verify graceful degradation
- Test across different environments (Docker vs native)

## Notes

- **No unit tests currently configured**: Project relies on integration testing and manual verification
- **Over-engineering acknowledged**: Project intentionally explores advanced patterns
- **Performance priority**: Zero-copy streaming, constant memory footprint
- **Production-grade standards**: Despite being experimental, code should maintain professional quality
