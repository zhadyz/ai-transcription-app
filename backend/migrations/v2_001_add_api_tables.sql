-- ============================================================================
-- API v2 Database Migration
-- Adds tables for API-first architecture with webhooks and API keys
-- ============================================================================

-- Migration: v2_001_add_api_tables
-- Created: 2025-01-26
-- Description: Creates tables for API keys, transcription tasks, webhooks, and usage tracking

-- ============================================================================
-- API KEYS TABLE
-- Stores API keys with SHA-256 hashing (never plaintext)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL UNIQUE,  -- First 8 chars: tapi_AbC12345
    key_hash VARCHAR(64) NOT NULL UNIQUE,    -- SHA-256 hash of full key

    -- Limits & Configuration
    rate_limit_per_hour INTEGER DEFAULT 100,
    max_file_size_mb INTEGER DEFAULT 500,
    allowed_formats TEXT DEFAULT 'mp3,wav,mp4,avi,mov,mkv,flac',

    -- Webhook Configuration
    webhook_url VARCHAR(2048),
    webhook_secret VARCHAR(64),

    -- State & Tracking
    is_active BOOLEAN DEFAULT TRUE,
    total_requests INTEGER DEFAULT 0,
    total_minutes_transcribed REAL DEFAULT 0.0,
    last_used_at TIMESTAMP,

    -- Lifecycle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- ============================================================================
-- TRANSCRIPTION TASKS TABLE
-- Persistent task storage with 24-hour retention
-- ============================================================================

CREATE TABLE IF NOT EXISTS transcription_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    api_key_id VARCHAR(36) NOT NULL,

    -- Input Information
    input_type VARCHAR(32) NOT NULL,  -- 'url' or 'upload'
    input_url VARCHAR(2048),
    file_name VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_path VARCHAR(1024) NOT NULL,

    -- Task Configuration
    language VARCHAR(16),
    task_type VARCHAR(32) NOT NULL,  -- 'transcribe' or 'translate'
    output_format VARCHAR(16) NOT NULL,  -- 'srt', 'vtt', 'txt', 'json', 'csv'

    -- Processing State
    status VARCHAR(32) DEFAULT 'pending',  -- pending, processing, completed, failed, expired
    progress REAL DEFAULT 0.0,
    current_step VARCHAR(255),

    -- Results
    transcript_text TEXT,
    output_file_path VARCHAR(1024),
    word_count INTEGER,
    duration_seconds REAL,

    -- Error Handling
    error_message TEXT,
    error_code VARCHAR(64),

    -- Webhook
    webhook_url VARCHAR(2048),
    webhook_delivered BOOLEAN DEFAULT FALSE,
    webhook_attempts INTEGER DEFAULT 0,

    -- Request Context
    client_metadata TEXT,  -- JSON string
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),

    -- Lifecycle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,  -- 24h from creation

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_user_id ON transcription_tasks(user_id);
CREATE INDEX idx_tasks_api_key_id ON transcription_tasks(api_key_id);
CREATE INDEX idx_tasks_status ON transcription_tasks(status);
CREATE INDEX idx_tasks_expires_at ON transcription_tasks(expires_at);
CREATE INDEX idx_tasks_created_at ON transcription_tasks(created_at DESC);

-- ============================================================================
-- WEBHOOK LOGS TABLE
-- Tracks webhook delivery attempts with retry metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id VARCHAR(36) NOT NULL,

    -- Delivery Details
    event_type VARCHAR(64) NOT NULL,  -- 'task.completed', 'task.failed'
    webhook_url VARCHAR(2048) NOT NULL,
    payload TEXT NOT NULL,  -- JSON string

    -- Response
    status VARCHAR(32) NOT NULL,  -- 'pending', 'delivered', 'failed'
    http_status_code INTEGER,
    response_body TEXT,

    -- Retry Logic
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    max_retries INTEGER DEFAULT 5,

    -- Timing
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,

    FOREIGN KEY (task_id) REFERENCES transcription_tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_webhook_logs_task_id ON webhook_logs(task_id);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_next_retry_at ON webhook_logs(next_retry_at);

-- ============================================================================
-- USAGE RECORDS TABLE
-- Detailed per-request usage tracking for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(36) NOT NULL,
    api_key_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,

    -- Resource Usage
    file_size_bytes BIGINT NOT NULL,
    duration_seconds REAL,
    processing_time_seconds REAL,

    -- Billing Metadata
    billable_minutes REAL,

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES transcription_tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_api_key_id ON usage_records(api_key_id);
CREATE INDEX idx_usage_records_created_at ON usage_records(created_at DESC);

-- ============================================================================
-- UPDATE TRIGGER for updated_at
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_api_keys_updated_at
    AFTER UPDATE ON api_keys
    FOR EACH ROW
BEGIN
    UPDATE api_keys SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Version: v2_001
-- Tables Created: api_keys, transcription_tasks, webhook_logs, usage_records
-- Security: API keys stored as SHA-256 hashes, never plaintext
-- Retention: Tasks expire after 24 hours with automatic cleanup
