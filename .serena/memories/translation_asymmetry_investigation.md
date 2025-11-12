# Translation Asymmetry Investigation - THE DIDACT

## Problem Statement
English→Spanish real-time translation fails, but Spanish→English works.

## Root Cause (85% confidence)
**Language code normalization issue** between Whisper output and NLLB input.

Whisper may return:
- "english", "en", "eng" (for English)
- "spanish", "es", "spa" (for Spanish)

Translation service expects ISO 639-1 codes ("en", "es").

## Critical Code Paths

### 1. Language Detection
- **File**: `backend/app/api/routes/realtime.py`
- **Line**: 388
- **Issue**: `segment.language` from Whisper not normalized

### 2. Translation Call
- **File**: `backend/app/api/routes/realtime.py`
- **Lines**: 420-424
- **Issue**: Uses raw `segment.language` without normalization

### 3. Language Code Mapping
- **File**: `backend/app/services/translation_service.py`
- **Lines**: 95-96
- **Behavior**: `get_language_code()` has fallback to "eng_Latn" if key not found

### 4. Error Handling
- **File**: `backend/app/services/translation_service.py`
- **Lines**: 130-132
- **Issue**: Returns `None` on failure, error not surfaced to user

## Fixes Applied (or to be applied)

1. **Add comprehensive logging** to translation service (CRITICAL)
2. **Normalize Whisper language codes** before translation (HIGH)
3. **Add translation model warmup** on startup (MEDIUM)
4. **Surface translation errors** to frontend (LOW)

## Testing Commands

```bash
# Check backend logs
docker-compose logs -f backend | grep -i "language\|translat"

# Test translation service directly
python backend/test_translation_realtime.py

# Monitor GPU memory
watch -n 1 nvidia-smi
```

## Stability Concerns

1. NLLB-200 + Whisper may exceed VRAM on low-end GPUs
2. Errors swallowed silently (returns None)
3. Singleton service with stateful tokenizer
4. No model warmup (first call may timeout)
5. Language code inconsistency from Whisper

## Date
2025-11-11
