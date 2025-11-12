# AI Transcription API v2 Documentation

**Version:** 2.0.0
**Architecture:** API-First with Webhooks
**Base URL:** `https://your-domain.com/api/v2`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Quick Start](#quick-start)
4. [API Endpoints](#api-endpoints)
5. [Webhooks](#webhooks)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [Security Best Practices](#security-best-practices)
9. [Migration from V1](#migration-from-v1)
10. [Examples](#examples)

---

## Overview

API v2 is a complete redesign for **API-first integration**, enabling external applications to chain transcription services into their workflows.

### Key Features

- ✅ **API Key Authentication** - Secure programmatic access
- ✅ **Webhook Callbacks** - Async notifications when tasks complete
- ✅ **URL-based Inputs** - Submit files by URL (no upload needed)
- ✅ **24-hour Retention** - Results available for 24h after completion
- ✅ **Usage Analytics** - Detailed tracking per API key
- ✅ **Rate Limiting** - Configurable per API key
- ✅ **SSRF Protection** - Security-first URL validation
- ✅ **Backward Compatible** - V1 endpoints still available

### Architecture Changes

| Feature | V1 (Legacy) | V2 (API-First) |
|---------|-------------|----------------|
| **Authentication** | Session-based | API Key |
| **File Input** | Direct upload only | URL + Upload |
| **Response Model** | Synchronous | Asynchronous |
| **Result Retention** | Immediate deletion | 24-hour retention |
| **Notifications** | WebSocket | Webhook callbacks |
| **Integration** | Browser-focused | API-first |

---

## Authentication

### Creating API Keys

API keys are managed through JWT-authenticated endpoints.

**Step 1: Login (V1 auth system)**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "YourPassword123!"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "user": {
    "id": "user_abc123",
    "email": "your@email.com"
  }
}
```

**Step 2: Create API Key**
```http
POST /api/v2/keys
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "name": "Production API Key",
  "rate_limit_per_hour": 500,
  "max_file_size_mb": 1000,
  "allowed_formats": "mp3,wav,mp4,mov",
  "webhook_url": "https://your-app.com/webhooks/transcription",
  "expires_in_days": 365
}
```

**Response:**
```json
{
  "api_key": "tapi_AbC12345_xyz789abc...secret",
  "key_info": {
    "id": "key_abc123xyz",
    "name": "Production API Key",
    "key_prefix": "tapi_AbC12345",
    "rate_limit_per_hour": 500,
    "max_file_size_mb": 1000,
    "total_requests": 0,
    "created_at": "2025-01-26T10:00:00Z"
  }
}
```

⚠️ **CRITICAL:** Save the full `api_key` immediately. It's shown only once and cannot be retrieved later.

### Using API Keys

Include the API key in requests using either method:

**Method 1: Authorization Header (Recommended)**
```http
Authorization: Bearer tapi_AbC12345_xyz789abc...secret
```

**Method 2: Custom Header**
```http
X-API-Key: tapi_AbC12345_xyz789abc...secret
```

---

## Quick Start

### 1. Transcribe from URL

```bash
curl -X POST https://your-domain.com/api/v2/transcribe/url \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/audio.mp3",
    "language": "en",
    "task": "transcribe",
    "output_format": "srt",
    "webhook_url": "https://your-app.com/webhooks/transcription"
  }'
```

**Response (202 Accepted):**
```json
{
  "task_id": "task_abc123xyz",
  "status": "pending",
  "progress": 0.0,
  "created_at": "2025-01-26T10:00:00Z",
  "expires_at": "2025-01-27T10:00:00Z"
}
```

### 2. Poll Task Status

```bash
curl https://your-domain.com/api/v2/tasks/task_abc123xyz \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response (Processing):**
```json
{
  "task_id": "task_abc123xyz",
  "status": "processing",
  "progress": 45.0,
  "current_step": "Transcribing with Whisper",
  "estimated_completion": "2025-01-26T10:15:00Z"
}
```

**Response (Completed):**
```json
{
  "task_id": "task_abc123xyz",
  "status": "completed",
  "progress": 100.0,
  "completed_at": "2025-01-26T10:12:30Z",
  "result": {
    "transcript": "Hello world...",
    "word_count": 1523,
    "duration_seconds": 245.5,
    "download_url": "/api/v2/tasks/task_abc123xyz/download",
    "output_format": "srt"
  }
}
```

### 3. Download Result

```bash
curl https://your-domain.com/api/v2/tasks/task_abc123xyz/download \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -o transcript.srt
```

---

## API Endpoints

### Transcription

#### `POST /api/v2/transcribe/url`

Submit audio/video URL for transcription.

**Request Body:**
```json
{
  "url": "https://example.com/audio.mp3",
  "language": "en",
  "task": "transcribe",
  "output_format": "srt",
  "webhook_url": "https://your-app.com/webhooks",
  "metadata": {
    "order_id": "12345",
    "customer": "acme_corp"
  }
}
```

**Parameters:**
- `url` (required): Audio/video file URL
- `language` (optional): Language code (auto-detect if omitted)
- `task` (required): `transcribe` or `translate`
- `output_format` (required): `srt`, `vtt`, `txt`, `json`, `csv`
- `webhook_url` (optional): Override default webhook URL
- `metadata` (optional): Custom data included in webhook

**Security:**
- ❌ localhost/private IPs blocked (SSRF protection)
- ✅ File size validated during download
- ✅ Format validated
- ✅ Rate limit enforced

**Response:** `202 Accepted` with task ID

---

#### `GET /api/v2/tasks/{task_id}`

Get task status and results.

**Response:**
```json
{
  "task_id": "task_abc123xyz",
  "status": "completed",
  "progress": 100.0,
  "result": {
    "transcript": "...",
    "download_url": "/api/v2/tasks/task_abc123xyz/download"
  }
}
```

**Status Values:**
- `pending`: Waiting in queue
- `processing`: Currently transcribing
- `completed`: Finished successfully
- `failed`: Error occurred
- `expired`: Task expired (24h retention)

---

#### `GET /api/v2/tasks/{task_id}/download`

Download transcription result file.

**Response:** File download (SRT/VTT/TXT/JSON/CSV)

---

#### `GET /api/v2/tasks`

List all tasks for your API key.

**Query Parameters:**
- `status` (optional): Filter by status
- `page` (default: 1): Page number
- `page_size` (default: 20, max: 100): Items per page

**Response:**
```json
{
  "tasks": [...],
  "total": 87,
  "page": 1,
  "page_size": 20
}
```

---

#### `DELETE /api/v2/tasks/{task_id}`

Delete a task and its files.

⚠️ Cannot delete tasks that are currently processing.

**Response:** `204 No Content`

---

### API Key Management

All endpoints require JWT authentication.

#### `POST /api/v2/keys`

Create new API key (requires JWT).

**Request Body:**
```json
{
  "name": "Production Key",
  "rate_limit_per_hour": 500,
  "max_file_size_mb": 1000,
  "webhook_url": "https://your-app.com/webhooks",
  "expires_in_days": 365
}
```

**Response:** Full API key (shown once)

---

#### `GET /api/v2/keys`

List all API keys.

**Query Parameters:**
- `include_inactive` (default: false): Include revoked keys

---

#### `GET /api/v2/keys/{key_id}`

Get API key details.

---

#### `PATCH /api/v2/keys/{key_id}`

Update API key settings.

**Request Body:**
```json
{
  "name": "Updated Name",
  "rate_limit_per_hour": 1000,
  "webhook_url": "https://new-webhook.com/callback"
}
```

---

#### `DELETE /api/v2/keys/{key_id}`

Revoke API key (permanent).

**Response:** `204 No Content`

---

#### `GET /api/v2/keys/{key_id}/stats`

Get usage statistics.

**Response:**
```json
{
  "api_key_id": "key_abc123",
  "total_requests": 1523,
  "total_minutes_transcribed": 245.5,
  "last_24h": {
    "requests": 87,
    "minutes_transcribed": 12.3
  }
}
```

---

## Webhooks

### Overview

Webhooks provide async notifications when tasks complete, eliminating the need for polling.

### Configuration

Set webhook URL when:
1. Creating API key (default for all tasks)
2. Per-request (overrides default)

### Webhook Payload

**Event: `task.completed`**
```json
{
  "event": "task.completed",
  "task_id": "task_abc123xyz",
  "status": "completed",
  "completed_at": "2025-01-26T10:12:30Z",
  "result": {
    "transcript": "Hello world...",
    "word_count": 1523,
    "duration_seconds": 245.5,
    "download_url": "/api/v2/tasks/task_abc123xyz/download"
  },
  "metadata": {
    "order_id": "12345",
    "customer": "acme_corp"
  }
}
```

**Event: `task.failed`**
```json
{
  "event": "task.failed",
  "task_id": "task_abc123xyz",
  "status": "failed",
  "error": {
    "message": "File format not supported",
    "code": "INVALID_FORMAT"
  }
}
```

### Security: HMAC Signature

Every webhook includes an HMAC-SHA256 signature for verification.

**Headers:**
```http
X-Event-Type: task.completed
X-Task-ID: task_abc123xyz
X-Webhook-Signature: a1b2c3d4e5f6...
```

**Verification (Python):**
```python
import hmac
import hashlib

def verify_webhook(payload: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# In your webhook handler
@app.post("/webhooks/transcription")
async def handle_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("X-Webhook-Signature")

    if not verify_webhook(payload.decode(), signature, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()
    # Process webhook...
```

### Retry Logic

Failed webhooks are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 30s |
| 2 | 1m |
| 3 | 5m |
| 4 | 15m |
| 5 | 1h |

After 5 failures, retries stop. Check webhook logs via API.

---

## Rate Limiting

Rate limits are enforced per API key.

**Default:** 100 requests/hour (configurable)

**Headers in Response:**
```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1706270400
```

**429 Response:**
```json
{
  "error": "Rate limit exceeded",
  "limit": 500,
  "reset_at": "2025-01-26T11:00:00Z",
  "retry_after": 300
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async) |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Error Response Format

```json
{
  "error": "Invalid file format",
  "code": "INVALID_FORMAT",
  "details": "Supported formats: mp3, wav, mp4, mov",
  "request_id": "req_abc123"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key invalid/expired |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INVALID_FORMAT` | File format not allowed |
| `FILE_TOO_LARGE` | Exceeds size limit |
| `DOWNLOAD_FAILED` | Could not download from URL |
| `SSRF_BLOCKED` | URL blocked (security) |
| `PROCESSING_ERROR` | Transcription failed |
| `TASK_NOT_FOUND` | Invalid task ID |

---

## Security Best Practices

### 1. Protect API Keys

```bash
# ✅ DO: Environment variables
export TRANSCRIPTION_API_KEY="tapi_..."

# ❌ DON'T: Hardcode in source
api_key = "tapi_AbC12345_xyz789..."  # NEVER DO THIS
```

### 2. Verify Webhook Signatures

Always verify HMAC signatures to prevent spoofing.

### 3. Use HTTPS

Never send API keys over unencrypted HTTP.

### 4. Rotate Keys Regularly

Create new keys and revoke old ones periodically.

### 5. Least Privilege

Create separate API keys for different environments:
- Development: Lower limits
- Production: Higher limits
- Testing: Separate key

### 6. Monitor Usage

Check stats regularly for anomalies:
```bash
curl https://your-domain.com/api/v2/keys/{key_id}/stats \
  -H "Authorization: Bearer JWT_TOKEN"
```

---

## Migration from V1

### Key Differences

| Aspect | V1 | V2 |
|--------|----|----|
| **Auth** | Session cookies | API keys |
| **Upload** | `multipart/form-data` | URL submission |
| **Response** | Synchronous | Async (task ID) |
| **Notifications** | WebSocket | Webhooks |
| **Retention** | Immediate cleanup | 24-hour retention |

### Migration Path

**V1 Code:**
```python
# Upload file directly
files = {"file": open("audio.mp3", "rb")}
response = requests.post("/transcribe/upload", files=files)
result = response.json()  # Immediate result
```

**V2 Code:**
```python
# Submit URL
headers = {"Authorization": f"Bearer {API_KEY}"}
response = requests.post("/api/v2/transcribe/url",
    json={"url": "https://example.com/audio.mp3"},
    headers=headers
)
task_id = response.json()["task_id"]

# Poll or wait for webhook
status_response = requests.get(
    f"/api/v2/tasks/{task_id}",
    headers=headers
)
```

---

## Examples

### Python Integration

```python
import requests
import time
from typing import Optional

class TranscriptionClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def transcribe_url(self, url: str, webhook_url: Optional[str] = None) -> str:
        """Submit URL for transcription, returns task_id"""
        response = requests.post(
            f"{self.base_url}/api/v2/transcribe/url",
            json={
                "url": url,
                "task": "transcribe",
                "output_format": "srt",
                "webhook_url": webhook_url
            },
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()["task_id"]

    def get_status(self, task_id: str) -> dict:
        """Get task status"""
        response = requests.get(
            f"{self.base_url}/api/v2/tasks/{task_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def wait_for_completion(self, task_id: str, poll_interval: int = 5) -> dict:
        """Poll until task completes"""
        while True:
            status = self.get_status(task_id)
            if status["status"] in ["completed", "failed"]:
                return status
            time.sleep(poll_interval)

    def download_result(self, task_id: str, output_path: str):
        """Download transcription result"""
        response = requests.get(
            f"{self.base_url}/api/v2/tasks/{task_id}/download",
            headers=self.headers
        )
        response.raise_for_status()

        with open(output_path, "wb") as f:
            f.write(response.content)

# Usage
client = TranscriptionClient(
    api_key="tapi_AbC12345_xyz789...",
    base_url="https://your-domain.com"
)

task_id = client.transcribe_url("https://example.com/audio.mp3")
result = client.wait_for_completion(task_id)
client.download_result(task_id, "transcript.srt")
```

### Node.js Integration

```javascript
const axios = require('axios');

class TranscriptionClient {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.headers = { 'Authorization': `Bearer ${apiKey}` };
    }

    async transcribeUrl(url, webhookUrl = null) {
        const response = await axios.post(
            `${this.baseUrl}/api/v2/transcribe/url`,
            {
                url,
                task: 'transcribe',
                output_format: 'srt',
                webhook_url: webhookUrl
            },
            { headers: this.headers }
        );
        return response.data.task_id;
    }

    async getStatus(taskId) {
        const response = await axios.get(
            `${this.baseUrl}/api/v2/tasks/${taskId}`,
            { headers: this.headers }
        );
        return response.data;
    }

    async waitForCompletion(taskId, pollInterval = 5000) {
        while (true) {
            const status = await this.getStatus(taskId);
            if (['completed', 'failed'].includes(status.status)) {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    async downloadResult(taskId, outputPath) {
        const response = await axios.get(
            `${this.baseUrl}/api/v2/tasks/${taskId}/download`,
            {
                headers: this.headers,
                responseType: 'stream'
            }
        );

        const fs = require('fs');
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }
}

// Usage
const client = new TranscriptionClient(
    'tapi_AbC12345_xyz789...',
    'https://your-domain.com'
);

(async () => {
    const taskId = await client.transcribeUrl('https://example.com/audio.mp3');
    const result = await client.waitForCompletion(taskId);
    await client.downloadResult(taskId, 'transcript.srt');
})();
```

### Webhook Handler (FastAPI)

```python
from fastapi import FastAPI, Request, HTTPException
import hmac
import hashlib

app = FastAPI()

WEBHOOK_SECRET = "your_webhook_secret_from_api_key"

def verify_signature(payload: bytes, signature: str) -> bool:
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

@app.post("/webhooks/transcription")
async def handle_transcription_webhook(request: Request):
    # Verify signature
    payload = await request.body()
    signature = request.headers.get("X-Webhook-Signature")

    if not verify_signature(payload, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Process webhook
    data = await request.json()
    event_type = request.headers.get("X-Event-Type")

    if event_type == "task.completed":
        task_id = data["task_id"]
        transcript = data["result"]["transcript"]

        # Process completed transcription
        print(f"Task {task_id} completed: {transcript[:100]}...")

    elif event_type == "task.failed":
        task_id = data["task_id"]
        error = data["error"]["message"]

        # Handle failure
        print(f"Task {task_id} failed: {error}")

    return {"status": "received"}
```

---

## Support

For issues or questions:
- **GitHub Issues:** https://github.com/your-repo/issues
- **Email:** support@your-domain.com
- **Documentation:** https://docs.your-domain.com

---

## Changelog

### v2.0.0 (2025-01-26)
- ✨ Initial API v2 release
- ✨ API key authentication
- ✨ Webhook callbacks with HMAC signatures
- ✨ URL-based file inputs with SSRF protection
- ✨ 24-hour result retention
- ✨ Per-key rate limiting
- ✨ Usage analytics
- ✅ Backward compatible with V1

---

**End of Documentation**
