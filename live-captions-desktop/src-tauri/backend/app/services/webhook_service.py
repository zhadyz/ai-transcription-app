"""
Webhook delivery service for API v2.
Handles async webhook notifications with retry logic.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session

from app.db.models_v2 import WebhookLog, TranscriptionTask

logger = logging.getLogger(__name__)


class WebhookService:
    """
    Webhook delivery with exponential backoff retry.
    """

    MAX_RETRIES = 5
    TIMEOUT_SECONDS = 30
    RETRY_DELAYS = [30, 60, 300, 900, 3600]  # 30s, 1m, 5m, 15m, 1h

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=self.TIMEOUT_SECONDS,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    def generate_signature(self, payload: str, secret: str) -> str:
        """
        Generate HMAC signature for webhook verification.

        Signature is sent in X-Webhook-Signature header.
        Recipients can verify authenticity by computing:
            HMAC-SHA256(payload, secret)
        """
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

    async def deliver_webhook(
        self,
        db: Session,
        task: TranscriptionTask,
        event_type: str,
        payload: Dict[str, Any],
        webhook_url: Optional[str] = None,
        webhook_secret: Optional[str] = None
    ) -> bool:
        """
        Deliver webhook notification.

        Args:
            db: Database session
            task: TranscriptionTask instance
            event_type: Event type (task.completed, task.failed, etc.)
            payload: JSON payload to send
            webhook_url: Override task's webhook URL
            webhook_secret: HMAC secret for signature

        Returns:
            True if delivery successful, False otherwise
        """
        url = webhook_url or task.webhook_url

        if not url:
            logger.warning(f"No webhook URL for task {task.id}")
            return False

        # Prepare payload
        payload_json = json.dumps(payload, default=str)

        # Generate signature if secret provided
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "TranscriptionAPI/2.0",
            "X-Event-Type": event_type,
            "X-Task-ID": task.id,
            "X-Delivery-Timestamp": datetime.utcnow().isoformat()
        }

        if webhook_secret:
            signature = self.generate_signature(payload_json, webhook_secret)
            headers["X-Webhook-Signature"] = signature

        # Create log entry
        log_entry = WebhookLog(
            task_id=task.id,
            webhook_url=url,
            event_type=event_type,
            status="pending",
            attempt_number=task.webhook_attempts + 1,
            payload=payload_json
        )

        try:
            # Deliver webhook
            response = await self.client.post(
                url,
                json=payload,
                headers=headers,
                timeout=self.TIMEOUT_SECONDS
            )

            # Update log
            log_entry.status = "delivered" if response.status_code < 400 else "failed"
            log_entry.http_status_code = response.status_code
            log_entry.response_body = response.text[:1000]  # Truncate
            log_entry.delivered_at = datetime.utcnow()

            # Update task
            task.webhook_attempts += 1

            if response.status_code < 400:
                task.webhook_delivered = True
                task.webhook_last_attempt = datetime.utcnow()
                logger.info(
                    f"Webhook delivered for task {task.id}: "
                    f"{event_type} -> {url} ({response.status_code})"
                )

                db.add(log_entry)
                db.commit()
                return True
            else:
                logger.warning(
                    f"Webhook failed for task {task.id}: "
                    f"{url} returned {response.status_code}"
                )

        except httpx.TimeoutException as e:
            log_entry.status = "failed"
            log_entry.error_message = f"Timeout after {self.TIMEOUT_SECONDS}s"
            logger.error(f"Webhook timeout for task {task.id}: {url}")

        except httpx.RequestError as e:
            log_entry.status = "failed"
            log_entry.error_message = str(e)[:500]
            logger.error(f"Webhook error for task {task.id}: {e}")

        except Exception as e:
            log_entry.status = "failed"
            log_entry.error_message = str(e)[:500]
            logger.error(f"Unexpected webhook error for task {task.id}: {e}")

        # Schedule retry
        task.webhook_attempts += 1
        task.webhook_last_attempt = datetime.utcnow()

        if task.webhook_attempts < self.MAX_RETRIES:
            delay_seconds = self.RETRY_DELAYS[min(task.webhook_attempts - 1, len(self.RETRY_DELAYS) - 1)]
            log_entry.next_retry_at = datetime.utcnow() + timedelta(seconds=delay_seconds)
            logger.info(
                f"Webhook retry scheduled for task {task.id} in {delay_seconds}s "
                f"(attempt {task.webhook_attempts}/{self.MAX_RETRIES})"
            )
        else:
            logger.error(
                f"Webhook failed permanently for task {task.id} after {self.MAX_RETRIES} attempts"
            )

        db.add(log_entry)
        db.commit()
        return False

    async def send_task_completed(
        self,
        db: Session,
        task: TranscriptionTask,
        webhook_url: Optional[str] = None,
        webhook_secret: Optional[str] = None
    ):
        """Send task.completed webhook"""
        payload = {
            "event": "task.completed",
            "task_id": task.id,
            "status": task.status,
            "transcript": {
                "text": task.transcript_text,
                "word_count": task.word_count,
                "duration_seconds": task.duration_seconds
            },
            "output": {
                "format": task.output_format,
                "download_url": f"/api/v2/tasks/{task.id}/download"
            },
            "timing": {
                "created_at": task.created_at.isoformat(),
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                "processing_seconds": (
                    (task.completed_at - task.started_at).total_seconds()
                    if task.started_at and task.completed_at else None
                )
            },
            "metadata": json.loads(task.client_metadata) if task.client_metadata else {}
        }

        await self.deliver_webhook(db, task, "task.completed", payload, webhook_url, webhook_secret)

    async def send_task_failed(
        self,
        db: Session,
        task: TranscriptionTask,
        webhook_url: Optional[str] = None,
        webhook_secret: Optional[str] = None
    ):
        """Send task.failed webhook"""
        payload = {
            "event": "task.failed",
            "task_id": task.id,
            "status": task.status,
            "error": {
                "message": task.error_message,
                "code": task.error_code
            },
            "timing": {
                "created_at": task.created_at.isoformat(),
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "failed_at": task.completed_at.isoformat() if task.completed_at else None
            },
            "metadata": json.loads(task.client_metadata) if task.client_metadata else {}
        }

        await self.deliver_webhook(db, task, "task.failed", payload, webhook_url, webhook_secret)

    async def send_task_progress(
        self,
        db: Session,
        task: TranscriptionTask,
        webhook_url: Optional[str] = None,
        webhook_secret: Optional[str] = None
    ):
        """Send task.progress webhook (optional, for long-running tasks)"""
        payload = {
            "event": "task.progress",
            "task_id": task.id,
            "status": task.status,
            "progress": task.progress,
            "current_step": task.current_step,
            "timing": {
                "created_at": task.created_at.isoformat(),
                "started_at": task.started_at.isoformat() if task.started_at else None
            }
        }

        await self.deliver_webhook(db, task, "task.progress", payload, webhook_url, webhook_secret)

    async def retry_pending_webhooks(self, db: Session):
        """
        Retry failed webhooks that are due for retry.
        Should be called periodically by background task.
        """
        now = datetime.utcnow()

        # Find webhooks due for retry
        pending_logs = db.query(WebhookLog).filter(
            WebhookLog.status == "failed",
            WebhookLog.next_retry_at <= now,
            WebhookLog.attempt_number < self.MAX_RETRIES
        ).all()

        logger.info(f"Retrying {len(pending_logs)} pending webhooks")

        for log in pending_logs:
            task = db.query(TranscriptionTask).filter(
                TranscriptionTask.id == log.task_id
            ).first()

            if not task:
                continue

            # Parse original payload
            try:
                payload = json.loads(log.payload)
                await self.deliver_webhook(
                    db,
                    task,
                    log.event_type,
                    payload,
                    webhook_url=log.webhook_url
                )
            except Exception as e:
                logger.error(f"Error retrying webhook {log.id}: {e}")


# Global webhook service instance
webhook_service = WebhookService()


async def cleanup_webhook_service():
    """Cleanup function for app shutdown"""
    await webhook_service.close()
