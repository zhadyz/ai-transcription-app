# Security Requirements for Authentication System

## Executive Summary

This document defines comprehensive security requirements for the transcription application's authentication system, aligned with OWASP authentication best practices. The current implementation uses API key-based authentication suitable for offline/air-gapped deployments.

**Current Status:** FAIL - Multiple critical security issues identified
**Priority:** HIGH - Address critical issues before production deployment

---

## 1. AUTHENTICATION SECURITY CHECKLIST

### 1.1 API Key Management

#### CRITICAL ISSUES

- [ ] **CRITICAL: Hardcoded API Keys in Source Code**
  - **Location:** `backend/app/config.py` lines 48-52
  - **Issue:** API keys stored directly in source code
  - **OWASP:** A02:2021 - Cryptographic Failures
  - **Risk:** Keys exposed in version control, shared repositories
  - **Fix Required:** Move to environment variables exclusively
  ```python
  # CURRENT (INSECURE):
  ALLOWED_API_KEYS: list[str] = [
      "dev-key-12345",      # Development key
      "prod-key-67890",     # Production key
      "mobile-key-abcde"    # Mobile client key
  ]

  # REQUIRED (SECURE):
  ALLOWED_API_KEYS: list[str] = Field(
      default_factory=list,
      description="API keys loaded from environment"
  )

  @field_validator('ALLOWED_API_KEYS', mode='before')
  @classmethod
  def parse_api_keys(cls, v):
      if isinstance(v, str):
          import json
          return json.loads(v)
      return v
  ```

- [ ] **CRITICAL: Weak API Keys**
  - **Issue:** Keys are predictable and low-entropy
  - **OWASP:** A07:2021 - Identification and Authentication Failures
  - **Risk:** Brute force attacks, dictionary attacks
  - **Fix Required:** Generate cryptographically secure keys
  ```python
  # Minimum requirements:
  # - 32+ characters
  # - Cryptographically random (secrets module)
  # - Include special characters

  import secrets
  def generate_api_key() -> str:
      return secrets.token_urlsafe(32)  # 256 bits of entropy
  ```

- [ ] **CRITICAL: API Key Logging**
  - **Location:** `backend/app/middleware/auth.py` lines 40, 46
  - **Issue:** Partial API keys logged (first 8 chars)
  - **OWASP:** A09:2021 - Security Logging and Monitoring Failures
  - **Risk:** Key reconstruction from logs, information leakage
  - **Fix Required:** Log key hash or ID instead
  ```python
  # CURRENT (INSECURE):
  logger.warning(f"Invalid API key attempted: {api_key[:8]}...")

  # REQUIRED (SECURE):
  import hashlib
  key_id = hashlib.sha256(api_key.encode()).hexdigest()[:8]
  logger.warning(f"Invalid API key attempted: ID={key_id}")
  ```

#### HIGH PRIORITY

- [ ] **API Key Rotation Not Implemented**
  - **Issue:** No mechanism to rotate/revoke keys
  - **Risk:** Compromised keys cannot be invalidated
  - **Fix Required:** Implement key versioning and expiration

- [ ] **No Key Expiration**
  - **Issue:** Keys valid indefinitely
  - **Risk:** Long-lived credentials increase exposure window
  - **Fix Required:** Add expiration timestamps to keys

- [ ] **No Per-Client Key Tracking**
  - **Issue:** Cannot track which key is used by which client
  - **Risk:** Cannot audit or revoke individual clients
  - **Fix Required:** Implement key metadata (client_id, issued_at, expires_at)

### 1.2 Session Security

#### MEDIUM PRIORITY

- [ ] **Session Timeout - PARTIAL**
  - **Status:** 1-hour timeout implemented (session_service.py line 17)
  - **Issue:** Timeout not configurable per environment
  - **Fix Required:**
    - Production: 15-30 minutes
    - Development: 1 hour
    ```python
    SESSION_TIMEOUT_SECONDS: int = Field(
        default=1800 if ENV == "production" else 3600
    )
    ```

- [ ] **Session ID Security - ACCEPTABLE**
  - **Status:** Uses UUID4 (cryptographically random)
  - **Location:** `session_service.py` line 22
  - **Note:** Meets security requirements (122 bits entropy)

- [ ] **No Session Invalidation on Security Events**
  - **Issue:** Sessions not invalidated on suspicious activity
  - **Risk:** Compromised sessions remain active
  - **Fix Required:** Implement session kill on:
    - Multiple failed auth attempts
    - IP address changes
    - User-initiated logout

### 1.3 Password Requirements

**STATUS:** N/A - System uses API keys, not passwords

**RECOMMENDATION:** If implementing user accounts:
- Minimum 12 characters
- Complexity: Upper, lower, number, special character
- No common passwords (use dictionary check)
- Password hashing: Argon2id or bcrypt (cost factor 12+)

### 1.4 Transport Security

#### MEDIUM PRIORITY

- [ ] **HTTPS Configuration**
  - **Status:** SSL certificates present (main.py lines 349-350)
  - **Files:** `localhost+2.pem`, `localhost+2-key.pem`
  - **Issue:** Using self-signed certificates
  - **Production Requirement:**
    - Use proper CA-signed certificates
    - Force HTTPS redirect
    - HSTS headers
    - TLS 1.2+ only

- [ ] **WebSocket Security**
  - **Issue:** WebSocket over WSS required in production
  - **Current:** WS:// used (session.py line 92)
  - **Fix Required:** Use WSS:// with proper certificates

---

## 2. INJECTION PREVENTION

### 2.1 SQL Injection Prevention

**STATUS:** N/A - Application does not use SQL databases

**Architecture:** In-memory data structures with file-based storage
- Sessions: Dict in memory
- Files: Direct filesystem operations
- No SQL query construction

### 2.2 Command Injection Prevention

#### HIGH PRIORITY

- [ ] **FFmpeg Command Construction - NEEDS REVIEW**
  - **Location:** Check transcription pipeline for FFmpeg usage
  - **Risk:** Unsanitized filenames in shell commands
  - **Requirement:** Use subprocess with argument arrays, not shell=True
  ```python
  # SECURE:
  subprocess.run(['ffmpeg', '-i', input_file, output_file], shell=False)

  # INSECURE:
  subprocess.run(f'ffmpeg -i {input_file} {output_file}', shell=True)
  ```

### 2.3 Path Traversal Prevention

#### ACCEPTABLE

- [x] **Filename Sanitization Implemented**
  - **Location:** `validation_service.py` lines 180-204
  - **Implementation:**
    - Strips path components (line 191)
    - Removes path separators (line 194)
    - Removes null bytes (line 197)
    - Length limiting (lines 200-202)
  - **Status:** PASS

- [ ] **File Access Validation - NEEDS IMPROVEMENT**
  - **Issue:** No verification that accessed files are within allowed directories
  - **Risk:** Potential path traversal via symlinks
  - **Fix Required:**
  ```python
  from pathlib import Path

  def validate_file_path(file_path: Path, allowed_dir: Path) -> bool:
      """Ensure file is within allowed directory."""
      try:
          file_path.resolve().relative_to(allowed_dir.resolve())
          return True
      except ValueError:
          return False
  ```

---

## 3. XSS PREVENTION IN API RESPONSES

### 3.1 Content Security

#### LOW PRIORITY (API-only, no HTML rendering)

- [ ] **Content-Type Headers**
  - **Status:** FastAPI defaults to application/json
  - **Recommendation:** Explicitly set for all responses
  ```python
  @app.middleware("http")
  async def set_security_headers(request: Request, call_next):
      response = await call_next(request)
      response.headers["Content-Type"] = "application/json"
      response.headers["X-Content-Type-Options"] = "nosniff"
      return response
  ```

- [ ] **Input Validation for User-Controlled Fields**
  - **Fields requiring sanitization:**
    - Filename (DONE - validation_service.py)
    - Language codes
    - Export format parameters
  - **Status:** Pydantic enum validation in place (ACCEPTABLE)

### 3.2 CORS Configuration

#### CRITICAL

- [ ] **CORS Allows All Origins**
  - **Location:** `main.py` line 209
  - **Current:** `allow_origins=["*"]`
  - **Issue:** Any domain can make requests
  - **OWASP:** A05:2021 - Security Misconfiguration
  - **Fix Required:**
  ```python
  # Production:
  allow_origins=[
      "https://yourdomain.com",
      "https://app.yourdomain.com"
  ]

  # Development:
  allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"]
  ```

---

## 4. BRUTE FORCE PROTECTION

### 4.1 Rate Limiting

#### ACCEPTABLE (with recommendations)

- [x] **Rate Limiting Implemented**
  - **Library:** slowapi (rate_limit.py)
  - **Storage:** In-memory (line 20)
  - **Limits:**
    - Session creation: 50/hour (development: unlimited)
    - File upload: 20/hour (development: unlimited)
    - General API: 1000/hour (development: unlimited)

- [ ] **Production Storage Required**
  - **Current:** In-memory storage (lost on restart)
  - **Issue:** Rate limits reset on app restart
  - **Fix Required:** Use Redis for persistence
  ```python
  # config.py
  RATE_LIMIT_STORAGE: str = Field(
      default="memory://" if IS_DEVELOPMENT else "redis://localhost:6379"
  )

  # rate_limit.py
  limiter = Limiter(
      key_func=get_remote_address,
      storage_uri=settings.RATE_LIMIT_STORAGE
  )
  ```

- [ ] **No Account Lockout**
  - **Issue:** Unlimited authentication attempts from same IP
  - **Risk:** Brute force API key guessing
  - **Fix Required:** Implement exponential backoff
  ```python
  # After 5 failed attempts from same IP within 10 minutes:
  # - 1st fail: no delay
  # - 5th fail: 60 second delay
  # - 10th fail: 10 minute delay
  # - 20th fail: 1 hour lockout
  ```

### 4.2 Authentication Attempt Tracking

#### HIGH PRIORITY

- [ ] **No Failed Login Tracking**
  - **Issue:** Failed authentication attempts not logged or tracked
  - **Risk:** Cannot detect brute force attacks
  - **Fix Required:**
  ```python
  failed_attempts: Dict[str, List[float]] = {}

  async def verify_api_key(api_key: str, client_ip: str):
      if api_key not in settings.ALLOWED_API_KEYS:
          failed_attempts.setdefault(client_ip, []).append(time.time())

          # Check if threshold exceeded
          recent = [t for t in failed_attempts[client_ip]
                   if time.time() - t < 600]  # 10 minutes

          if len(recent) > 5:
              raise HTTPException(429, "Too many failed attempts")
  ```

---

## 5. SECURITY HEADERS

### 5.1 Required Headers

#### HIGH PRIORITY

- [ ] **Missing Security Headers**
  - **Issue:** No security headers configured
  - **Fix Required:**
  ```python
  @app.middleware("http")
  async def add_security_headers(request: Request, call_next):
      response = await call_next(request)
      response.headers["X-Content-Type-Options"] = "nosniff"
      response.headers["X-Frame-Options"] = "DENY"
      response.headers["X-XSS-Protection"] = "1; mode=block"
      response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
      response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
      return response
  ```

---

## 6. LOGGING AND MONITORING

### 6.1 Security Event Logging

#### MEDIUM PRIORITY

- [ ] **Insufficient Security Logging**
  - **Current:** Basic auth failures logged (auth.py lines 40, 46)
  - **Missing:**
    - Authentication success events
    - Session creation/destruction
    - Rate limit violations
    - Suspicious patterns
  - **Fix Required:** Structured logging with correlation IDs

- [ ] **No Alerting System**
  - **Issue:** Security events not monitored or alerted
  - **Recommendation:** Implement webhook/email alerts for:
    - 10+ failed auth attempts in 1 minute
    - API key reuse from multiple IPs
    - Large file uploads outside business hours

---

## 7. ENVIRONMENT-SPECIFIC SECURITY

### 7.1 Development vs Production

#### CRITICAL

- [ ] **Insecure Development Defaults**
  - **Issue:** Same default keys in dev and prod
  - **Risk:** Development keys used in production
  - **Fix Required:**
  ```python
  class Settings(BaseSettings):
      @field_validator('ALLOWED_API_KEYS')
      @classmethod
      def validate_keys_for_environment(cls, v, info):
          if info.data.get('ENV') == 'production':
              if any('dev-key' in key for key in v):
                  raise ValueError("Development keys not allowed in production")
              if len(v) < 1:
                  raise ValueError("Production requires at least one API key")
          return v
  ```

---

## 8. DEPENDENCY SECURITY

### 8.1 Package Vulnerabilities

#### HIGH PRIORITY

- [ ] **No Dependency Scanning**
  - **Issue:** Dependencies not scanned for vulnerabilities
  - **Fix Required:**
  ```bash
  pip install safety
  safety check --file requirements.txt

  # Add to CI/CD:
  - pip install pip-audit
  - pip-audit
  ```

- [ ] **Outdated Packages**
  - **Recommendation:** Keep dependencies updated
  - **Critical packages to monitor:**
    - fastapi
    - pydantic
    - slowapi
    - websockets

---

## COMPLIANCE MATRIX

### OWASP Top 10 2021 Coverage

| ID | Vulnerability | Status | Notes |
|----|---------------|--------|-------|
| A01 | Broken Access Control | PARTIAL | Rate limiting OK, need IP-based controls |
| A02 | Cryptographic Failures | FAIL | Hardcoded keys, weak entropy |
| A03 | Injection | PASS | No SQL, path traversal prevented |
| A04 | Insecure Design | PARTIAL | Need security architecture review |
| A05 | Security Misconfiguration | FAIL | CORS, dev defaults, missing headers |
| A06 | Vulnerable Components | UNKNOWN | Need dependency audit |
| A07 | Authentication Failures | FAIL | Weak keys, no rotation, logging issues |
| A08 | Data Integrity Failures | PASS | File validation implemented |
| A09 | Security Logging | PARTIAL | Basic logging, need monitoring |
| A10 | SSRF | N/A | No external HTTP requests from user input |

### Overall Security Score: 3.5/10 (FAIL)

---

## REMEDIATION PRIORITY

### IMMEDIATE (Before ANY Production Use)

1. Remove hardcoded API keys from source code
2. Generate cryptographically secure keys
3. Fix API key logging (use hashes)
4. Configure CORS properly
5. Implement authentication failure tracking

### SHORT TERM (Within 1 Sprint)

6. Move to Redis for rate limiting
7. Add security headers middleware
8. Implement key rotation mechanism
9. Add proper HTTPS/WSS configuration
10. Dependency vulnerability scanning

### MEDIUM TERM (Within 2 Sprints)

11. Comprehensive security event logging
12. Alerting system for security events
13. Session invalidation on security events
14. IP-based access controls
15. Security audit trail

---

## SECURITY TESTING REQUIREMENTS

See `SECURITY_TESTS.md` for detailed test specifications.

---

## SIGN-OFF

**Created By:** LOVELESS (QA Security Agent)
**Date:** 2025-10-15
**Status:** SECURITY REVIEW FAILED
**Recommendation:** DO NOT DEPLOY TO PRODUCTION until critical issues resolved

**Next Review:** After critical issues addressed
