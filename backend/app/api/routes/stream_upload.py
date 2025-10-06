"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT ZERO-COPY STREAMING UPLOAD - HTTP/2 Optimized
═══════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
import aiofiles
import hashlib
import os
from pathlib import Path
from urllib.parse import unquote
from app.logging_config import get_logger
from app.config import settings

router = APIRouter(prefix="/stream", tags=["Stream Upload"])
logger = get_logger(__name__)

UPLOAD_DIR = Path("./storage/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def stream_upload(request: Request):
    """Zero-copy streaming upload with proper file flushing and disk sync"""
    
    try:
        raw_filename = request.headers.get("x-filename", "unnamed")
        filename = unquote(raw_filename)
        expected_size = request.headers.get("x-file-size")
        expected_hash = request.headers.get("x-file-hash")
        
        logger.info(f"🚀 Stream upload started: {filename}")
        
        if expected_size:
            size_mb = int(expected_size) / (1024 * 1024)
            logger.info(f"   Expected size: {size_mb:.2f}MB")
            
            if size_mb > settings.MAX_FILE_SIZE_MB:
                raise HTTPException(
                    status_code=413,
                    detail=f"File size {size_mb:.2f}MB exceeds maximum {settings.MAX_FILE_SIZE_MB}MB"
                )
        
        file_path = UPLOAD_DIR / filename
        
        if file_path.exists():
            import uuid
            stem = file_path.stem
            suffix = file_path.suffix
            file_path = UPLOAD_DIR / f"{stem}_{uuid.uuid4().hex[:8]}{suffix}"
        
        sha256_hash = hashlib.sha256()
        total_bytes = 0
        chunk_count = 0
        
        logger.info(f"📝 Writing to: {file_path}")
        
        async with aiofiles.open(file_path, 'wb') as f:
            async for chunk in request.stream():
                if chunk:
                    await f.write(chunk)
                    total_bytes += len(chunk)
                    chunk_count += 1
                    sha256_hash.update(chunk)
                    
                    if chunk_count % 100 == 0:
                        progress_pct = (total_bytes / int(expected_size) * 100) if expected_size else 0
                        logger.info(f"📊 Progress: {total_bytes:,} bytes ({chunk_count} chunks, {progress_pct:.1f}%)")
            
            # CRITICAL: Flush buffer to OS
            await f.flush()
            
            # CRITICAL: Force OS to sync file to physical disk
            # This prevents "inode/blockdevice" detection by ensuring
            # the file is fully written before validation
            os.fsync(f.fileno())
        
        # File is now closed and fully synced to disk
        logger.info(f"💾 File synced to disk: {file_path.name}")
        
        computed_hash = sha256_hash.hexdigest()
        
        if expected_hash and computed_hash != expected_hash:
            file_path.unlink()
            raise HTTPException(400, f"SHA-256 mismatch")
        
        if expected_size and total_bytes != int(expected_size):
            file_path.unlink()
            raise HTTPException(400, f"Size mismatch")
        
        size_mb = total_bytes / (1024 * 1024)
        
        logger.info(f"✅ Stream upload complete: {filename}")
        logger.info(f"   Size: {total_bytes:,} bytes ({size_mb:.2f}MB, {chunk_count} chunks)")
        logger.info(f"   SHA-256: {computed_hash[:16]}...")
        
        return JSONResponse(content={
            "success": True,
            "filename": filename,
            "file_path": str(file_path),
            "size": total_bytes,
            "size_mb": round(size_mb, 2),
            "chunks": chunk_count,
            "sha256": computed_hash
        })
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"❌ Stream upload failed: {e}", exc_info=True)
        
        if 'file_path' in locals() and file_path.exists():
            try:
                file_path.unlink()
                logger.info(f"🧹 Cleaned up partial file")
            except:
                pass
        
        raise HTTPException(500, detail=f"Upload failed: {str(e)}")