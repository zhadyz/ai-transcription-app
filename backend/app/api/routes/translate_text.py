"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT TRANSLATION API - With Health Checking
═══════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging

from app.services.translation_service import get_translation_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/translate", tags=["translation"])


class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str


class TranslateSegmentsRequest(BaseModel):
    segments: List[dict]
    source_lang: str
    target_lang: str


# DISABLED: Translation service methods not implemented yet
# @router.get("/status")
# async def get_translation_status():
#     """Check if translation service is available and healthy."""
#     return {"available": False, "error": "Translation endpoints disabled"}

# @router.get("/languages")
# async def get_languages():
#     """Get list of supported translation languages"""
#     return {"languages": []}


# DISABLED: Translation service methods not implemented yet
# @router.post("/text")
# async def translate_text(request: TranslateRequest):
#     """Translate plain text"""
#     raise HTTPException(501, "Translation endpoint not implemented")

# @router.post("/segments")
# async def translate_segments(request: TranslateSegmentsRequest):
#     """Translate transcription segments with timestamps"""
#     raise HTTPException(501, "Translation endpoint not implemented")