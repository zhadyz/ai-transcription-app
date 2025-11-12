# Authentication System API Documentation

Comprehensive authentication system with JWT tokens, session management, and role-based access control.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Database Schema](#database-schema)
5. [Authentication Flow](#authentication-flow)
6. [Error Handling](#error-handling)
7. [Security Features](#security-features)
8. [Integration Guide](#integration-guide)

---

## Overview

### Features

- **User Registration & Login**: Email/password authentication with strong password requirements
- **JWT Tokens**: Access tokens (15 min) and refresh tokens (30 days)
- **Token Rotation**: Secure refresh token rotation for enhanced security
- **Session Management**: Multi-device session tracking and management
- **Password Reset**: Secure password reset flow with time-limited tokens
- **Role-Based Access Control**: Support for user, premium, and admin roles
- **Account Security**: Account lockout after failed attempts, email verification
- **Audit Logging**: Comprehensive security event logging

### Technology Stack

- **Framework**: FastAPI
- **Database**: SQLAlchemy (SQLite for development, PostgreSQL for production)
- **Password Hashing**: bcrypt via passlib
- **JWT**: PyJWT
- **Validation**: Pydantic v2

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  /auth/register, /auth/login, /auth/refresh, etc.          │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   Dependencies Layer                         │
│  get_current_user(), require_admin(), etc.                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   Service Layer                              │
│  auth_service: JWT, password hashing, user management       │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   Database Layer                             │
│  SQLAlchemy models: User, Session, RefreshToken, AuditLog   │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
backend/
├── app/
│   ├── models/
│   │   └── auth.py                    # Pydantic request/response models
│   ├── db/
│   │   ├── models.py                  # SQLAlchemy database models
│   │   ├── database.py                # Database connection and session
│   │   └── init_db.py                 # Database initialization script
│   ├── services/
│   │   └── auth_service.py            # Core authentication logic
│   ├── api/
│   │   ├── routes/
│   │   │   └── auth.py                # Authentication endpoints
│   │   └── dependencies/
│   │       └── auth_deps.py           # FastAPI dependencies
│   ├── core/
│   │   └── auth_exceptions.py         # Error handling
│   └── config.py                      # Configuration settings
```

---

## API Endpoints

### Base URL

```
http://localhost:8000/auth
```

### Endpoints Overview

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/register` | POST | No | Register new user |
| `/login` | POST | No | Login with credentials |
| `/logout` | POST | Yes | Logout current session |
| `/refresh` | POST | No | Refresh access token |
| `/password-reset` | POST | No | Request password reset |
| `/password-reset/confirm` | POST | No | Confirm password reset |
| `/password-change` | POST | Yes | Change password |
| `/me` | GET | Yes | Get current user profile |
| `/sessions` | GET | Yes | List active sessions |
| `/sessions/{id}` | DELETE | Yes | Revoke specific session |

---

### 1. User Registration

**Endpoint**: `POST /auth/register`

**Description**: Create a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd123",
  "full_name": "John Doe",
  "organization": "Acme Corp"
}
```

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

**Response** (201 Created):
```json
{
  "user": {
    "id": "usr_1234567890abcdef",
    "email": "user@example.com",
    "full_name": "John Doe",
    "organization": "Acme Corp",
    "is_active": true,
    "is_verified": false,
    "created_at": "2025-01-15T10:30:00Z",
    "last_login_at": null,
    "role": "user"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 900
  },
  "message": "Registration successful. Please check your email to verify your account."
}
```

**Errors**:
- `400 BAD_REQUEST`: Email already exists, weak password, invalid email domain
- `422 UNPROCESSABLE_ENTITY`: Validation error

---

### 2. User Login

**Endpoint**: `POST /auth/login`

**Description**: Authenticate user with email and password.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd123",
  "remember_me": false
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "usr_1234567890abcdef",
    "email": "user@example.com",
    "full_name": "John Doe",
    "organization": "Acme Corp",
    "is_active": true,
    "is_verified": true,
    "created_at": "2025-01-15T10:30:00Z",
    "last_login_at": "2025-01-20T14:22:00Z",
    "role": "user"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 900
  }
}
```

**Security Features**:
- Account lockout after 5 failed attempts (30 minutes)
- Tracks failed login attempts
- Records IP address and device information

**Errors**:
- `401 UNAUTHORIZED`: Invalid credentials
- `403 FORBIDDEN`: Account locked or inactive

---

### 3. Token Refresh

**Endpoint**: `POST /auth/refresh`

**Description**: Get a new access token using refresh token.

**Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Token Rotation**: Old refresh token is marked as used, new refresh token is returned.

**Errors**:
- `401 UNAUTHORIZED`: Invalid, expired, or revoked token

---

### 4. Logout

**Endpoint**: `POST /auth/logout`

**Description**: Logout current session and revoke tokens.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{
  "all_devices": false
}
```

**Response** (200 OK):
```json
{
  "message": "Logged out successfully"
}
```

**Errors**:
- `401 UNAUTHORIZED`: Invalid or expired token

---

### 5. Password Reset Request

**Endpoint**: `POST /auth/password-reset`

**Description**: Request password reset email.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "message": "If your email is registered, you will receive password reset instructions.",
  "email": "user@example.com"
}
```

**Note**: Always returns success to prevent email enumeration.

---

### 6. Password Reset Confirmation

**Endpoint**: `POST /auth/password-reset/confirm`

**Description**: Reset password using token from email.

**Request Body**:
```json
{
  "reset_token": "a1b2c3d4e5f6...",
  "new_password": "NewSecureP@ssw0rd123"
}
```

**Response** (200 OK):
```json
{
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

**Errors**:
- `400 BAD_REQUEST`: Invalid or expired token

---

### 7. Change Password

**Endpoint**: `POST /auth/password-change`

**Description**: Change password for authenticated user.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{
  "current_password": "OldP@ssw0rd",
  "new_password": "NewSecureP@ssw0rd123"
}
```

**Response** (200 OK):
```json
{
  "message": "Password changed successfully. All other sessions have been logged out."
}
```

**Security**: Revokes all other sessions for security.

**Errors**:
- `400 BAD_REQUEST`: Incorrect current password, weak new password

---

### 8. Get Current User Profile

**Endpoint**: `GET /auth/me`

**Description**: Get profile information for authenticated user.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response** (200 OK):
```json
{
  "id": "usr_1234567890abcdef",
  "email": "user@example.com",
  "full_name": "John Doe",
  "organization": "Acme Corp",
  "is_active": true,
  "is_verified": true,
  "created_at": "2025-01-15T10:30:00Z",
  "last_login_at": "2025-01-20T14:22:00Z",
  "role": "user"
}
```

---

### 9. List Active Sessions

**Endpoint**: `GET /auth/sessions`

**Description**: List all active sessions for current user.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response** (200 OK):
```json
{
  "sessions": [
    {
      "session_id": "ses_abc123",
      "device_info": "Chrome 120 on Windows 10",
      "ip_address": "192.168.1.100",
      "created_at": "2025-01-20T10:00:00Z",
      "last_activity": "2025-01-20T14:30:00Z",
      "is_current": true
    }
  ],
  "total": 1
}
```

---

### 10. Revoke Session

**Endpoint**: `DELETE /auth/sessions/{session_id}`

**Description**: Revoke a specific session.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response** (200 OK):
```json
{
  "message": "Session revoked successfully"
}
```

**Errors**:
- `400 BAD_REQUEST`: Cannot revoke current session
- `404 NOT_FOUND`: Session not found

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'user',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    last_login_at DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    email_verification_token VARCHAR(64),
    email_verification_sent_at DATETIME,
    email_verified_at DATETIME,
    password_reset_token VARCHAR(64),
    password_reset_sent_at DATETIME,
    password_reset_expires_at DATETIME
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    device_info VARCHAR(500),
    ip_address VARCHAR(45),
    location VARCHAR(255),
    created_at DATETIME NOT NULL,
    last_activity_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at DATETIME,
    revocation_reason VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    session_id VARCHAR(32) NOT NULL,
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    jti VARCHAR(64) UNIQUE NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    revoked_at DATETIME,
    replaced_by_token_id VARCHAR(32),
    is_revoked BOOLEAN DEFAULT FALSE,
    is_used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32),
    event_type VARCHAR(50) NOT NULL,
    event_status VARCHAR(20) NOT NULL,
    event_description TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    request_id VARCHAR(64),
    metadata TEXT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## Authentication Flow

### Login Flow

```
1. User submits email + password
2. System validates credentials
3. System creates session record
4. System generates:
   - Access token (JWT, 15 min expiry)
   - Refresh token (JWT, 30 days expiry)
5. Refresh token hash stored in database
6. Both tokens returned to client
7. Client stores tokens (access token in memory, refresh token in httpOnly cookie)
```

### API Request Flow

```
1. Client sends request with access token in Authorization header
2. get_current_user() dependency extracts and validates token
3. System checks:
   - Token signature is valid
   - Token has not expired
   - User exists and is active
   - Session is still valid
4. Request proceeds with authenticated user context
```

### Token Refresh Flow

```
1. Access token expires (15 minutes)
2. Client receives 401 Unauthorized
3. Client sends refresh token to /auth/refresh
4. System validates refresh token:
   - Signature is valid
   - Not expired, revoked, or used
   - Session is still active
5. System marks old refresh token as used
6. System generates new access token + refresh token
7. Old refresh token linked to new token (rotation chain)
8. Both new tokens returned to client
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid email or password",
    "details": {
      "field": "password",
      "reason": "incorrect"
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `TOKEN_INVALID` | 401 | Malformed or invalid token |
| `SESSION_EXPIRED` | 401 | Session has been revoked |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role |
| `ACCOUNT_INACTIVE` | 403 | Account is disabled |
| `ACCOUNT_LOCKED` | 403 | Too many failed attempts |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `USER_NOT_FOUND` | 404 | User does not exist |
| `WEAK_PASSWORD` | 400 | Password doesn't meet requirements |
| `EMAIL_ALREADY_EXISTS` | 400 | Email is already registered |
| `VALIDATION_ERROR` | 422 | Request validation failed |

---

## Security Features

### Password Security

- **Hashing**: bcrypt with automatic salt generation
- **Strength Requirements**: Enforced on registration and password change
- **Reset Tokens**: Time-limited (24 hours), single-use
- **Change Detection**: Prevents reusing current password

### Account Protection

- **Rate Limiting**: Prevents brute force attacks
- **Account Lockout**: 30 minutes after 5 failed attempts
- **Session Tracking**: Multi-device session management
- **Audit Logging**: All authentication events logged

### Token Security

- **Short-Lived Access Tokens**: 15 minutes expiry
- **Refresh Token Rotation**: Single-use refresh tokens
- **Token Revocation**: Session-based token invalidation
- **JTI Tracking**: Prevents token replay attacks

### Database Security

- **Soft Deletes**: Users marked as deleted, not removed
- **Foreign Key Cascades**: Automatic cleanup of related records
- **Indexed Queries**: Fast lookup of security-critical fields
- **Token Hashing**: Refresh tokens stored as SHA-256 hashes

---

## Integration Guide

### 1. Database Setup

```bash
# Initialize database
python -m app.db.init_db

# Reset and seed with development data
python -m app.db.init_db --reset --seed
```

### 2. Configuration

Update `app/config.py` or set environment variables:

```bash
export JWT_SECRET_KEY="your-very-secure-secret-key-here"
export DATABASE_URL="postgresql://user:pass@localhost/dbname"
export ENV="production"
```

### 3. Include Router in Main App

```python
from app.api.routes import auth

app.include_router(auth.router)
```

### 4. Protect Endpoints

```python
from fastapi import Depends
from app.api.dependencies.auth_deps import get_current_user, require_admin
from app.models.auth import CurrentUser

# Require any authenticated user
@app.get("/protected")
def protected_route(current_user: CurrentUser = Depends(get_current_user)):
    return {"user_id": current_user.id}

# Require admin role
@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: CurrentUser = Depends(require_admin)
):
    # Only admins can access
    pass

# Optional authentication
from app.api.dependencies.auth_deps import get_optional_current_user

@app.get("/content")
def get_content(current_user: Optional[CurrentUser] = Depends(get_optional_current_user)):
    if current_user:
        # Personalized content
        pass
    else:
        # Public content
        pass
```

### 5. Client Integration Example

```javascript
// Login
const loginResponse = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecureP@ssw0rd123'
  })
});

const { tokens, user } = await loginResponse.json();

// Store tokens
localStorage.setItem('access_token', tokens.access_token);
localStorage.setItem('refresh_token', tokens.refresh_token);

// Make authenticated request
const response = await fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});

// Handle token expiry
if (response.status === 401) {
  // Refresh token
  const refreshResponse = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: localStorage.getItem('refresh_token')
    })
  });

  const { access_token, refresh_token } = await refreshResponse.json();
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('refresh_token', refresh_token);

  // Retry original request
  const retryResponse = await fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  });
}
```

---

## Development Users

When using `--seed` flag, the following test users are created:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | Admin123!@# | admin |
| user@example.com | User123!@# | user |
| premium@example.com | Premium123!@# | premium |

---

## Production Checklist

- [ ] Change `JWT_SECRET_KEY` to a secure random value
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS/TLS for all endpoints
- [ ] Set up email service for verification/reset emails
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting on authentication endpoints
- [ ] Set up monitoring and alerting for failed logins
- [ ] Implement IP-based blocking for suspicious activity
- [ ] Regular audit log reviews
- [ ] Automated session cleanup for expired sessions

---

## License

Internal use only.
