# AI Transcription Platform - Project Overview

## Purpose
Experimental transcription application exploring distributed systems, CRDTs, and performance optimization. Over-engineered intentionally to practice advanced patterns. Production-grade AI-powered audio/video transcription with real-time updates and mobile device support.

## Key Features
- GPU-accelerated transcription using Faster-Whisper with CUDA optimization (13.89× real-time performance)
- Real-time translation supporting 12+ languages via LibreTranslate
- QR code-based mobile device pairing with WebSocket synchronization
- Zero-copy HTTP/2 streaming with constant 64KB memory footprint
- Multi-format export (SRT, VTT, TXT, CSV, JSON)
- Support for multiple Whisper model sizes (base, small, medium, large-v2, large-v3)
- Large file support (validated up to 5GB)

## Architecture
- **Deployment**: Docker containerization with docker-compose orchestration
- **Backend**: FastAPI (0.115) with Hypercorn ASGI server (HTTP/2 + WebSocket)
- **Frontend**: React 18.3 with TypeScript, Vite build system
- **Reverse Proxy**: nginx (production Docker deployment)
- **Translation Service**: LibreTranslate container
- **Processing**: FFmpeg audio extraction pipeline, Whisper transcription engine

## Current Version
Version 1.5.7 - Includes mobile-desktop link detection, Docker deployment automation, and code quality improvements

## System Requirements
- Docker Desktop 20.10+ (recommended for production)
- Python 3.11.x (for native installation - 3.12+ incompatible with PyTorch)
- Node.js 18.0+ with npm
- NVIDIA GPU with CUDA 12.4+ (optional, enables GPU acceleration)
- 8GB RAM minimum (16GB recommended)
