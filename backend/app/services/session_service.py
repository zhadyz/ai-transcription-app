import uuid
import logging
import threading
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


class SessionService:
    """Manages temporary sessions for mobile uploads with 1-hour expiry"""
    
    def __init__(self):
        self.sessions: Dict[str, dict] = {}
        self.websocket_connections: Dict[str, List[str]] = {}
        self.session_timeout = 3600  # 1 hour
        self._lock = threading.RLock()  # Reentrant lock for thread safety
    
    def create_session(self) -> str:
        """Create a new session and return session ID"""
        session_id = str(uuid.uuid4())
        now = datetime.now()
        
        with self._lock:
            self.sessions[session_id] = {
                "id": session_id,
                "created_at": now,
                "expires_at": now + timedelta(seconds=self.session_timeout),
                "files": [],
                "connected": False,
                "last_activity": now,
                "task_id": None
            }
            
            self.websocket_connections[session_id] = []
        
        logger.info(f"Session created: {session_id}")
        return session_id
    
    def validate_session(self, session_id: str) -> bool:
        """Check if session exists and hasn't expired"""
        with self._lock:
            if session_id not in self.sessions:
                return False
            
            if datetime.now() > self.sessions[session_id]["expires_at"]:
                self.cleanup_session(session_id)
                return False
            
            self.sessions[session_id]["last_activity"] = datetime.now()
            return True
    
    def add_file_to_session(self, session_id: str, file_info: dict) -> bool:
        """Add uploaded file info to session"""
        with self._lock:
            if not self.validate_session(session_id):
                return False
            
            self.sessions[session_id]["files"].append(file_info)
            logger.info(f"File added to session {session_id}: {file_info['filename']}")
            return True
    
    def get_session_files(self, session_id: str) -> List[dict]:
        """Get all files uploaded to a session"""
        with self._lock:
            if not self.validate_session(session_id):
                return []
            return self.sessions[session_id]["files"].copy()
    
    def mark_connected(self, session_id: str, ws_id: str):
        """Mark a websocket as connected to this session"""
        with self._lock:
            if session_id in self.sessions:
                self.sessions[session_id]["connected"] = True
                if ws_id not in self.websocket_connections[session_id]:
                    self.websocket_connections[session_id].append(ws_id)
                logger.info(f"WebSocket {ws_id} connected to session {session_id}")
    
    def mark_disconnected(self, session_id: str, ws_id: str):
        """Remove websocket from session"""
        with self._lock:
            if session_id in self.websocket_connections:
                if ws_id in self.websocket_connections[session_id]:
                    self.websocket_connections[session_id].remove(ws_id)
                
                if not self.websocket_connections[session_id] and session_id in self.sessions:
                    self.sessions[session_id]["connected"] = False
                logger.info(f"WebSocket {ws_id} disconnected from session {session_id}")
    
    def get_connected_ws(self, session_id: str) -> List[str]:
        """Get all websocket IDs connected to this session"""
        with self._lock:
            return self.websocket_connections.get(session_id, []).copy()
    
    def set_task_id(self, session_id: str, task_id: str) -> bool:
        """Store task ID for session (enables mobile to track transcription)"""
        with self._lock:
            if session_id in self.sessions:
                self.sessions[session_id]["task_id"] = task_id
                logger.info(f"Task ID set for session {session_id}: {task_id}")
                return True
            return False
    
    def cleanup_session(self, session_id: str):
        """Remove session and its uploaded files"""
        with self._lock:
            if session_id in self.sessions:
                for file_info in self.sessions[session_id]["files"]:
                    file_path = Path(file_info.get("path", ""))
                    if file_path.exists():
                        try:
                            file_path.unlink()
                        except Exception as e:
                            logger.warning(f"Failed to delete file: {e}")
                
                del self.sessions[session_id]
                logger.info(f"Session cleaned up: {session_id}")
            
            if session_id in self.websocket_connections:
                del self.websocket_connections[session_id]
    
    def cleanup_expired_sessions(self):
        """Remove all expired sessions (call periodically)"""
        now = datetime.now()
        
        with self._lock:
            expired = [
                sid for sid, data in self.sessions.items()
                if now > data["expires_at"]
            ]
        
        for session_id in expired:
            self.cleanup_session(session_id)
        
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")
    
    def get_session_info(self, session_id: str) -> Optional[dict]:
        """Get session metadata"""
        with self._lock:
            if not self.validate_session(session_id):
                return None
            
            session = self.sessions[session_id]
            return {
                "id": session["id"],
                "created_at": session["created_at"].isoformat(),
                "expires_at": session["expires_at"].isoformat(),
                "connected": session["connected"],
                "files_count": len(session["files"]),
                "time_remaining": int((session["expires_at"] - datetime.now()).total_seconds())
            }
    
    def cleanup_orphaned_uploads(self, max_age_minutes: int = 15):
        """Delete uploaded files older than X minutes that weren't processed"""
        upload_dir = Path("./storage/uploads")
        if not upload_dir.exists():
            return
        
        now = datetime.now()
        cutoff_time = now - timedelta(minutes=max_age_minutes)
        deleted_count = 0
        
        for file_path in upload_dir.glob("*"):
            # Check file age
            try:
                file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            except Exception:
                continue
            
            if file_mtime < cutoff_time:
                # Check if file belongs to any active session
                is_active = False
                with self._lock:
                    for session_data in self.sessions.values():
                        for file_info in session_data["files"]:
                            if Path(file_info.get("path", "")) == file_path:
                                is_active = True
                                break
                        if is_active:
                            break
                
                # Delete if not in active session
                if not is_active:
                    try:
                        file_path.unlink()
                        deleted_count += 1
                        logger.info(f"Deleted orphaned upload: {file_path.name}")
                    except Exception as e:
                        logger.warning(f"Failed to delete {file_path.name}: {e}")
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} orphaned uploads")
    
    def cleanup_old_transcripts(self, max_files: int = 10):
        """Keep only the N most recent transcript files"""
        transcript_dir = Path("./storage/transcripts")
        if not transcript_dir.exists():
            return
        
        # Get all transcript files sorted by modification time (newest first)
        try:
            transcript_files = sorted(
                transcript_dir.glob("*"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
        except Exception as e:
            logger.error(f"Failed to list transcript files: {e}")
            return
        
        # Delete files beyond the limit
        files_to_delete = transcript_files[max_files:]
        for file_path in files_to_delete:
            try:
                file_path.unlink()
                logger.info(f"Deleted old transcript: {file_path.name}")
            except Exception as e:
                logger.warning(f"Failed to delete {file_path.name}: {e}")
        
        if files_to_delete:
            logger.info(f"Cleaned up {len(files_to_delete)} old transcripts")


# Global instance
session_service = SessionService()