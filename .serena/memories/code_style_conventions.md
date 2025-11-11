# Code Style and Conventions

## TypeScript/React (Frontend)

### File Organization
- Components use PascalCase: `FileUpload.tsx`, `MobileUpload.tsx`
- Lazy loading for route components: `const FileUpload = lazy(() => import('./components/upload/FileUpload'))`
- Context providers for state management: `SessionProvider`, `WebSocketProvider`, `LiveCaptureProvider`

### React Patterns
- Functional components with hooks (no class components)
- `useMemo` for expensive computations and preventing re-renders
- Custom hooks in `hooks/` directory
- Context API for global state
- Lazy and Suspense for code splitting

### Styling
- TailwindCSS utility classes preferred
- Responsive design with mobile-first approach
- Class names follow Tailwind conventions: `className="relative min-h-screen bg-black"`

### Imports
- Group imports logically: React/libraries first, then local imports
- Absolute imports from `src/`: `'./core/SessionContext'`, `'./components/upload/FileUpload'`

### Debugging
- Console logging for development: `console.log('🎯🎯🎯 [APP.TSX] ...')`
- Emoji prefixes for visual distinction in logs

### Type Safety
- TypeScript strict mode enabled
- Explicit typing preferred
- Type definitions in `types/` directory

## Python (Backend)

### Module Documentation
- Docstrings with separator lines at top of files
- Clear section headers with description of module purpose
- Example:
```python
"""
═══════════════════════════════════════════════════════════════════════════
AI TRANSCRIPTION API - MAIN APPLICATION
═══════════════════════════════════════════════════════════════════════════
Enterprise-grade audio/video transcription with AI
"""
```

### Code Organization
- Service layer pattern: logic in `services/`
- API routes in `api/routes/`
- Models/schemas in `models/`
- Configuration in `config.py`
- Middleware in `middleware/`

### Async/Await
- Extensive use of async/await for I/O operations
- `asyncio.create_task()` for background tasks
- `@asynccontextmanager` for lifespan management

### Type Hints
- Type hints preferred for function parameters and return values
- Pydantic models for data validation

### Logging
- Structured logging system with `logging_config.py`
- Request ID tracking: `set_request_id()`, `clear_request_id()`
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Context in log messages: `logger.info(f"Configuration: GPU={'enabled' if ...}")`

### Error Handling
- Try-except blocks with logging: `logger.error(f"Error: {e}", exc_info=True)`
- Graceful degradation and fallback mechanisms
- Rate limiting with custom error handlers

### Naming Conventions
- Snake_case for functions and variables: `cleanup_sessions_periodically()`
- PascalCase for classes: `TranscriptionQuality`
- SCREAMING_SNAKE_CASE for constants: `MAX_FILE_SIZE_MB`, `CLEANUP_INTERVAL_SECONDS`
- Descriptive names: `device_stats_task`, `broadcast_device_stats_periodically()`

## General Principles
- Over-engineered for learning purposes (acknowledged in README)
- Professional engineering standards in comments and documentation
- Performance optimization priority (zero-copy streaming, constant memory)
- Extensive error handling and logging
- Security considerations (rate limiting, input validation)
