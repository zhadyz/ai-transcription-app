"""
Background cleanup service for API v2.
Handles expired tasks, webhook retries, and file cleanup.
"""

import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.database import SessionLocal
from app.db.models_v2 import TranscriptionTask, WebhookLog
from app.services.webhook_service import webhook_service

import logging
logger = logging.getLogger(__name__)


class CleanupService:
    """
    Background cleanup tasks for maintaining system health.
    """

    def __init__(self):
        self.running = False
        self.task_handle = None

    async def start(self):
        """Start background cleanup tasks"""
        if self.running:
            logger.warning("Cleanup service already running")
            return

        self.running = True
        self.task_handle = asyncio.create_task(self._run_cleanup_loop())
        logger.info("Cleanup service started")

    async def stop(self):
        """Stop background cleanup tasks"""
        self.running = False
        if self.task_handle:
            self.task_handle.cancel()
            try:
                await self.task_handle
            except asyncio.CancelledError:
                pass
        logger.info("Cleanup service stopped")

    async def _run_cleanup_loop(self):
        """Main cleanup loop"""
        while self.running:
            try:
                db = SessionLocal()
                try:
                    # Run cleanup tasks
                    await self.cleanup_expired_tasks(db)
                    await self.retry_failed_webhooks(db)
                    await self.cleanup_old_webhook_logs(db)

                finally:
                    db.close()

                # Run every 5 minutes
                await asyncio.sleep(300)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute on error

    async def cleanup_expired_tasks(self, db: Session) -> int:
        """
        Delete expired tasks and their files.

        Tasks are retained for 24 hours after completion.
        After expiration, both database records and files are deleted.

        Returns:
            Number of tasks cleaned up
        """
        now = datetime.utcnow()

        # Find expired tasks
        expired_tasks = db.query(TranscriptionTask).filter(
            TranscriptionTask.expires_at <= now
        ).all()

        if not expired_tasks:
            return 0

        logger.info(f"Cleaning up {len(expired_tasks)} expired tasks")

        cleaned = 0
        for task in expired_tasks:
            try:
                # Delete input file
                if task.file_path and Path(task.file_path).exists():
                    Path(task.file_path).unlink(missing_ok=True)
                    logger.debug(f"Deleted input file: {task.file_path}")

                # Delete output file
                if task.output_file_path and Path(task.output_file_path).exists():
                    Path(task.output_file_path).unlink(missing_ok=True)
                    logger.debug(f"Deleted output file: {task.output_file_path}")

                # Delete database record (cascades to webhook logs, usage records)
                db.delete(task)
                cleaned += 1

            except Exception as e:
                logger.error(f"Error cleaning up task {task.id}: {e}")

        db.commit()
        logger.info(f"Cleaned up {cleaned} expired tasks")

        return cleaned

    async def retry_failed_webhooks(self, db: Session) -> int:
        """
        Retry failed webhook deliveries.

        Returns:
            Number of webhooks retried
        """
        try:
            await webhook_service.retry_pending_webhooks(db)
            return 1  # Service logs internally

        except Exception as e:
            logger.error(f"Error retrying webhooks: {e}")
            return 0

    async def cleanup_old_webhook_logs(self, db: Session) -> int:
        """
        Delete old webhook logs to prevent table bloat.

        Keeps logs for 30 days.

        Returns:
            Number of logs deleted
        """
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        old_logs = db.query(WebhookLog).filter(
            WebhookLog.attempted_at < cutoff_date
        ).all()

        if not old_logs:
            return 0

        logger.info(f"Deleting {len(old_logs)} old webhook logs")

        for log in old_logs:
            db.delete(log)

        db.commit()

        return len(old_logs)

    async def cleanup_orphaned_files(self, upload_dir: Path) -> int:
        """
        Clean up orphaned files that have no database record.

        This can happen if uploads are interrupted or database writes fail.

        Args:
            upload_dir: Directory to scan for orphaned files

        Returns:
            Number of files deleted
        """
        if not upload_dir.exists():
            return 0

        db = SessionLocal()
        cleaned = 0

        try:
            # Get all file paths from database
            all_tasks = db.query(TranscriptionTask.file_path, TranscriptionTask.output_file_path).all()
            known_paths = set()
            for task in all_tasks:
                if task.file_path:
                    known_paths.add(Path(task.file_path))
                if task.output_file_path:
                    known_paths.add(Path(task.output_file_path))

            # Scan directory
            for file_path in upload_dir.rglob("*"):
                if not file_path.is_file():
                    continue

                # Check if file is older than 25 hours (24h retention + 1h grace)
                age_hours = (datetime.utcnow() - datetime.fromtimestamp(file_path.stat().st_mtime)).total_seconds() / 3600

                if age_hours > 25 and file_path not in known_paths:
                    try:
                        file_path.unlink()
                        cleaned += 1
                        logger.debug(f"Deleted orphaned file: {file_path}")
                    except Exception as e:
                        logger.error(f"Error deleting orphaned file {file_path}: {e}")

        finally:
            db.close()

        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} orphaned files")

        return cleaned

    async def get_cleanup_stats(self, db: Session) -> dict:
        """
        Get cleanup statistics.

        Returns:
            Dictionary with stats
        """
        now = datetime.utcnow()

        # Count tasks by status
        pending_count = db.query(TranscriptionTask).filter(
            TranscriptionTask.status == "pending"
        ).count()

        processing_count = db.query(TranscriptionTask).filter(
            TranscriptionTask.status == "processing"
        ).count()

        completed_count = db.query(TranscriptionTask).filter(
            TranscriptionTask.status == "completed"
        ).count()

        failed_count = db.query(TranscriptionTask).filter(
            TranscriptionTask.status == "failed"
        ).count()

        # Count expiring soon (next 1 hour)
        expiring_soon = db.query(TranscriptionTask).filter(
            and_(
                TranscriptionTask.expires_at <= now + timedelta(hours=1),
                TranscriptionTask.expires_at > now
            )
        ).count()

        # Count failed webhooks pending retry
        pending_webhooks = db.query(WebhookLog).filter(
            WebhookLog.status == "failed",
            WebhookLog.next_retry_at.isnot(None),
            WebhookLog.next_retry_at <= now + timedelta(hours=1)
        ).count()

        return {
            "tasks": {
                "pending": pending_count,
                "processing": processing_count,
                "completed": completed_count,
                "failed": failed_count,
                "expiring_soon": expiring_soon
            },
            "webhooks": {
                "pending_retry": pending_webhooks
            }
        }


# Global cleanup service instance
cleanup_service = CleanupService()
